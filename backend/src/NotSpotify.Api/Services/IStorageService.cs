namespace NotSpotify.Api.Services;

public interface IStorageService
{
    Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default);
    string GetPublicUrl(string key);
    Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
}
