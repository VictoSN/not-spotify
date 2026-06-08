using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace NotSpotify.Api.Services;

public class SupabaseStorageService : IStorageService
{
    private readonly SupabaseStorageOptions _opt;
    private readonly HttpClient _http;

    public SupabaseStorageService(IOptions<SupabaseStorageOptions> opt, IHttpClientFactory factory)
    {
        _opt = opt.Value;
        _http = factory.CreateClient();
    }

    public Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default)
        => Task.FromResult(GetPublicUrl(key));

    public string GetPublicUrl(string key)
    {
        var normalized = key.TrimStart('/');
        return $"{_opt.Url.TrimEnd('/')}/storage/v1/object/public/{_opt.Bucket}/{normalized}";
    }

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var normalized = key.TrimStart('/');
        var url = $"{_opt.Url.TrimEnd('/')}/storage/v1/object/{_opt.Bucket}/{normalized}";

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("apikey", _opt.ServiceKey);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.ServiceKey);
        req.Headers.Add("x-upsert", "true");
        req.Content = new StreamContent(content);
        req.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);

        var res = await _http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Supabase upload failed ({(int)res.StatusCode}): {body}");
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var normalized = key.TrimStart('/');
        var url = $"{_opt.Url.TrimEnd('/')}/storage/v1/object/{_opt.Bucket}/{normalized}";

        using var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.Add("apikey", _opt.ServiceKey);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.ServiceKey);

        await _http.SendAsync(req, ct);
    }
}
