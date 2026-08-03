using System.Threading;

namespace IntranetNotifier;

internal static class Program
{
    private static Mutex? _singleInstanceMutex;

    [STAThread]
    static void Main()
    {
        // Single-instance guard — only one notifier per user session
        _singleInstanceMutex = new Mutex(true, "Promed_Intranet_Notifier_SingleInstance", out bool isNew);
        if (!isNew)
        {
            return; // another instance is already running
        }

        ApplicationConfiguration.Initialize();
        AppConfig.Load();

        // On first run, enable auto-start with Windows automatically.
        if (!AutoStart.IsEnabled())
        {
            AutoStart.Enable();
        }

        Application.Run(new TrayApplicationContext());

        GC.KeepAlive(_singleInstanceMutex);
    }
}
