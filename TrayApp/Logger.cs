using System.Text;

namespace IntranetNotifier;

/// <summary>
/// Minimal file logger. Writes to
/// %AppData%\PromedIntranetNotifier\log.txt so we can diagnose notification
/// delivery on end-user machines (which userId registered, whether
/// ReceiveNotification fired, whether a toast was shown, etc.).
/// </summary>
public static class Logger
{
    private static readonly object Gate = new();
    private static readonly string LogPath;

    static Logger()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "PromedIntranetNotifier");
        Directory.CreateDirectory(dir);
        LogPath = Path.Combine(dir, "log.txt");
    }

    public static string Path_ => LogPath;

    public static void Log(string message)
    {
        try
        {
            lock (Gate)
            {
                // Keep the log from growing unbounded (~256 KB cap).
                if (File.Exists(LogPath) && new FileInfo(LogPath).Length > 256 * 1024)
                    File.WriteAllText(LogPath, "");

                File.AppendAllText(LogPath,
                    $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}  {message}{Environment.NewLine}",
                    Encoding.UTF8);
            }
        }
        catch { /* logging must never crash the app */ }
    }
}
