using System.Text.Json;

namespace NotSpotify.Api.Services;

/// <summary>
/// Google reCAPTCHA v2 ("I'm not a robot" checkbox) verification for the public
/// login/signup endpoints. Enabled only when both keys are configured
/// (Captcha:SiteKey / Captcha:SecretKey); left unconfigured the endpoints behave
/// exactly as before, so existing deployments don't lock anyone out.
/// Development uses Google's public always-pass test key pair.
/// </summary>
public class CaptchaService
{
    private const string VerifyEndpoint = "https://www.google.com/recaptcha/api/siteverify";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<CaptchaService> _logger;

    public CaptchaService(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<CaptchaService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public string? SiteKey => _config["Captcha:SiteKey"];

    private string? SecretKey => _config["Captcha:SecretKey"];

    public bool IsEnabled =>
        !string.Equals(_config["Captcha:Enabled"], "false", StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(SiteKey)
        && !string.IsNullOrWhiteSpace(SecretKey);

    /// <summary>
    /// True when the request may proceed. A missing/invalid token fails; transport
    /// errors reaching Google fail OPEN (with a warning) so an outage on their side
    /// can't lock every user out of login.
    /// </summary>
    public async Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken cancellationToken)
    {
        if (!IsEnabled) return true;
        if (string.IsNullOrWhiteSpace(token)) return false;

        var form = new Dictionary<string, string>
        {
            ["secret"] = SecretKey!,
            ["response"] = token,
        };
        if (!string.IsNullOrWhiteSpace(remoteIp))
            form["remoteip"] = remoteIp;

        try
        {
            var http = _httpClientFactory.CreateClient();
            using var response = await http.PostAsync(VerifyEndpoint, new FormUrlEncodedContent(form), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Captcha] siteverify returned {Status}; allowing request", (int)response.StatusCode);
                return true;
            }

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            return doc.RootElement.TryGetProperty("success", out var success) && success.GetBoolean();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "[Captcha] siteverify unreachable; allowing request");
            return true;
        }
    }
}
