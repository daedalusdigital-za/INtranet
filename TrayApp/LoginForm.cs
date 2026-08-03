using System.ComponentModel;

namespace IntranetNotifier;

/// <summary>
/// Simple modal login window. Authenticates against the intranet API and, on
/// success, exposes the AuthResult to the caller.
/// </summary>
public class LoginForm : Form
{
    private readonly ApiClient _api;
    private TextBox _emailBox = null!;
    private TextBox _passwordBox = null!;
    private Button _loginButton = null!;
    private Label _statusLabel = null!;
    private CheckBox _showPassword = null!;

    public AuthResult? Result { get; private set; }

    public LoginForm(ApiClient api, string? prefillEmail = null)
    {
        _api = api;
        BuildUi();
        if (!string.IsNullOrEmpty(prefillEmail))
            _emailBox.Text = prefillEmail;
    }

    private void BuildUi()
    {
        Text = "Promed Intranet Notifier — Sign In";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(380, 260);
        BackColor = Color.White;
        Font = new Font("Segoe UI", 9.5f);

        var title = new Label
        {
            Text = "Sign in to the Intranet",
            Font = new Font("Segoe UI Semibold", 13f, FontStyle.Bold),
            ForeColor = Color.FromArgb(30, 58, 95),
            AutoSize = true,
            Location = new Point(24, 20)
        };

        var subtitle = new Label
        {
            Text = "Use your normal intranet email & password.",
            ForeColor = Color.Gray,
            AutoSize = true,
            Location = new Point(24, 48)
        };

        var emailLabel = new Label { Text = "Email", AutoSize = true, Location = new Point(24, 82) };
        _emailBox = new TextBox { Location = new Point(24, 102), Width = 330 };

        var pwLabel = new Label { Text = "Password", AutoSize = true, Location = new Point(24, 132) };
        _passwordBox = new TextBox { Location = new Point(24, 152), Width = 330, UseSystemPasswordChar = true };
        _passwordBox.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };

        _showPassword = new CheckBox { Text = "Show password", AutoSize = true, Location = new Point(24, 182) };
        _showPassword.CheckedChanged += (s, e) => _passwordBox.UseSystemPasswordChar = !_showPassword.Checked;

        _loginButton = new Button
        {
            Text = "Sign In",
            Location = new Point(24, 210),
            Width = 330,
            Height = 34,
            BackColor = Color.FromArgb(30, 58, 95),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        _loginButton.FlatAppearance.BorderSize = 0;
        _loginButton.Click += async (s, e) => await DoLoginAsync();

        _statusLabel = new Label
        {
            Text = "",
            ForeColor = Color.Firebrick,
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleLeft,
            Location = new Point(24, 246),
            Size = new Size(330, 12),
            Font = new Font("Segoe UI", 8f)
        };

        Controls.AddRange(new Control[]
        {
            title, subtitle, emailLabel, _emailBox, pwLabel, _passwordBox,
            _showPassword, _loginButton, _statusLabel
        });

        AcceptButton = _loginButton;
    }

    private async Task DoLoginAsync()
    {
        var email = _emailBox.Text.Trim();
        var password = _passwordBox.Text;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            _statusLabel.Text = "Please enter your email and password.";
            return;
        }

        _loginButton.Enabled = false;
        _loginButton.Text = "Signing in…";
        _statusLabel.ForeColor = Color.Gray;
        _statusLabel.Text = "Contacting server…";

        try
        {
            var result = await _api.LoginAsync(email, password);
            if (result?.Token != null)
            {
                Result = result;
                DialogResult = DialogResult.OK;
                Close();
            }
            else
            {
                _statusLabel.ForeColor = Color.Firebrick;
                _statusLabel.Text = "Invalid email or password.";
            }
        }
        catch (Exception ex)
        {
            _statusLabel.ForeColor = Color.Firebrick;
            _statusLabel.Text = "Cannot reach the server. Check your connection.";
            System.Diagnostics.Debug.WriteLine(ex);
        }
        finally
        {
            _loginButton.Enabled = true;
            _loginButton.Text = "Sign In";
        }
    }
}
