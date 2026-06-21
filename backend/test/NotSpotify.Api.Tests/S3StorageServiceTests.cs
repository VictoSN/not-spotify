using Microsoft.Extensions.Options;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class S3StorageServiceTests
{
    private static S3StorageService Make(S3StorageOptions opt) => new(Options.Create(opt));

    [Fact]
    public void GetPublicUrl_Aws_BuildsVirtualHostedUrl_AndTrimsLeadingSlash()
    {
        var svc = Make(new S3StorageOptions
        {
            BucketName = "not-spotify-media",
            Region = "ap-southeast-1",
            AccessKeyId = "AKIATEST",
            SecretAccessKey = "secret",
            UsePresignedUrls = false,
        });

        Assert.Equal(
            "https://not-spotify-media.s3.ap-southeast-1.amazonaws.com/audio/abc.mp3",
            svc.GetPublicUrl("/audio/abc.mp3"));
    }

    [Fact]
    public void GetPublicUrl_CustomEndpoint_BuildsPathStyleUrl_AndNormalizesBackslashes()
    {
        var svc = Make(new S3StorageOptions
        {
            BucketName = "media",
            ServiceUrl = "https://acct.r2.cloudflarestorage.com/",
            ForcePathStyle = true,
            AccessKeyId = "k",
            SecretAccessKey = "s",
            UsePresignedUrls = false,
        });

        Assert.Equal(
            "https://acct.r2.cloudflarestorage.com/media/covers/x.png",
            svc.GetPublicUrl("covers\\x.png"));
    }

    [Fact]
    public async Task GetAudioUrlAsync_Presigned_IsSignedTimeLimitedAndReferencesObject()
    {
        var svc = Make(new S3StorageOptions
        {
            BucketName = "media",
            Region = "us-east-1",
            AccessKeyId = "AKIATEST",
            SecretAccessKey = "secret",
            UsePresignedUrls = true,
        });

        var url = await svc.GetAudioUrlAsync("audio/song.mp3");

        Assert.Contains("media", url);            // bucket
        Assert.Contains("audio/song.mp3", url);   // object key
        Assert.Contains("Signature", url);        // signed (SigV2 "Signature" or SigV4 "X-Amz-Signature")
        Assert.Contains("Expires", url);          // time-limited (presigned), not a bare public URL
    }
}
