using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace NotSpotify.Api.Services;

/// <summary>
/// S3-compatible storage backend (AWS S3 by default; any S3-compatible store via
/// <see cref="S3StorageOptions.ServiceUrl"/>). Audio/image URLs are handed to the
/// browser, while <see cref="ReadAsync"/> pulls
/// bytes server-side for ZIP downloads. Registered as a singleton — <see cref="AmazonS3Client"/>
/// is thread-safe and intended to be reused.
/// </summary>
public class S3StorageService : IStorageService
{
    private readonly S3StorageOptions _opt;
    private readonly IAmazonS3 _s3;

    public S3StorageService(IOptions<S3StorageOptions> opt)
    {
        _opt = opt.Value;

        var config = new AmazonS3Config();
        if (!string.IsNullOrWhiteSpace(_opt.ServiceUrl))
        {
            config.ServiceURL = _opt.ServiceUrl;
            config.ForcePathStyle = _opt.ForcePathStyle;
        }
        else
        {
            config.RegionEndpoint = RegionEndpoint.GetBySystemName(_opt.Region);
        }

        _s3 = string.IsNullOrWhiteSpace(_opt.AccessKeyId)
            ? new AmazonS3Client(config)                                                              // IAM role / env / instance profile
            : !string.IsNullOrWhiteSpace(_opt.SessionToken)
                ? new AmazonS3Client(_opt.AccessKeyId, _opt.SecretAccessKey, _opt.SessionToken, config) // temporary creds (AWS Academy)
                : new AmazonS3Client(_opt.AccessKeyId, _opt.SecretAccessKey, config);                    // permanent IAM-user key
    }

    public Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default)
        => Task.FromResult(BuildUrl(key));

    public string GetPublicUrl(string key) => BuildUrl(key);

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        // The SDK needs a seekable stream to compute the payload signature/length.
        Stream body = content;
        MemoryStream? buffer = null;
        if (!content.CanSeek)
        {
            buffer = new MemoryStream();
            await content.CopyToAsync(buffer, ct);
            buffer.Position = 0;
            body = buffer;
        }

        try
        {
            await _s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _opt.BucketName,
                Key = Normalize(key),
                InputStream = body,
                ContentType = contentType,
                AutoCloseStream = false,
            }, ct);
        }
        finally
        {
            buffer?.Dispose();
        }
    }

    /// <summary>
    /// Apply a CORS policy that lets browsers read the bucket's objects cross-origin.
    /// The frontend extracts the dominant colour of covers/banners/avatars client-side
    /// (node-vibrant draws the image to a &lt;canvas&gt; and reads its pixels) to drive the
    /// Spotify-style gradient hues. That canvas read is blocked by the same-origin policy
    /// unless the image response carries <c>Access-Control-Allow-Origin</c> — without this
    /// the gradients silently fall back to grey on every page.
    /// <para>
    /// It also allows the browser to POST a file directly to the bucket using a presigned
    /// POST from the uploads Lambda (docs/aws-lambda-setup.md). Without that second rule
    /// the preflight fails and every direct upload dies before a byte is sent.
    /// </para>
    /// <para>
    /// Idempotent, but note <c>PutCORSConfiguration</c> REPLACES the bucket's entire
    /// configuration — any rule added by hand in the console is wiped the next time this
    /// runs. Add rules here, not there.
    /// </para>
    /// </summary>
    /// <param name="uploadOrigins">
    /// Origins allowed to POST an upload. Unlike the read rule this cannot be "*": the
    /// presigned POST carries a policy and signature, so it is scoped to the real app
    /// origins. Falls back to the production web origins when nothing is passed.
    /// </param>
    public async Task EnsureBrowserCorsAsync(IEnumerable<string>? uploadOrigins = null, CancellationToken ct = default)
    {
        var origins = (uploadOrigins ?? []).Where(o => !string.IsNullOrWhiteSpace(o)).Distinct().ToList();
        if (origins.Count == 0)
            origins = ["https://not-spotify.lol", "https://www.not-spotify.lol", "http://localhost:5173"];

        await _s3.PutCORSConfigurationAsync(new PutCORSConfigurationRequest
        {
            BucketName = _opt.BucketName,
            Configuration = new CORSConfiguration
            {
                Rules =
                [
                    new CORSRule
                    {
                        // Images only ever need read; node-vibrant requests them anonymously
                        // (crossOrigin="anonymous"), so a "*" origin is safe and dodges the
                        // dev/prod origin-list drift (Vite hops 5173→5174 when a port is busy).
                        AllowedMethods = ["GET", "HEAD"],
                        AllowedOrigins = ["*"],
                        AllowedHeaders = ["*"],
                        // Range headers must stay exposed: premium offline audio fetches
                        // tracks from JS and reads these to drive Range-aware playback.
                        // They are not CORS-safelisted, so dropping them here silently
                        // breaks seeking/offline download while ordinary playback (which
                        // the <audio> element handles natively) keeps working.
                        ExposeHeaders = ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
                        MaxAgeSeconds = 3600,
                    },
                    new CORSRule
                    {
                        // Direct-to-S3 personal uploads. POST is the presigned-POST form
                        // submit; PUT is here so switching to a presigned PUT later doesn't
                        // need another CORS round-trip through an admin.
                        AllowedMethods = ["POST", "PUT"],
                        AllowedOrigins = origins,
                        AllowedHeaders = ["*"],
                        // The browser needs to read ETag/Location off the response to know
                        // the object landed; they are not CORS-safelisted by default.
                        ExposeHeaders = ["ETag", "Location"],
                        MaxAgeSeconds = 3600,
                    },
                ],
            },
        }, ct);
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        await _s3.DeleteObjectAsync(new DeleteObjectRequest
        {
            BucketName = _opt.BucketName,
            Key = Normalize(key),
        }, ct);
    }

    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct = default)
    {
        try
        {
            using var res = await _s3.GetObjectAsync(new GetObjectRequest
            {
                BucketName = _opt.BucketName,
                Key = Normalize(key),
            }, ct);

            using var ms = new MemoryStream();
            await res.ResponseStream.CopyToAsync(ms, ct);
            return ms.ToArray();
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<long?> GetSizeAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var res = await _s3.GetObjectMetadataAsync(new GetObjectMetadataRequest
            {
                BucketName = _opt.BucketName,
                Key = Normalize(key),
            }, ct);
            return res.ContentLength;
        }
        // A HEAD on a missing key returns a bare 404 with no error code, so the usual
        // ex.ErrorCode == "NoSuchKey" check never fires here — match on the status only.
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    private string BuildUrl(string key)
    {
        var normalized = Normalize(key);

        if (_opt.UsePresignedUrls)
        {
            return _s3.GetPreSignedURL(new GetPreSignedUrlRequest
            {
                BucketName = _opt.BucketName,
                Key = normalized,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.AddMinutes(_opt.PresignedUrlExpiryMinutes),
            });
        }

        // Public-read bucket: build the plain object URL.
        if (!string.IsNullOrWhiteSpace(_opt.ServiceUrl))
            return $"{_opt.ServiceUrl.TrimEnd('/')}/{_opt.BucketName}/{normalized}";

        return $"https://{_opt.BucketName}.s3.{_opt.Region}.amazonaws.com/{normalized}";
    }

    private static string Normalize(string key) => key.Replace('\\', '/').TrimStart('/');
}
