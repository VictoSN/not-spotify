namespace NotSpotify.Api.Services;

public interface IStorageService
{
    Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default);
    string GetPublicUrl(string key);
    Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// Reads a stored object's bytes directly (disk for local storage, authed
    /// fetch for remote storage). Returns null if the object doesn't exist. Server-side
    /// consumers (e.g. track/album/playlist downloads) must use this instead of HTTP-fetching
    /// GetPublicUrl — public URLs are built for browsers and may not be
    /// reachable from the server itself.
    /// </summary>
    Task<byte[]?> ReadAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// Size in bytes of a stored object, or null if it doesn't exist. Cheap: a HEAD on
    /// remote storage, not a download. Used to confirm an object the *client* uploaded
    /// (via a presigned URL) really landed before a DB row is created for it — never
    /// trust the browser's word that an upload succeeded.
    /// </summary>
    Task<long?> GetSizeAsync(string key, CancellationToken ct = default);
}
