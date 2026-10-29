using QRCoder;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Shared barcode / QR renderer used by tripsheets, waybills and labels.
    /// Pure managed code (no native deps) so it runs identically in Docker/Linux.
    /// Extracted from TripSheetController so every module encodes codes the same way.
    /// </summary>
    public static class CodeRenderer
    {
        /// <summary>Base64 PNG of a QR code for the payload (typically a tracking URL).</summary>
        public static string QrPngBase64(string payload, int pixelsPerModule = 6)
        {
            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(payload ?? string.Empty, QRCodeGenerator.ECCLevel.M);
            var png = new PngByteQRCode(data);
            return Convert.ToBase64String(png.GetGraphic(pixelsPerModule));
        }

        public static byte[] QrPng(string payload, int pixelsPerModule = 6)
        {
            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(payload ?? string.Empty, QRCodeGenerator.ECCLevel.M);
            return new PngByteQRCode(data).GetGraphic(pixelsPerModule);
        }

        // Code128 (code set B) bar patterns - each value maps to 6 alternating bar/space module widths.
        private static readonly string[] Code128Patterns = new[]
        {
            "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
            "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
            "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
            "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
            "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
            "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
            "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
            "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
            "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
            "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
            "114131","311141","411131","211412","211214","211232","2331112"
        };

        /// <summary>
        /// Scannable Code128-B barcode as a raster PNG (base64). Encodes the value
        /// exactly as printed, with the mandatory quiet zones, so laser readers scan it.
        /// </summary>
        public static string Code128PngBase64(string data, int pxPerModule = 3, int barHeightPx = 90)
            => Convert.ToBase64String(Code128Png(data, pxPerModule, barHeightPx));

        public static byte[] Code128Png(string data, int pxPerModule = 3, int barHeightPx = 90)
        {
            data ??= string.Empty;
            var clean = new string(data.Where(c => c >= 32 && c <= 126).ToArray());
            if (clean.Length == 0) clean = "0";

            var values = new List<int> { 104 }; // Start Code B
            int checksum = 104;
            for (int i = 0; i < clean.Length; i++)
            {
                int val = clean[i] - 32;
                values.Add(val);
                checksum += val * (i + 1);
            }
            values.Add(checksum % 103);
            values.Add(106); // Stop

            const int quietModules = 10;
            var modules = new List<bool>();
            for (int q = 0; q < quietModules; q++) modules.Add(false);
            foreach (var v in values)
            {
                var pattern = Code128Patterns[v];
                for (int i = 0; i < pattern.Length; i++)
                {
                    int units = pattern[i] - '0';
                    bool black = (i % 2 == 0);
                    for (int u = 0; u < units; u++) modules.Add(black);
                }
            }
            for (int q = 0; q < quietModules; q++) modules.Add(false);

            int width = modules.Count * pxPerModule;
            var row = new byte[width];
            int x = 0;
            foreach (var black in modules)
            {
                byte val = (byte)(black ? 0 : 255);
                for (int p = 0; p < pxPerModule; p++) row[x++] = val;
            }
            return BuildGrayscalePng(row, width, barHeightPx);
        }

        private static byte[] BuildGrayscalePng(byte[] scanline, int width, int height)
        {
            var raw = new byte[(width + 1) * height];
            int idx = 0;
            for (int y = 0; y < height; y++)
            {
                raw[idx++] = 0;
                Buffer.BlockCopy(scanline, 0, raw, idx, width);
                idx += width;
            }

            byte[] compressed;
            using (var ms = new MemoryStream())
            {
                ms.WriteByte(0x78); ms.WriteByte(0x01);
                using (var deflate = new System.IO.Compression.DeflateStream(ms, System.IO.Compression.CompressionLevel.Optimal, true))
                    deflate.Write(raw, 0, raw.Length);
                uint adler = Adler32(raw);
                ms.WriteByte((byte)(adler >> 24)); ms.WriteByte((byte)(adler >> 16));
                ms.WriteByte((byte)(adler >> 8)); ms.WriteByte((byte)adler);
                compressed = ms.ToArray();
            }

            using var outMs = new MemoryStream();
            outMs.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }, 0, 8);
            var ihdr = new byte[13];
            WriteBE(ihdr, 0, (uint)width);
            WriteBE(ihdr, 4, (uint)height);
            ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
            WritePngChunk(outMs, "IHDR", ihdr);
            WritePngChunk(outMs, "IDAT", compressed);
            WritePngChunk(outMs, "IEND", Array.Empty<byte>());
            return outMs.ToArray();
        }

        private static void WriteBE(byte[] buf, int offset, uint value)
        {
            buf[offset] = (byte)(value >> 24);
            buf[offset + 1] = (byte)(value >> 16);
            buf[offset + 2] = (byte)(value >> 8);
            buf[offset + 3] = (byte)value;
        }

        private static void WritePngChunk(Stream s, string type, byte[] data)
        {
            var len = new byte[4];
            WriteBE(len, 0, (uint)data.Length);
            s.Write(len, 0, 4);
            var typeBytes = System.Text.Encoding.ASCII.GetBytes(type);
            s.Write(typeBytes, 0, 4);
            if (data.Length > 0) s.Write(data, 0, data.Length);
            var crcInput = new byte[typeBytes.Length + data.Length];
            Buffer.BlockCopy(typeBytes, 0, crcInput, 0, typeBytes.Length);
            Buffer.BlockCopy(data, 0, crcInput, typeBytes.Length, data.Length);
            var crcBytes = new byte[4];
            WriteBE(crcBytes, 0, Crc32(crcInput));
            s.Write(crcBytes, 0, 4);
        }

        private static uint Adler32(byte[] data)
        {
            const uint MOD = 65521;
            uint a = 1, b = 0;
            foreach (var d in data) { a = (a + d) % MOD; b = (b + a) % MOD; }
            return (b << 16) | a;
        }

        private static readonly uint[] CrcTable = BuildCrcTable();
        private static uint[] BuildCrcTable()
        {
            var t = new uint[256];
            for (uint n = 0; n < 256; n++)
            {
                uint c = n;
                for (int k = 0; k < 8; k++) c = ((c & 1) != 0) ? (0xEDB88320 ^ (c >> 1)) : (c >> 1);
                t[n] = c;
            }
            return t;
        }
        private static uint Crc32(byte[] data)
        {
            uint crc = 0xFFFFFFFF;
            foreach (var d in data) crc = CrcTable[(crc ^ d) & 0xFF] ^ (crc >> 8);
            return crc ^ 0xFFFFFFFF;
        }
    }
}
