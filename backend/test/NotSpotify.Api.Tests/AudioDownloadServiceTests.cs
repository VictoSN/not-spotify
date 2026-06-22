using System.Net;
using System.Text;
using Moq;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// <see cref="AudioDownloadService"/> is the server-side read path behind the
/// premium-gated download endpoints. It prefers the storage key (the configured
/// backend), then falls back to HTTP-fetching a legacy/seeded absolute URL.
/// Storage and HTTP are both mocked — no network, no real backend.
/// </summary>
public class AudioDownloadServiceTests
{
    private static AudioDownloadService Make(IStorageService storage, HttpMessageHandler? handler = null)
    {
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>()))
               .Returns(new HttpClient(handler ?? new StubHandler(HttpStatusCode.NotFound)));
        return new AudioDownloadService(storage, factory.Object);
    }

    private static IStorageService StorageReturning(byte[]? bytes)
    {
        var storage = new Mock<IStorageService>();
        storage.Setup(s => s.ReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(bytes);
        return storage.Object;
    }

    [Fact]
    public async Task FetchAsync_FromStorageKey_ReturnsBytesAndInfersContentType()
    {
        var payload = Encoding.UTF8.GetBytes("audio-bytes");
        var svc = Make(StorageReturning(payload));

        var result = await svc.FetchAsync("audio/song.mp3", audioUrl: null);

        Assert.NotNull(result);
        Assert.Equal(payload, result!.Bytes);
        Assert.Equal(".mp3", result.Extension);
        Assert.Equal("audio/mpeg", result.ContentType);
    }

    [Fact]
    public async Task FetchAsync_NoKeyNoUrl_ReturnsNull()
    {
        var svc = Make(StorageReturning(null));

        var result = await svc.FetchAsync(audioKey: null, audioUrl: null);

        Assert.Null(result);
    }

    [Fact]
    public async Task FetchAsync_KeyMissing_FallsBackToHttpUrl()
    {
        var payload = Encoding.UTF8.GetBytes("from-http");
        var handler = new StubHandler(HttpStatusCode.OK, payload, "audio/ogg");
        var svc = Make(StorageReturning(null), handler); // storage miss → HTTP fallback

        var result = await svc.FetchAsync("audio/missing.mp3", "https://cdn.example/song.ogg");

        Assert.NotNull(result);
        Assert.Equal(payload, result!.Bytes);
        Assert.Equal("audio/ogg", result.ContentType);
    }

    [Fact]
    public async Task FetchAsync_HttpError_ReturnsNull()
    {
        var svc = Make(StorageReturning(null), new StubHandler(HttpStatusCode.InternalServerError));

        var result = await svc.FetchAsync(audioKey: null, audioUrl: "https://cdn.example/song.mp3");

        Assert.Null(result);
    }

    [Fact]
    public async Task FetchAsync_NonHttpUrl_ReturnsNullWithoutFetching()
    {
        var svc = Make(StorageReturning(null));

        var result = await svc.FetchAsync(audioKey: null, audioUrl: "file:///etc/passwd");

        Assert.Null(result);
    }

    /// <summary>A minimal HttpMessageHandler that returns a canned response.</summary>
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly byte[] _body;
        private readonly string? _contentType;

        public StubHandler(HttpStatusCode status, byte[]? body = null, string? contentType = null)
        {
            _status = status;
            _body = body ?? Array.Empty<byte>();
            _contentType = contentType;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var response = new HttpResponseMessage(_status) { Content = new ByteArrayContent(_body) };
            if (_contentType is not null)
                response.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(_contentType);
            return Task.FromResult(response);
        }
    }
}
