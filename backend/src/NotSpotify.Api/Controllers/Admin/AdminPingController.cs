using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin")]
[Authorize(Roles = "Admin")]
public class AdminPingController : ControllerBase
{
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true });
}
