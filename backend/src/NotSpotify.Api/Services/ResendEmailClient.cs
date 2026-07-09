using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace NotSpotify.Api.Services;

/// <summary>
/// Thin client over the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email).
/// A single typed <see cref="HttpClient"/> is shared by every email sender; the API key and
/// sender identity come from the <c>Email:Resend</c> configuration section.
/// </summary>
public sealed class ResendEmailClient(HttpClient http, IConfiguration config)
{
    private const string SendEndpoint = "https://api.resend.com/emails";

    private string? ApiKey => config["Email:Resend:ApiKey"];

    /// <summary>True once an API key is present; senders fall back to logging in Development otherwise.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);

    /// <summary>Sends an email through Resend. Throws when the API key or sender address is missing,
    /// or when Resend returns a non-success response.</summary>
    public async Task SendAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string textBody,
        CancellationToken ct = default)
    {
        var apiKey = ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Email:Resend:ApiKey is required to send mail.");

        var fromAddress = config["Email:Resend:FromAddress"];
        if (string.IsNullOrWhiteSpace(fromAddress))
            throw new InvalidOperationException("Email:Resend:FromAddress is required to send mail.");

        var fromName = config["Email:Resend:FromName"] ?? "not-spotify";
        var from = $"{fromName} <{fromAddress}>";

        using var request = new HttpRequestMessage(HttpMethod.Post, SendEndpoint)
        {
            Content = JsonContent.Create(new ResendSendRequest(from, [toEmail], subject, htmlBody, textBody)),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"Resend send failed ({(int)response.StatusCode} {response.ReasonPhrase}): {detail}");
        }
    }

    private sealed record ResendSendRequest(
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string[] To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("html")] string Html,
        [property: JsonPropertyName("text")] string Text);
}
