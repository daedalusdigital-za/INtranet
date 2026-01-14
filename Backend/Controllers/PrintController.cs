using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Sockets;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PrintController : ControllerBase
    {
        private readonly ILogger<PrintController> _logger;
        private readonly IWebHostEnvironment _environment;

        // Printer configurations
        private static readonly Dictionary<string, PrinterInfo> Printers = new()
        {
            { "admin", new PrinterInfo("Admin Printer", "192.168.10.134", 9100) },
            { "finance", new PrinterInfo("Finance Printer", "192.168.10.103", 9100) },
            { "condom", new PrinterInfo("Condom Printer", "192.168.10.161", 9100) },
            { "hr", new PrinterInfo("HR Printer", "192.168.10.130", 9100) },
            { "sales", new PrinterInfo("Sales Printer", "192.168.10.104", 9100) },
            { "pharmatech", new PrinterInfo("Pharmatech Printer", "192.168.10.136", 9100) },
            { "logistics", new PrinterInfo("Logistics Printer", "192.168.10.248", 9100) },
            { "projects", new PrinterInfo("Projects Printer", "192.168.10.5", 9100) },
            { "tender", new PrinterInfo("Tender Printer", "192.168.10.128", 9100) }
        };

        public PrintController(ILogger<PrintController> logger, IWebHostEnvironment environment)
        {
            _logger = logger;
            _environment = environment;
        }

        /// <summary>
        /// Get list of available printers
        /// </summary>
        [HttpGet("printers")]
        public IActionResult GetPrinters()
        {
            var printerList = Printers.Select(p => new
            {
                key = p.Key,
                name = p.Value.Name,
                ip = p.Value.IpAddress,
                port = p.Value.Port
            });

            return Ok(printerList);
        }

        /// <summary>
        /// Check if a printer is online
        /// </summary>
        [HttpGet("printers/{printerKey}/status")]
        public async Task<IActionResult> CheckPrinterStatus(string printerKey)
        {
            if (!Printers.TryGetValue(printerKey.ToLower(), out var printer))
            {
                return NotFound(new { error = "Printer not found" });
            }

            try
            {
                using var client = new TcpClient();
                var connectTask = client.ConnectAsync(printer.IpAddress, printer.Port);
                
                if (await Task.WhenAny(connectTask, Task.Delay(3000)) == connectTask)
                {
                    await connectTask; // Propagate any exceptions
                    return Ok(new { 
                        online = true, 
                        name = printer.Name, 
                        ip = printer.IpAddress 
                    });
                }
                else
                {
                    return Ok(new { 
                        online = false, 
                        name = printer.Name, 
                        ip = printer.IpAddress,
                        error = "Connection timeout" 
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Printer {Name} at {IP} is offline: {Error}", 
                    printer.Name, printer.IpAddress, ex.Message);
                
                return Ok(new { 
                    online = false, 
                    name = printer.Name, 
                    ip = printer.IpAddress,
                    error = ex.Message 
                });
            }
        }

        /// <summary>
        /// Send a document to a printer
        /// </summary>
        [HttpPost("send/{printerKey}")]
        public async Task<IActionResult> SendToPrinter(string printerKey, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file provided" });
            }

            if (!Printers.TryGetValue(printerKey.ToLower(), out var printer))
            {
                return NotFound(new { error = "Printer not found" });
            }

            try
            {
                _logger.LogInformation("Sending {FileName} ({Size} bytes) to {PrinterName} at {IP}",
                    file.FileName, file.Length, printer.Name, printer.IpAddress);

                // Read file content
                byte[] fileBytes;
                using (var memoryStream = new MemoryStream())
                {
                    await file.CopyToAsync(memoryStream);
                    fileBytes = memoryStream.ToArray();
                }

                // For PDF files, we can send directly to the printer
                // Most Ricoh printers support direct PDF printing on port 9100
                var extension = Path.GetExtension(file.FileName).ToLower();
                
                if (extension == ".pdf")
                {
                    // Send PDF directly to printer via raw socket (port 9100)
                    await SendRawToPrinter(printer, fileBytes);
                }
                else if (extension == ".txt")
                {
                    // Text files can be sent directly
                    await SendRawToPrinter(printer, fileBytes);
                }
                else if (extension == ".prn" || extension == ".ps")
                {
                    // PostScript/PRN files can be sent directly
                    await SendRawToPrinter(printer, fileBytes);
                }
                else
                {
                    // For other file types (Word, Excel, Images), we need to convert to PDF first
                    // For now, we'll save the file and let Windows handle the conversion
                    // In production, you'd use a library like Aspose or a service
                    
                    var tempPath = Path.Combine(Path.GetTempPath(), $"print_{Guid.NewGuid()}{extension}");
                    await System.IO.File.WriteAllBytesAsync(tempPath, fileBytes);
                    
                    try
                    {
                        // Try to print using Windows Print system
                        await PrintUsingWindowsSpooler(tempPath, printer);
                    }
                    finally
                    {
                        // Clean up temp file
                        if (System.IO.File.Exists(tempPath))
                        {
                            System.IO.File.Delete(tempPath);
                        }
                    }
                }

                _logger.LogInformation("Successfully sent {FileName} to {PrinterName}", 
                    file.FileName, printer.Name);

                return Ok(new
                {
                    success = true,
                    message = $"Document sent to {printer.Name}",
                    printer = printer.Name,
                    ip = printer.IpAddress,
                    fileName = file.FileName,
                    fileSize = file.Length
                });
            }
            catch (SocketException ex)
            {
                _logger.LogError(ex, "Socket error sending to printer {Name} at {IP}", 
                    printer.Name, printer.IpAddress);
                
                return StatusCode(503, new
                {
                    success = false,
                    error = "Printer is not reachable",
                    details = $"Could not connect to {printer.Name} at {printer.IpAddress}. Please check if the printer is online and connected to the network."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending document to printer {Name}", printer.Name);
                
                return StatusCode(500, new
                {
                    success = false,
                    error = "Failed to send document to printer",
                    details = ex.Message
                });
            }
        }

        /// <summary>
        /// Send raw data directly to printer via TCP port 9100
        /// </summary>
        private async Task SendRawToPrinter(PrinterInfo printer, byte[] data)
        {
            using var client = new TcpClient();
            
            // Connect with timeout
            var connectTask = client.ConnectAsync(printer.IpAddress, printer.Port);
            if (await Task.WhenAny(connectTask, Task.Delay(10000)) != connectTask)
            {
                throw new TimeoutException($"Connection to {printer.IpAddress}:{printer.Port} timed out");
            }
            
            await connectTask; // Propagate any connection exceptions

            using var stream = client.GetStream();
            stream.WriteTimeout = 30000; // 30 second write timeout
            
            await stream.WriteAsync(data);
            await stream.FlushAsync();
            
            _logger.LogDebug("Sent {Bytes} bytes to {IP}:{Port}", 
                data.Length, printer.IpAddress, printer.Port);
        }

        /// <summary>
        /// Print using Windows Print Spooler (for non-PDF files)
        /// </summary>
        private async Task PrintUsingWindowsSpooler(string filePath, PrinterInfo printer)
        {
            // This uses the Windows print subsystem
            // The printer needs to be added to Windows first, or we use IPP
            
            // For Ricoh printers, we can try to use the HTTP printing interface
            // Ricoh printers often support printing via HTTP POST to port 80 or 631
            
            var extension = Path.GetExtension(filePath).ToLower();
            
            // Read the file
            var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
            
            // Try sending via raw socket first
            // Many printers can handle various file formats directly
            try
            {
                await SendRawToPrinter(printer, fileBytes);
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Raw printing failed, trying alternative method: {Error}", ex.Message);
            }

            // If raw printing fails, try IPP (Internet Printing Protocol) on port 631
            try
            {
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                
                var content = new ByteArrayContent(fileBytes);
                content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
                    GetMimeType(extension));
                
                // Try IPP endpoint
                var ippUrl = $"http://{printer.IpAddress}:631/ipp/print";
                var response = await httpClient.PostAsync(ippUrl, content);
                
                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"IPP printing failed with status {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("IPP printing failed: {Error}", ex.Message);
                throw new Exception($"Could not print file. The file type '{extension}' may not be supported for direct printing. Please convert to PDF first.");
            }
        }

        private string GetMimeType(string extension)
        {
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".txt" => "text/plain",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".ppt" => "application/vnd.ms-powerpoint",
                ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                _ => "application/octet-stream"
            };
        }
    }

    public class PrinterInfo
    {
        public string Name { get; }
        public string IpAddress { get; }
        public int Port { get; }

        public PrinterInfo(string name, string ipAddress, int port = 9100)
        {
            Name = name;
            IpAddress = ipAddress;
            Port = port;
        }
    }
}
