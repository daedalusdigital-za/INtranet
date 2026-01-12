namespace ProjectTracker.API.Services.Interfaces
{
    public interface IKnowledgeBaseService
    {
        Task<string> SearchKnowledgeBaseAsync(string query);
        Task<List<string>> GetAvailableDocumentsAsync();
        Task<bool> RefreshIndexAsync();
    }
}
