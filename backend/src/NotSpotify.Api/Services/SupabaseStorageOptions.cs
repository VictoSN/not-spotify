namespace NotSpotify.Api.Services;

public class SupabaseStorageOptions
{
    public string Url { get; set; } = string.Empty;        // https://xxxx.supabase.co
    public string ServiceKey { get; set; } = string.Empty; // service_role secret key
    public string Bucket { get; set; } = "media";          // bucket name (must exist in Supabase)
}
