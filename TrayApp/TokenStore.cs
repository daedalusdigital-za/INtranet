using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace IntranetNotifier;

/// <summary>
/// Persists the refresh token (and last user info) encrypted with Windows DPAPI,
/// scoped to the current user. Stored under %AppData%\PromedIntranetNotifier.
/// </summary>
public class StoredSession
{
    public string? RefreshToken { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? Email { get; set; }
}

public static class TokenStore
{
    private static string Dir =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PromedIntranetNotifier");

    private static string FilePath => Path.Combine(Dir, "session.dat");

    public static void Save(StoredSession session)
    {
        try
        {
            Directory.CreateDirectory(Dir);
            var json = JsonSerializer.Serialize(session);
            var plain = Encoding.UTF8.GetBytes(json);
            var encrypted = ProtectedData.Protect(plain, null, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(FilePath, encrypted);
        }
        catch { /* non-fatal */ }
    }

    public static StoredSession? Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return null;
            var encrypted = File.ReadAllBytes(FilePath);
            var plain = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
            var json = Encoding.UTF8.GetString(plain);
            return JsonSerializer.Deserialize<StoredSession>(json);
        }
        catch
        {
            return null;
        }
    }

    public static void Clear()
    {
        try { if (File.Exists(FilePath)) File.Delete(FilePath); } catch { }
    }
}
