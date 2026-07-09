namespace NotSpotify.Api.Services;

/// <summary>Minimal, inline-styled HTML email bodies. Kept table/inline-CSS based so they
/// render consistently across mail clients (which strip &lt;style&gt; blocks and flexbox).</summary>
public static class EmailTemplates
{
    /// <summary>A branded email centred on a large one-time code.</summary>
    /// <param name="heading">Short title shown above the intro line.</param>
    /// <param name="intro">Pre-escaped HTML introductory sentence.</param>
    /// <param name="code">The 6-digit code (rendered verbatim).</param>
    /// <param name="footer">Pre-escaped HTML footer/expiry note (may contain markup such as links).</param>
    public static string OtpCode(string heading, string intro, string code, string footer) => $"""
        <!doctype html>
        <html>
          <body style="margin:0;padding:0;background:#121212;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121212;padding:32px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#181818;border-radius:12px;overflow:hidden;">
                    <tr>
                      <td style="padding:28px 32px 8px;">
                        <div style="color:#1db954;font-size:20px;font-weight:700;letter-spacing:-0.5px;">not-spotify</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 32px 0;">
                        <h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">{heading}</h1>
                        <p style="color:#b3b3b3;font-size:15px;line-height:1.5;margin:0 0 24px;">{intro}</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:0 32px;">
                        <div style="display:inline-block;background:#282828;border-radius:10px;padding:18px 28px;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:10px;">{code}</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 32px 32px;">
                        <p style="color:#727272;font-size:13px;line-height:1.6;margin:0;">{footer}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """;
}
