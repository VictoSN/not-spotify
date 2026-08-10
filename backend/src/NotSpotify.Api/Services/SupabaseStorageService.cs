using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace NotSpotify.Api.Services;

/// <summary>
/// Supabase Storage adapter for the local branch. It uses the Storage REST API directly.
/// </summary>
public sealed class SupabaseStorageService : IStorageService
{
    private readonly SupabaseStorageOptions _options;
    private readonly HttpClient _http;

    public SupabaseStorageService(IOptions<SupabaseStorageOptions> options, HttpClient http)
    {
        _options = options.Value;
        _http = http;
    }

    public Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default)
        => Task.FromResult(GetPublicUrl(key));

    public string GetPublicUrl(string key)
    {
        var normalized = Normalize(key);
        return $"{StorageBaseUrl}/object/public/{EscapeSegment(_options.BucketName)}/{EscapeKey(normalized)}";
    }

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        using var request = CreateRequest(HttpMethod.Post, ObjectUri(key));
        request.Headers.Add("x-upsert", "true");

        var body = new StreamContent(new NonDisposingStream(content));
        body.Headers.ContentType = MediaTypeHeaderValue.Parse(
            string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);
        request.Content = body;

        try
        {
            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            await EnsureSuccessAsync(response, "upload", ct);
        }
        finally
        {
            // The caller owns the stream. HttpRequestMessage.Dispose would otherwise
            // close an IFormFile stream before the caller's using scope finishes.
            request.Content = null;
            body.Dispose();
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        using var request = CreateRequest(HttpMethod.Delete, $"{StorageBaseUrl}/object/{EscapeSegment(_options.BucketName)}");
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { prefixes = new[] { Normalize(key) } }),
            Encoding.UTF8,
            "application/json");

        using var response = await _http.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return;
        await EnsureSuccessAsync(response, "delete", ct);
    }

    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct = default)
    {
        using var request = CreateRequest(HttpMethod.Get, ObjectUri(key));
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;

        await EnsureSuccessAsync(response, "read", ct);
        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task<long?> GetSizeAsync(string key, CancellationToken ct = default)
    {
        using var request = CreateRequest(HttpMethod.Head, ObjectUri(key));
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;

        await EnsureSuccessAsync(response, "inspect", ct);
        return response.Content.Headers.ContentLength;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string uri)
    {
        var request = new HttpRequestMessage(method, uri);
        var serviceKey = RequireServiceRoleKey();
        request.Headers.Add("apikey", serviceKey);
        // New Supabase secret keys are not JWTs and must not be sent as Bearer tokens.
        // Keep the Authorization header for legacy service_role JWTs.
        if (!serviceKey.StartsWith("sb_secret_", StringComparison.OrdinalIgnoreCase))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", serviceKey);
        return request;
    }

    private string ObjectUri(string key)
        => $"{StorageBaseUrl}/object/{EscapeSegment(_options.BucketName)}/{EscapeKey(Normalize(key))}";

    private string StorageBaseUrl => $"{_options.ProjectUrl.TrimEnd('/')}/storage/v1";

    private string RequireServiceRoleKey()
    {
        if (string.IsNullOrWhiteSpace(_options.ServiceRoleKey))
            throw new InvalidOperationException(
                "SupabaseStorage:ServiceRoleKey is missing. Set it with dotnet user-secrets.");

        return _options.ServiceRoleKey;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, string operation, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;

        var detail = await response.Content.ReadAsStringAsync(ct);
        if (detail.Length > 500) detail = detail[..500];
        throw new HttpRequestException(
            $"Supabase Storage {operation} failed ({(int)response.StatusCode}): {detail}");
    }

    private static string Normalize(string key)
    {
        var normalized = key.Replace('\\', '/').Trim().Trim('/');
        if (string.IsNullOrWhiteSpace(normalized))
            throw new ArgumentException("Storage key is required.", nameof(key));

        if (normalized.Split('/').Any(part => part is "." or ".."))
            throw new ArgumentException("Storage key contains an invalid path segment.", nameof(key));

        return normalized;
    }

    private static string EscapeKey(string key)
        => string.Join('/', key.Split('/').Select(EscapeSegment));

    private static string EscapeSegment(string value) => Uri.EscapeDataString(value);

    private sealed class NonDisposingStream(Stream inner) : Stream
    {
        public override bool CanRead => inner.CanRead;
        public override bool CanSeek => inner.CanSeek;
        public override bool CanWrite => inner.CanWrite;
        public override long Length => inner.Length;
        public override long Position
        {
            get => inner.Position;
            set => inner.Position = value;
        }

        public override void Flush() => inner.Flush();
        public override Task FlushAsync(CancellationToken cancellationToken) => inner.FlushAsync(cancellationToken);
        public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
        public override int Read(Span<byte> buffer) => inner.Read(buffer);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => inner.ReadAsync(buffer, offset, count, cancellationToken);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
            => inner.ReadAsync(buffer, cancellationToken);
        public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);
        public override void SetLength(long value) => inner.SetLength(value);
        public override void Write(byte[] buffer, int offset, int count) => inner.Write(buffer, offset, count);
        public override void Write(ReadOnlySpan<byte> buffer) => inner.Write(buffer);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => inner.WriteAsync(buffer, offset, count, cancellationToken);
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
            => inner.WriteAsync(buffer, cancellationToken);

        protected override void Dispose(bool disposing)
        {
            // The stream belongs to the caller of UploadAsync.
        }
    }
}
