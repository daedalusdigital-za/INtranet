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

                var extension = Path.GetExtension(file.FileName).ToLower();
                
                // For Ricoh printers, use IPP (Internet Printing Protocol) which properly handles PDF
                // This is the preferred method as it handles format conversion properly
                var printed = await TryIppPrinting(printer, fileBytes, file.FileName, extension);
                
                if (!printed)
                {
                    // Fallback: Try direct raw socket printing for PostScript/PCL files only
                    if (extension == ".ps" || extension == ".pcl" || extension == ".prn")
                    {
                        await SendRawToPrinter(printer, fileBytes);
                    }
                    else
                    {
                        throw new Exception($"Could not print {extension} file. The printer may not support this format directly.");
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
        /// Try printing via IPP (Internet Printing Protocol) - preferred method for PDF files
        /// IPP properly handles PDF conversion on the printer side
        /// </summary>
        private async Task<bool> TryIppPrinting(PrinterInfo printer, byte[] data, string fileName, string extension)
        {
            try
            {
                // Ricoh printers typically support IPP on port 631 or via HTTP port 80
                // Try the standard IPP port first
                var ippPorts = new[] { 631, 80 };
                
                foreach (var port in ippPorts)
                {
                    try
                    {
                        using var client = new HttpClient();
                        client.Timeout = TimeSpan.FromSeconds(30);
                        
                        var ippUrl = $"http://{printer.IpAddress}:{port}/ipp/print";
                        
                        // Build IPP request for Print-Job operation
                        var ippRequest = BuildIppPrintJobRequest(data, fileName, extension);
                        
                        var content = new ByteArrayContent(ippRequest);
                        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/ipp");
                        
                        var response = await client.PostAsync(ippUrl, content);
                        
                        if (response.IsSuccessStatusCode)
                        {
                            _logger.LogInformation("Successfully sent via IPP on port {Port}", port);
                            return true;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug("IPP on port {Port} failed: {Message}", port, ex.Message);
                    }
                }
                
                // If IPP fails, try direct LPD (port 515) - common on network printers
                if (await TryLpdPrinting(printer, data, fileName))
                {
                    return true;
                }
                
                // Last resort: Try raw socket with PJL wrapper for PDF
                if (extension == ".pdf")
                {
                    await SendPdfWithPjlWrapper(printer, data, fileName);
                    return true;
                }
                
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogDebug("IPP printing failed: {Message}", ex.Message);
                return false;
            }
        }
        
        /// <summary>
        /// Build a minimal IPP Print-Job request
        /// </summary>
        private byte[] BuildIppPrintJobRequest(byte[] documentData, string fileName, string extension)
        {
            using var ms = new MemoryStream();
            using var writer = new BinaryWriter(ms);
            
            // IPP version 1.1
            writer.Write((byte)1); // Major version
            writer.Write((byte)1); // Minor version
            
            // Operation ID: Print-Job = 0x0002
            writer.Write((byte)0x00);
            writer.Write((byte)0x02);
            
            // Request ID
            writer.Write((byte)0x00);
            writer.Write((byte)0x00);
            writer.Write((byte)0x00);
            writer.Write((byte)0x01);
            
            // Operation attributes tag
            writer.Write((byte)0x01);
            
            // attributes-charset
            WriteIppAttribute(writer, 0x47, "attributes-charset", "utf-8");
            
            // attributes-natural-language
            WriteIppAttribute(writer, 0x48, "attributes-natural-language", "en");
            
            // printer-uri
            WriteIppAttribute(writer, 0x45, "printer-uri", "ipp://localhost/ipp/print");
            
            // document-format
            var mimeType = GetMimeType(extension);
            WriteIppAttribute(writer, 0x49, "document-format", mimeType);
            
            // job-name
            WriteIppAttribute(writer, 0x42, "job-name", fileName);
            
            // End of attributes
            writer.Write((byte)0x03);
            
            // Document data
            writer.Write(documentData);
            
            return ms.ToArray();
        }
        
        private void WriteIppAttribute(BinaryWriter writer, byte valueTag, string name, string value)
        {
            writer.Write(valueTag);
            
            // Name length (big endian)
            var nameBytes = System.Text.Encoding.UTF8.GetBytes(name);
            writer.Write((byte)(nameBytes.Length >> 8));
            writer.Write((byte)(nameBytes.Length & 0xFF));
            writer.Write(nameBytes);
            
            // Value length (big endian)
            var valueBytes = System.Text.Encoding.UTF8.GetBytes(value);
            writer.Write((byte)(valueBytes.Length >> 8));
            writer.Write((byte)(valueBytes.Length & 0xFF));
            writer.Write(valueBytes);
        }
        
        /// <summary>
        /// Try LPD printing (Line Printer Daemon) - port 515
        /// </summary>
        private async Task<bool> TryLpdPrinting(PrinterInfo printer, byte[] data, string fileName)
        {
            try
            {
                using var client = new TcpClient();
                await client.ConnectAsync(printer.IpAddress, 515);
                using var stream = client.GetStream();
                
                // LPD protocol: Send print job
                var queueName = "lp";
                var controlFile = $"Hproject-tracker\nP{Environment.UserName}\nf{fileName}\n";
                var dataFileSize = data.Length;
                
                // Send receive job command
                var receiveCmd = $"\x02{queueName}\n";
                await stream.WriteAsync(System.Text.Encoding.ASCII.GetBytes(receiveCmd));
                
                // Wait for acknowledgment
                var ack = new byte[1];
                await stream.ReadAsync(ack);
                if (ack[0] != 0) return false;
                
                // Send control file
                var ctrlCmd = $"\x02{controlFile.Length} cfA001{Environment.MachineName}\n";
                await stream.WriteAsync(System.Text.Encoding.ASCII.GetBytes(ctrlCmd));
                await stream.ReadAsync(ack);
                if (ack[0] != 0) return false;
                
                await stream.WriteAsync(System.Text.Encoding.ASCII.GetBytes(controlFile));
                await stream.WriteAsync(new byte[] { 0 });
                await stream.ReadAsync(ack);
                if (ack[0] != 0) return false;
                
                // Send data file
                var dataCmd = $"\x03{dataFileSize} dfA001{Environment.MachineName}\n";
                await stream.WriteAsync(System.Text.Encoding.ASCII.GetBytes(dataCmd));
                await stream.ReadAsync(ack);
                if (ack[0] != 0) return false;
                
                await stream.WriteAsync(data);
                await stream.WriteAsync(new byte[] { 0 });
                await stream.ReadAsync(ack);
                
                _logger.LogInformation("Successfully sent via LPD");
                return ack[0] == 0;
            }
            catch (Exception ex)
            {
                _logger.LogDebug("LPD printing failed: {Message}", ex.Message);
                return false;
            }
        }
        
        /// <summary>
        /// Send PDF with PJL wrapper for direct printing
        /// This wraps the PDF data with proper PJL commands that Ricoh printers understand
        /// </summary>
        private async Task SendPdfWithPjlWrapper(PrinterInfo printer, byte[] pdfData, string fileName)
        {
            using var client = new TcpClient();
            await client.ConnectAsync(printer.IpAddress, printer.Port);
            using var stream = client.GetStream();
            
            // PJL Universal Exit Language command to ensure clean state
            var pjlHeader = "\x1B%-12345X@PJL JOB NAME=\"" + fileName + "\"\r\n" +
                           "@PJL SET COPIES=1\r\n" +
                           "@PJL ENTER LANGUAGE=PDF\r\n";
            
            var pjlFooter = "\x1B%-12345X@PJL EOJ NAME=\"" + fileName + "\"\r\n" +
                           "\x1B%-12345X";
            
            // Write PJL header
            var headerBytes = System.Text.Encoding.ASCII.GetBytes(pjlHeader);
            await stream.WriteAsync(headerBytes);
            
            // Write PDF data
            await stream.WriteAsync(pdfData);
            
            // Write PJL footer
            var footerBytes = System.Text.Encoding.ASCII.GetBytes(pjlFooter);
            await stream.WriteAsync(footerBytes);
            
            await stream.FlushAsync();
            
            _logger.LogInformation("Successfully sent PDF with PJL wrapper");
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
