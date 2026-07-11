using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Refresh-token rotation semantics of AuthController.Refresh — in particular the
/// rotation grace window that de-fangs the multi-tab / aborted-reload cookie race.
/// </summary>
public class AuthRefreshTests
{
    private static readonly JwtOptions Jwt = new()
    {
        SigningKey = "unit-test-signing-key-0123456789abcdef",
        Issuer = "test",
        Audience = "test",
    };

    private static AuthController NewController(AppDbContext db)
    {
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.GetRolesAsync(It.IsAny<ApplicationUser>()))
             .ReturnsAsync(new List<string>());

        var config = new ConfigurationBuilder().Build();
        var httpFactory = TestHelpers.NewHttpFactory(new StubHttpMessageHandler(
            _ => new HttpResponseMessage(System.Net.HttpStatusCode.NotFound)));

        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.EnvironmentName).Returns("Production");

        var controller = new AuthController(
            users.Object,
            new TokenService(Jwt),
            new RegistrationVerificationService(Jwt, new Mock<IRegistrationEmailSender>().Object),
            new PasswordResetService(db, Jwt, new Mock<IPasswordResetEmailSender>().Object),
            new CaptchaService(httpFactory, config, NullLogger<CaptchaService>.Instance),
            db,
            Jwt,
            TestHelpers.NewMapper(),
            config,
            env.Object,
            httpFactory,
            NullLogger<AuthController>.Instance);

        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    private static void SendCookie(AuthController controller, string rawToken)
    {
        // Symmetric with production: Response.Cookies.Append escapes the value and
        // Request.Cookies unescapes it on the way back in.
        controller.ControllerContext.HttpContext.Request.Headers["Cookie"] =
            $"rt={Uri.EscapeDataString(rawToken)}";
    }

    private static string SeedToken(
        AppDbContext db,
        Guid userId,
        out string hash,
        DateTime? revokedAt = null,
        string? replacedByHash = null,
        DateTime? expiresAt = null)
    {
        var raw = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        hash = TokenService.HashRefreshToken(raw);
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = hash,
            ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(30),
            RevokedAt = revokedAt,
            ReplacedByTokenHash = replacedByHash,
        });
        db.SaveChanges();
        return raw;
    }

    [Fact]
    public async Task Refresh_WithActiveToken_RotatesAndReturnsAccessToken()
    {
        using var db = TestHelpers.NewDb();
        var user = db.AddUser(Guid.NewGuid(), "alice");
        db.SaveChanges();
        var raw = SeedToken(db, user.Id, out var hash);

        var controller = NewController(db);
        SendCookie(controller, raw);

        var result = await controller.Refresh();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.False(string.IsNullOrEmpty(Assert.IsType<AccessTokenResponse>(ok.Value).AccessToken));

        var old = await db.RefreshTokens.SingleAsync(t => t.TokenHash == hash);
        Assert.NotNull(old.RevokedAt);
        Assert.NotNull(old.ReplacedByTokenHash);
        Assert.True(await db.RefreshTokens.AnyAsync(t => t.TokenHash == old.ReplacedByTokenHash && t.RevokedAt == null));
    }

    [Fact]
    public async Task Refresh_ReplayWithinGrace_IssuesSiblingSessionAndKeepsWinnerAlive()
    {
        using var db = TestHelpers.NewDb();
        var user = db.AddUser(Guid.NewGuid(), "alice");
        db.SaveChanges();
        var raw = SeedToken(db, user.Id, out var hash);

        // First refresh wins the rotation (its Set-Cookie is "lost" by an aborted reload).
        var first = NewController(db);
        SendCookie(first, raw);
        Assert.IsType<OkObjectResult>((await first.Refresh()).Result);
        var winnerHash = (await db.RefreshTokens.SingleAsync(t => t.TokenHash == hash)).ReplacedByTokenHash!;

        // The browser replays the old cookie: must get a session, not a logout.
        var second = NewController(db);
        SendCookie(second, raw);
        var replay = await second.Refresh();

        var ok = Assert.IsType<OkObjectResult>(replay.Result);
        Assert.False(string.IsNullOrEmpty(Assert.IsType<AccessTokenResponse>(ok.Value).AccessToken));

        // The winner's token is untouched, and the replay minted a third (sibling) session.
        Assert.True(await db.RefreshTokens.AnyAsync(t => t.TokenHash == winnerHash && t.RevokedAt == null));
        Assert.Equal(3, await db.RefreshTokens.CountAsync(t => t.UserId == user.Id));
        Assert.Equal(2, await db.RefreshTokens.CountAsync(t => t.UserId == user.Id && t.RevokedAt == null));
    }

    [Fact]
    public async Task Refresh_ReplayOutsideGrace_IsUnauthorizedButKeepsCookie()
    {
        using var db = TestHelpers.NewDb();
        var user = db.AddUser(Guid.NewGuid(), "alice");
        db.SaveChanges();
        var raw = SeedToken(db, user.Id, out _,
            revokedAt: DateTime.UtcNow.AddMinutes(-5),
            replacedByHash: "some-replacement-hash");

        var controller = NewController(db);
        SendCookie(controller, raw);

        var result = await controller.Refresh();

        Assert.IsType<UnauthorizedResult>(result.Result);
        // A stale 401 must never clobber the shared cookie another tab may have refreshed.
        Assert.False(controller.ControllerContext.HttpContext.Response.Headers.ContainsKey("Set-Cookie"));
    }

    [Fact]
    public async Task Refresh_RevokedWithoutReplacement_IsUnauthorized()
    {
        using var db = TestHelpers.NewDb();
        var user = db.AddUser(Guid.NewGuid(), "alice");
        db.SaveChanges();
        // Revoked by logout (no rotation chain): grace must not apply.
        var raw = SeedToken(db, user.Id, out _, revokedAt: DateTime.UtcNow);

        var controller = NewController(db);
        SendCookie(controller, raw);

        Assert.IsType<UnauthorizedResult>((await controller.Refresh()).Result);
    }

    [Fact]
    public async Task Refresh_UnknownToken_IsUnauthorizedAndClearsCookie()
    {
        using var db = TestHelpers.NewDb();
        var controller = NewController(db);
        SendCookie(controller, "never-issued-token");

        var result = await controller.Refresh();

        Assert.IsType<UnauthorizedResult>(result.Result);
        var setCookie = controller.ControllerContext.HttpContext.Response.Headers["Set-Cookie"].ToString();
        Assert.Contains("rt=;", setCookie);
        Assert.Contains("path=/auth", setCookie, StringComparison.OrdinalIgnoreCase);
    }
}
