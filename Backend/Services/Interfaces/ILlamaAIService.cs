namespace ProjectTracker.API.Services.Interfaces
{
    public interface ILlamaAIService
    {
        Task<string> GetCompletionAsync(string prompt, string? systemPrompt = null);
        Task<string> GetRAGCompletionAsync(string query, string context);
        bool IsAvailable { get; }
    }
}
