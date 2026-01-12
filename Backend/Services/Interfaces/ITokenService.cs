using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services.Interfaces
{
    public interface ITokenService
    {
        string GenerateToken(User user);
    }
}
