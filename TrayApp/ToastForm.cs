using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace IntranetNotifier;

/// <summary>
/// A self-owned, always-on-top toast popup shown in the bottom-right corner of
/// the primary screen. Unlike the legacy NotifyIcon balloon (which Windows 10/11
/// routes through the toast system and frequently suppresses via Focus Assist,
/// per-app notification settings, etc.), this window is fully under our control
/// and will always appear — even when the browser is minimized.
/// </summary>
public sealed class ToastForm : Form
{
    // Show the window without stealing focus from the user's current app.
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_EX_TOPMOST = 0x00000008;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= WS_EX_NOACTIVATE | WS_EX_TOPMOST | WS_EX_TOOLWINDOW;
            return cp;
        }
    }

    private readonly System.Windows.Forms.Timer _autoClose;
    private readonly Action _onClick;

    // Keep a static list so multiple toasts stack instead of overlapping.
    private static readonly List<ToastForm> Open = new();

    public ToastForm(string title, string body, Action onClick, int durationMs = 8000)
    {
        _onClick = onClick;

        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        ShowInTaskbar = false;
        TopMost = true;
        Width = 360;
        Height = 110;
        BackColor = Color.FromArgb(32, 34, 40);
        DoubleBuffered = true;
        Padding = new Padding(0);

        // Rounded corners
        Region = System.Drawing.Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 16, 16));

        // Accent bar on the left
        var accent = new Panel
        {
            Dock = DockStyle.Left,
            Width = 6,
            BackColor = Color.FromArgb(66, 165, 245)
        };
        Controls.Add(accent);

        var titleLabel = new Label
        {
            Text = string.IsNullOrWhiteSpace(title) ? "Intranet" : title,
            ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 11f, FontStyle.Bold),
            AutoEllipsis = true,
            Location = new Point(20, 14),
            Size = new Size(Width - 60, 24)
        };

        var bodyLabel = new Label
        {
            Text = string.IsNullOrWhiteSpace(body) ? "You have a new notification" : body,
            ForeColor = Color.FromArgb(210, 214, 220),
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
            AutoEllipsis = true,
            Location = new Point(20, 42),
            Size = new Size(Width - 60, 52)
        };

        var closeButton = new Label
        {
            Text = "✕",
            ForeColor = Color.FromArgb(150, 154, 160),
            Font = new Font("Segoe UI", 10f, FontStyle.Regular),
            TextAlign = ContentAlignment.MiddleCenter,
            Location = new Point(Width - 34, 8),
            Size = new Size(24, 24),
            Cursor = Cursors.Hand
        };
        closeButton.Click += (s, e) => Close();
        closeButton.MouseEnter += (s, e) => closeButton.ForeColor = Color.White;
        closeButton.MouseLeave += (s, e) => closeButton.ForeColor = Color.FromArgb(150, 154, 160);

        Controls.Add(titleLabel);
        Controls.Add(bodyLabel);
        Controls.Add(closeButton);

        // Clicking anywhere (except the close button) opens the intranet.
        Click += OnBodyClick;
        titleLabel.Click += OnBodyClick;
        bodyLabel.Click += OnBodyClick;
        Cursor = Cursors.Hand;
        titleLabel.Cursor = Cursors.Hand;
        bodyLabel.Cursor = Cursors.Hand;

        _autoClose = new System.Windows.Forms.Timer { Interval = durationMs };
        _autoClose.Tick += (s, e) => Close();
        _autoClose.Start();

        // Pause auto-close while hovered so the user can read/click.
        MouseEnter += (s, e) => _autoClose.Stop();
        MouseLeave += (s, e) => _autoClose.Start();
    }

    private void OnBodyClick(object? sender, EventArgs e)
    {
        try { _onClick?.Invoke(); }
        finally { Close(); }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        // Subtle border
        using var pen = new Pen(Color.FromArgb(60, 63, 70), 1);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        Open.Add(this);
        Reposition();
        // Force the toast into the top-most band and to the very front of the
        // Z-order without stealing focus. TopMost alone is not always enough
        // when the notification arrives while a maximized window is focused, so
        // we do it explicitly via SetWindowPos.
        ForceToFront();
        try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
    }

    private void ForceToFront()
    {
        try
        {
            SetWindowPos(Handle, HWND_TOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
        }
        catch { }
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        Open.Remove(this);
        _autoClose.Stop();
        _autoClose.Dispose();
        base.OnFormClosed(e);
        RepositionAll();
    }

    /// <summary>Position this toast just above any already-open toasts, bottom-right.</summary>
    private void Reposition()
    {
        var wa = Screen.PrimaryScreen!.WorkingArea;
        const int margin = 12;
        int index = Open.IndexOf(this);
        int y = wa.Bottom - margin - Height - index * (Height + 8);
        int x = wa.Right - margin - Width;
        Location = new Point(x, y);
    }

    private static void RepositionAll()
    {
        var wa = Screen.PrimaryScreen!.WorkingArea;
        const int margin = 12;
        for (int i = 0; i < Open.Count; i++)
        {
            var t = Open[i];
            int y = wa.Bottom - margin - t.Height - i * (t.Height + 8);
            int x = wa.Right - margin - t.Width;
            t.Location = new Point(x, y);
        }
    }

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int w, int h);

    // ---- native force-to-front ----
    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter,
        int X, int Y, int cx, int cy, uint uFlags);
}
