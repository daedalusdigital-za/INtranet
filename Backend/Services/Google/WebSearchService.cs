using System.Text.Json;
using System.Web;

namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Web Search Service using SearXNG (self-hosted meta search engine)
    /// No API keys, no billing, no rate limits - runs locally in Docker
    /// Aggregates results from Google, Bing, DuckDuckGo, Wikipedia, etc.
    /// </summary>
    public class WebSearchService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<WebSearchService> _logger;
        private readonly IConfiguration _configuration;

        public WebSearchService(
            IHttpClientFactory httpClientFactory,
            ILogger<WebSearchService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClientFactory.CreateClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(15);
            _logger = logger;
            _configuration = configuration;
        }

        #region DTOs

        public class SearchResult
        {
            public bool Success { get; set; }
            public string Query { get; set; } = "";
            public int TotalResults { get; set; }
            public List<SearchItem> Items { get; set; } = new();
            public string? Error { get; set; }
        }

        public class SearchItem
        {
            public string Title { get; set; } = "";
            public string Snippet { get; set; } = "";
            public string Url { get; set; } = "";
            public string? DisplayUrl { get; set; }
        }

        #endregion

        /// <summary>
        /// Search the web using self-hosted SearXNG instance
        /// </summary>
        /// <param name="query">The search query</param>
        /// <param name="numResults">Number of results to return (1-10, default 5)</param>
        /// <returns>Search results with titles, snippets, and URLs</returns>
        public async Task<SearchResult> SearchAsync(string query, int numResults = 5)
        {
            try
            {
                var baseUrl = _configuration["SearXNG:BaseUrl"] ?? "http://localhost:8888";
                numResults = Math.Clamp(numResults, 1, 10);

                // SearXNG JSON API endpoint
                var url = $"{baseUrl}/search?q={HttpUtility.UrlEncode(query)}&format=json&categories=general&language=en&pageno=1";

                _logger.LogInformation("SearXNG search: \"{Query}\" (requesting {Num} results)", query, numResults);

                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("Accept", "application/json");

                var response = await _httpClient.SendAsync(request);
                var json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("SearXNG API error {Status}: {Body}",
                        response.StatusCode, json.Length > 500 ? json[..500] : json);

                    return new SearchResult
                    {
                        Success = false,
                        Query = query,
                        Error = $"Search returned {(int)response.StatusCode}: {response.ReasonPhrase}"
                    };
                }

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // Parse result items from SearXNG response
                var items = new List<SearchItem>();
                if (root.TryGetProperty("results", out var resultsEl))
                {
                    foreach (var item in resultsEl.EnumerateArray())
                    {
                        if (items.Count >= numResults) break;

                        var title = item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                        var snippet = item.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
                        var link = item.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";

                        // Skip empty results
                        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(snippet))
                            continue;

                        // Clean up snippet
                        snippet = snippet.Replace("\n", " ").Replace("\r", "").Trim();
                        if (snippet.Length > 300)
                            snippet = snippet[..297] + "...";

                        // Extract display URL from full URL
                        string? displayUrl = null;
                        try
                        {
                            if (!string.IsNullOrEmpty(link))
                                displayUrl = new Uri(link).Host;
                        }
                        catch { /* ignore parse errors */ }

                        items.Add(new SearchItem
                        {
                            Title = title,
                            Snippet = snippet,
                            Url = link,
                            DisplayUrl = displayUrl
                        });
                    }
                }

                // Get total results count
                var totalResults = items.Count;
                if (root.TryGetProperty("number_of_results", out var numEl))
                {
                    if (numEl.ValueKind == JsonValueKind.Number)
                        totalResults = numEl.GetInt32();
                }

                _logger.LogInformation("SearXNG search for \"{Query}\" returned {Count} results",
                    query, items.Count);

                if (items.Count == 0)
                {
                    return new SearchResult
                    {
                        Success = true,
                        Query = query,
                        TotalResults = 0,
                        Items = items,
                        Error = "No results found. Try different search terms."
                    };
                }

                return new SearchResult
                {
                    Success = true,
                    Query = query,
                    TotalResults = totalResults,
                    Items = items
                };
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("SearXNG search timed out for \"{Query}\"", query);
                return new SearchResult
                {
                    Success = false,
                    Query = query,
                    Error = "Search request timed out. Please try again."
                };
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "SearXNG connection failed for \"{Query}\"", query);
                return new SearchResult
                {
                    Success = false,
                    Query = query,
                    Error = "Search engine is not reachable. It may still be starting up."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SearXNG search failed for \"{Query}\"", query);
                return new SearchResult
                {
                    Success = false,
                    Query = query,
                    Error = $"Search failed: {ex.Message}"
                };
            }
        }
    }
}
