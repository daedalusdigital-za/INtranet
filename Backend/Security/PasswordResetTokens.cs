using System.Security.Cryptography;
using System.Text;

namespace ProjectTracker.API.Security
{
    /// <summary>
    /// Self-service password-reset tokens for intranet users. The raw token only ever travels in the
    /// emailed link; the database keeps its SHA-256 hash, so a database read cannot be turned into a
    /// working reset link.
    /// </summary>
    public static class PasswordResetTokens
    {
        /// <summary>How long an emailed link stays valid.</summary>
        public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

        public static (string Token, string Hash) Create()
        {
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            return (token, Hash(token));
        }

        public static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim().ToLowerInvariant()))).ToLowerInvariant();
    }
}
