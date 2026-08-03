using System.Drawing.Drawing2D;

namespace IntranetNotifier;

/// <summary>
/// Generates the tray icon at runtime so we don't need to ship an .ico file.
/// Draws a rounded "P" badge; when there are unread items a red dot is overlaid.
/// </summary>
public static class IconFactory
{
    public static Icon CreateTrayIcon(bool hasUnread)
    {
        using var bmp = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);

            // Rounded square background
            using (var bg = new SolidBrush(Color.FromArgb(30, 58, 95)))
            using (var path = RoundedRect(new Rectangle(2, 2, 28, 28), 7))
            {
                g.FillPath(bg, path);
            }

            // Letter "P"
            using (var font = new Font("Segoe UI", 15f, FontStyle.Bold, GraphicsUnit.Pixel))
            using (var fg = new SolidBrush(Color.White))
            {
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString("P", font, fg, new RectangleF(2, 1, 28, 28), sf);
            }

            // Unread indicator
            if (hasUnread)
            {
                using var dot = new SolidBrush(Color.FromArgb(220, 38, 38));
                using var ring = new Pen(Color.White, 2f);
                var r = new Rectangle(19, 1, 11, 11);
                g.FillEllipse(dot, r);
                g.DrawEllipse(ring, r);
            }
        }

        var hIcon = bmp.GetHicon();
        return Icon.FromHandle(hIcon);
    }

    private static GraphicsPath RoundedRect(Rectangle bounds, int radius)
    {
        int d = radius * 2;
        var path = new GraphicsPath();
        path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }
}
