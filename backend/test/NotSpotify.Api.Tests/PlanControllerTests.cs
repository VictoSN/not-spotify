using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Multi-account plan membership (Duo / Family): invite / accept / decline and
/// seat release. The key invariant is that a member's Premium is kept honest by
/// syncing <c>ApplicationUser.Plan</c>/<c>PlanOwnerId</c> — so every existing
/// premium check keeps working without consulting the membership table.
/// </summary>
public class PlanControllerTests
{
    // UserManager is only consulted on the Invite success path (to nudge an
    // existing account); the flows tested here never touch it, so a bare mock
    // over a stub store is enough.
    private static UserManager<ApplicationUser> MockUserManager()
    {
        var store = new Mock<IUserStore<ApplicationUser>>();
        return new Mock<UserManager<ApplicationUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!).Object;
    }

    private static PlanController NewController(NotSpotify.Api.Data.AppDbContext db, Guid me)
        => new PlanController(db, TestHelpers.NewMapper(), MockUserManager(), TestHelpers.NewNotifications(db))
            .AsUser(me);

    private static ApplicationUser FamilyOwner(Guid id) => new()
    {
        Id = id,
        Name = "owner",
        Email = "owner@test",
        UserName = "owner@test",
        Plan = "premium",
        PlanTier = "family",   // MaxMembers 6 > 1 → sharable
        PlanOwnerId = null,
    };

    private static ApplicationUser FreeUser(Guid id, string email) => new()
    {
        Id = id,
        Name = email,
        Email = email,
        UserName = email,
        Plan = "free",
        PlanTier = "individual",
        PlanOwnerId = null,
    };

    [Fact]
    public async Task Accept_SyncsMemberToPremiumAndActivatesSeat()
    {
        await using var db = TestHelpers.NewDb();
        var ownerId = Guid.NewGuid();
        var meId = Guid.NewGuid();
        db.Users.Add(FamilyOwner(ownerId));
        db.Users.Add(FreeUser(meId, "member@test"));
        var seat = new PlanMembership { OwnerId = ownerId, InvitedEmail = "member@test", Status = "invited" };
        db.PlanMemberships.Add(seat);
        await db.SaveChangesAsync();

        var result = await NewController(db, meId).Accept(seat.Id);

        Assert.IsType<OkObjectResult>(result.Result); // returns the refreshed overview
        var member = db.Users.Single(u => u.Id == meId);
        Assert.Equal("premium", member.Plan);
        Assert.Equal(ownerId, member.PlanOwnerId);
        var updatedSeat = db.PlanMemberships.Single();
        Assert.Equal("active", updatedSeat.Status);
        Assert.Equal(meId, updatedSeat.MemberId);
        Assert.NotNull(updatedSeat.AcceptedAt);
    }

    [Fact]
    public async Task Accept_WhenAlreadyPremium_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var ownerId = Guid.NewGuid();
        var meId = Guid.NewGuid();
        db.Users.Add(FamilyOwner(ownerId));
        var alreadyPremium = FreeUser(meId, "member@test");
        alreadyPremium.Plan = "premium";
        db.Users.Add(alreadyPremium);
        var seat = new PlanMembership { OwnerId = ownerId, InvitedEmail = "member@test", Status = "invited" };
        db.PlanMemberships.Add(seat);
        await db.SaveChangesAsync();

        var result = await NewController(db, meId).Accept(seat.Id);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(db.PlanMemberships.Single().MemberId); // unchanged
    }

    [Fact]
    public async Task Accept_UnknownOrUnaddressedInvite_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var ownerId = Guid.NewGuid();
        var meId = Guid.NewGuid();
        db.Users.Add(FamilyOwner(ownerId));
        db.Users.Add(FreeUser(meId, "member@test"));
        // Invite addressed to someone else.
        db.PlanMemberships.Add(new PlanMembership { OwnerId = ownerId, InvitedEmail = "other@test", Status = "invited" });
        await db.SaveChangesAsync();

        var result = await NewController(db, meId).Accept(db.PlanMemberships.Single().Id);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Decline_RemovesInvite()
    {
        await using var db = TestHelpers.NewDb();
        var ownerId = Guid.NewGuid();
        var meId = Guid.NewGuid();
        db.Users.Add(FamilyOwner(ownerId));
        db.Users.Add(FreeUser(meId, "member@test"));
        var seat = new PlanMembership { OwnerId = ownerId, InvitedEmail = "member@test", Status = "invited" };
        db.PlanMemberships.Add(seat);
        await db.SaveChangesAsync();

        var result = await NewController(db, meId).Decline(seat.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.PlanMemberships);
    }

    [Fact]
    public async Task RemoveOrLeave_ReleasesSeatedMemberBackToFree()
    {
        await using var db = TestHelpers.NewDb();
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        db.Users.Add(FamilyOwner(ownerId));
        var member = FreeUser(memberId, "member@test");
        member.Plan = "premium";          // currently riding the plan
        member.PlanOwnerId = ownerId;
        db.Users.Add(member);
        var seat = new PlanMembership
        {
            OwnerId = ownerId,
            MemberId = memberId,
            InvitedEmail = "member@test",
            Status = "active",
        };
        db.PlanMemberships.Add(seat);
        await db.SaveChangesAsync();

        // Owner removes the seat.
        var result = await NewController(db, ownerId).RemoveOrLeave(seat.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.PlanMemberships);
        var released = db.Users.Single(u => u.Id == memberId);
        Assert.Equal("free", released.Plan);
        Assert.Null(released.PlanOwnerId);
        Assert.Equal("individual", released.PlanTier);
    }

    [Fact]
    public async Task Invite_WhenNotSharableOwner_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var meId = Guid.NewGuid();
        db.Users.Add(FreeUser(meId, "me@test")); // free user can't share seats
        await db.SaveChangesAsync();

        var result = await NewController(db, meId).Invite(new InvitePlanMemberRequest("friend@test"));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(db.PlanMemberships);
    }
}
