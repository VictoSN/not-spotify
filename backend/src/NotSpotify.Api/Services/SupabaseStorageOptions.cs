namespace NotSpotify.Api.Services;

public sealed class SupabaseStorageOptions
{
    public string ProjectUrl { get; set; } = string.Empty;
    public string BucketName { get; set; } = "not-spotify-media";
    public string ServiceRoleKey { get; set; } = string.Empty;
}
