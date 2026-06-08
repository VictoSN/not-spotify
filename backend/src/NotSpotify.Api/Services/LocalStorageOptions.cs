namespace NotSpotify.Api.Services;

public class LocalStorageOptions
{
    public string RootPath { get; set; } = "wwwroot/uploads";
    public string PublicBaseUrl { get; set; } = "http://localhost:5080";
    public string PublicUrlPrefix { get; set; } = "/uploads";
}
