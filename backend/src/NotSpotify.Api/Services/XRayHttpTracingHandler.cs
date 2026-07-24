using Amazon.XRay.Recorder.Core;

namespace NotSpotify.Api.Services;

/// <summary>
/// Records each outbound <see cref="HttpClient"/> request as an X-Ray "remote"
/// subsegment so external dependencies (Stripe, Ticketmaster, Google OAuth,
/// reCAPTCHA, Resend, the lyrics providers, …) show up as downstream nodes on the
/// service map. Registered once for every IHttpClientFactory client via
/// <see cref="XRayHttpMessageHandlerBuilderFilter"/>.
///
/// Tracing is strictly best-effort: it no-ops when no request-scoped trace is on the
/// context (background jobs, startup) and swallows any recorder error, so it can
/// never change the outcome of the actual HTTP call.
/// </summary>
public sealed class XRayHttpTracingHandler : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var recorder = AWSXRayRecorder.Instance;

        // Only trace when the incoming request's segment is present; outside a request
        // (e.g. TourSyncBackgroundService) there is nothing to attach a subsegment to.
        bool began = false;
        try
        {
            if (recorder.TraceContext.IsEntityPresent())
            {
                recorder.BeginSubsegment(request.RequestUri?.Host ?? "external-http");
                recorder.SetNamespace("remote");
                recorder.AddHttpInformation("request", new Dictionary<string, object>
                {
                    ["url"] = request.RequestUri?.ToString() ?? string.Empty,
                    ["method"] = request.Method.Method,
                });
                began = true;
            }
        }
        catch
        {
            began = false;
        }

        try
        {
            var response = await base.SendAsync(request, cancellationToken);
            if (began)
            {
                try
                {
                    var status = (int)response.StatusCode;
                    recorder.AddHttpInformation("response", new Dictionary<string, object>
                    {
                        ["status"] = status,
                    });
                    if (status is >= 400 and <= 499) recorder.MarkError();
                    else if (status >= 500) recorder.MarkFault();
                }
                catch { /* tracing is best-effort */ }
            }
            return response;
        }
        catch (Exception ex)
        {
            if (began)
            {
                try { recorder.AddException(ex); } catch { /* best-effort */ }
            }
            throw;
        }
        finally
        {
            if (began)
            {
                try { recorder.EndSubsegment(); } catch { /* best-effort */ }
            }
        }
    }
}
