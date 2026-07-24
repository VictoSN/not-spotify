using Microsoft.Extensions.Http;

namespace NotSpotify.Api.Services;

/// <summary>
/// Appends <see cref="XRayHttpTracingHandler"/> to the pipeline of every HttpClient
/// the IHttpClientFactory builds. Registering this one filter traces all outbound HTTP
/// (typed clients like StripeBillingService/TicketmasterService and plain factory
/// clients alike) without editing each individual AddHttpClient call.
/// </summary>
public sealed class XRayHttpMessageHandlerBuilderFilter : IHttpMessageHandlerBuilderFilter
{
    public Action<HttpMessageHandlerBuilder> Configure(Action<HttpMessageHandlerBuilder> next) =>
        builder =>
        {
            next(builder);
            builder.AdditionalHandlers.Add(new XRayHttpTracingHandler());
        };
}
