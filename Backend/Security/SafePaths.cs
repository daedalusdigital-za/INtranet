namespace ProjectTracker.API.Security
{
    /// <summary>
    /// Helpers for handling user-supplied file names and relative paths safely.
    /// Every path built from request data must go through <see cref="ResolveUnder"/>
    /// (containment) and every stored file name through <see cref="SanitizeFileName"/>.
    /// </summary>
    public static class SafePaths
    {
        private static readonly StringComparison PathComparison =
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

        /// <summary>
        /// Extensions that browsers or Windows treat as active content / executables.
        /// They are never accepted as uploads or as rename targets.
        /// </summary>
        private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".html", ".htm", ".xhtml", ".shtml", ".mht", ".mhtml", ".svg", ".svgz", ".xsl", ".xslt",
            ".js", ".mjs", ".cjs", ".vbs", ".vbe", ".jse", ".wsf", ".wsh", ".hta",
            ".exe", ".dll", ".com", ".scr", ".msi", ".msp", ".bat", ".cmd", ".ps1", ".psm1", ".sh",
            ".jar", ".php", ".phtml", ".asp", ".aspx", ".ashx", ".asmx", ".jsp", ".cgi",
            ".lnk", ".url", ".reg", ".inf", ".cpl", ".appref-ms", ".swf"
        };

        /// <summary>Extensions that are safe to render inline in the browser.</summary>
        private static readonly HashSet<string> InlineSafeExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".txt", ".csv"
        };

        /// <summary>
        /// Combines <paramref name="root"/> with relative <paramref name="parts"/> and returns the
        /// full path only when it stays inside root (or is root itself). Returns null for
        /// traversal ("..", absolute parts, drive letters) or a sibling folder sharing the prefix.
        /// </summary>
        public static string? ResolveUnder(string root, params string?[] parts)
        {
            var fullRoot = Path.GetFullPath(root);
            var combined = fullRoot;
            foreach (var part in parts)
            {
                if (string.IsNullOrEmpty(part)) continue;
                var p = part.Replace('\\', '/').TrimStart('/');
                if (Path.IsPathRooted(p)) return null;
                combined = Path.Combine(combined, p);
            }

            var full = Path.GetFullPath(combined);
            return IsUnder(fullRoot, full) ? full : null;
        }

        /// <summary>True when <paramref name="fullPath"/> is <paramref name="root"/> or inside it.</summary>
        public static bool IsUnder(string root, string fullPath)
        {
            var fullRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
            var candidate = Path.TrimEndingDirectorySeparator(Path.GetFullPath(fullPath));
            return candidate.Equals(fullRoot, PathComparison) ||
                   candidate.StartsWith(fullRoot + Path.DirectorySeparatorChar, PathComparison);
        }

        /// <summary>
        /// Reduces a client-supplied file name to a safe single path segment: drops any
        /// directory part, invalid characters and leading/trailing dots and spaces.
        /// </summary>
        public static string SanitizeFileName(string? fileName, string fallback = "file")
        {
            var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
            var invalid = Path.GetInvalidFileNameChars();
            name = new string(name.Where(c => !invalid.Contains(c) && c != '/' && c != '\\' && !char.IsControl(c)).ToArray());
            name = name.Trim().Trim('.').Trim();
            if (name.Length > 200)
            {
                var ext = Path.GetExtension(name);
                name = name[..(200 - ext.Length)] + ext;
            }
            return string.IsNullOrWhiteSpace(name) ? fallback : name;
        }

        /// <summary>True when the name is a single, already-safe path segment.</summary>
        public static bool IsPlainFileName(string? name) =>
            !string.IsNullOrWhiteSpace(name) && SanitizeFileName(name, string.Empty) == name;

        public static bool IsBlockedExtension(string? fileName) =>
            BlockedExtensions.Contains(Path.GetExtension(fileName ?? string.Empty));

        public static bool IsInlineSafe(string? fileName) =>
            InlineSafeExtensions.Contains(Path.GetExtension(fileName ?? string.Empty));
    }
}
