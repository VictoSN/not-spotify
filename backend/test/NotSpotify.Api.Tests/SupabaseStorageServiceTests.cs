using System.Net;
using Microsoft.Extensions.Options;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public sealed class SupabaseStorageServiceTests
{
    private static SupabaseStorageService Make(RecordingHandler handler, string serviceKey = "service-key") =>
        new(
            Options.Create(new SupabaseStorageOptions
            {
                ProjectUrl = "https://project.supabase.co",
                BucketName = "media",
                ServiceRoleKey = serviceKey,
            }),
            new HttpClient(handler));

    [Fact]
    public void GetPublicUrl_BuildsSupabasePublicObjectUrl()
    {
        var service = Make(new RecordingHandler(HttpStatusCode.OK));

        var url = service.GetPublicUrl("/covers/space name.png");

        Assert.Equal(
            "https://project.supabase.co/storage/v1/object/public/media/covers/space%20name.png",
            url);
    }

    [Fact]
    public async Task UploadAsync_SendsBinaryBodyAndServiceHeaders()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = Make(handler);
        await using var source = new MemoryStream("audio-bytes"u8.ToArray());

        await service.UploadAsync("audio/song.mp3", source, "audio/mpeg");

        Assert.Equal(HttpMethod.Post, handler.Method);
        Assert.Equal(
            "https://project.supabase.co/storage/v1/object/media/audio/song.mp3",
            handler.RequestUri?.ToString());
        Assert.Equal("true", handler.Headers["x-upsert"]);
        Assert.Equal("service-key", handler.Headers["apikey"]);
        Assert.Equal("Bearer service-key", handler.Headers["Authorization"]);
        Assert.Equal("audio-bytes", handler.Body);
        Assert.True(source.CanRead);
    }

    [Fact]
    public async Task ReadAsync_ReturnsNullForMissingObject()
    {
        var service = Make(new RecordingHandler(HttpStatusCode.NotFound));

        var bytes = await service.ReadAsync("audio/missing.mp3");

        Assert.Null(bytes);
    }

    [Fact]
    public async Task GetSizeAsync_ReturnsContentLength()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        handler.ResponseContentLength = 1234;
        var service = Make(handler);

        var size = await service.GetSizeAsync("audio/song.mp3");

        Assert.Equal(1234, size);
        Assert.Equal(HttpMethod.Head, handler.Method);
    }

    [Fact]
    public async Task DeleteAsync_SendsPrefixDeleteRequest()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = Make(handler);

        await service.DeleteAsync("covers/old.png");

        Assert.Equal(HttpMethod.Delete, handler.Method);
        Assert.Equal(
            "https://project.supabase.co/storage/v1/object/media",
            handler.RequestUri?.ToString());
        Assert.Contains("covers/old.png", handler.Body);
    }

    [Fact]
    public async Task NewSecretKey_UsesApiKeyHeaderWithoutBearerToken()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = Make(handler, "sb_secret_test");

        await service.ReadAsync("audio/song.mp3");

        Assert.Equal("sb_secret_test", handler.Headers["apikey"]);
        Assert.False(handler.Headers.ContainsKey("Authorization"));
    }

    private sealed class RecordingHandler(HttpStatusCode status) : HttpMessageHandler
    {
        private readonly HttpStatusCode _status = status;

        public HttpMethod? Method { get; private set; }
        public Uri? RequestUri { get; private set; }
        public string Body { get; private set; } = string.Empty;
        public Dictionary<string, string> Headers { get; } = new(StringComparer.OrdinalIgnoreCase);
        public long? ResponseContentLength { get; set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Method = request.Method;
            RequestUri = request.RequestUri;
            foreach (var header in request.Headers)
                Headers[header.Key] = string.Join(",", header.Value);
            if (request.Content is not null)
            {
                foreach (var header in request.Content.Headers)
                    Headers[header.Key] = string.Join(",", header.Value);
                Body = await request.Content.ReadAsStringAsync(cancellationToken);
            }

            var response = new HttpResponseMessage(_status)
            {
                Content = new ByteArrayContent(Array.Empty<byte>()),
            };
            if (ResponseContentLength is long length)
                response.Content.Headers.ContentLength = length;
            return response;
        }
    }
}
