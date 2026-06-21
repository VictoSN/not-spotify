namespace NotSpotify.Api.Services;

/// <summary>
/// Configuration for the S3-compatible storage backend. Defaults target AWS S3;
/// set <see cref="ServiceUrl"/> to point the same adapter at any S3-compatible
/// store (Cloudflare R2, Backblaze B2, MinIO) with no code change.
/// </summary>
public class S3StorageOptions
{
    /// <summary>Bucket the catalogue/media live in. Selecting this provider keys off it being non-empty.</summary>
    public string BucketName { get; set; } = string.Empty;

    /// <summary>AWS region (ignored when <see cref="ServiceUrl"/> is set). e.g. "ap-southeast-1".</summary>
    public string Region { get; set; } = "us-east-1";

    /// <summary>
    /// Access key. Leave empty to use the AWS default credential chain
    /// (IAM role / instance profile / environment) when deployed on AWS.
    /// </summary>
    public string AccessKeyId { get; set; } = string.Empty;

    /// <summary>Secret key. Pair with <see cref="AccessKeyId"/>; leave empty for the default chain.</summary>
    public string SecretAccessKey { get; set; } = string.Empty;

    /// <summary>
    /// Custom S3-compatible endpoint (e.g. https://&lt;account&gt;.r2.cloudflarestorage.com).
    /// Leave empty for real AWS S3 — then <see cref="Region"/> is used instead.
    /// </summary>
    public string? ServiceUrl { get; set; }

    /// <summary>Path-style addressing (bucket in the path, not the host). Often required by R2/B2/MinIO.</summary>
    public bool ForcePathStyle { get; set; }

    /// <summary>
    /// When true, public/audio URLs are time-limited presigned GET URLs so the
    /// bucket can stay private (recommended). When false, return the plain public
    /// object URL — the bucket must then have a public-read policy.
    /// </summary>
    public bool UsePresignedUrls { get; set; } = true;

    /// <summary>Presigned URL lifetime in minutes. Must comfortably outlast a play/listening session.</summary>
    public int PresignedUrlExpiryMinutes { get; set; } = 720; // 12h
}
