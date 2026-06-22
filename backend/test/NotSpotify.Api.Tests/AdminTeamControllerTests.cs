using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NotSpotify.Api.Controllers.Admin;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// RBAC: admin grant/revoke and the <see cref="PendingAction"/> approval queue.
/// A master executes directly; a regular admin's request is enqueued for a master
/// to approve (which runs it) or reject. UserManager is mocked.
/// </summary>
public class AdminTeamControllerTests
{
    private static AdminTeamController NewController(
        AppDbContext db, Mock<UserManager<ApplicationUser>> users, Guid me, params string[] roles)
        => new AdminTeamController(db, users.Object, TestHelpers.NewMapper(), TestHelpers.NewNotifications(db))
            .AsUser(me, roles);

    private static ApplicationUser TargetUser(Guid id)
        => new() { Id = id, Name = "target", Email = "target@test", UserName = "target@test" };

    [Fact]
    public async Task Grant_UnknownEmail_ReturnsNotFound()
    {
        await using var db = TestHelpers.NewDb();
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((ApplicationUser?)null);
        var controller = NewController(db, users, Guid.NewGuid(), "Admin", "Master");

        var result = await controller.Grant(new GrantAdminRequest("nobody@test"));

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Grant_AlreadyAdmin_ReturnsConflict()
    {
        await using var db = TestHelpers.NewDb();
        var target = TargetUser(Guid.NewGuid());
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(target);
        users.Setup(u => u.IsInRoleAsync(target, DbSeeder.AdminRole)).ReturnsAsync(true);
        var controller = NewController(db, users, Guid.NewGuid(), "Admin", "Master");

        var result = await controller.Grant(new GrantAdminRequest("target@test"));

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Grant_ByRegularAdmin_EnqueuesPendingAction()
    {
        await using var db = TestHelpers.NewDb();
        var target = TargetUser(Guid.NewGuid());
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(target);
        users.Setup(u => u.IsInRoleAsync(target, DbSeeder.AdminRole)).ReturnsAsync(false);
        var meId = Guid.NewGuid();
        var controller = NewController(db, users, meId, "Admin"); // not a master

        var result = await controller.Grant(new GrantAdminRequest("target@test"));

        Assert.IsType<AcceptedResult>(result);
        var pending = Assert.Single(db.PendingActions);
        Assert.Equal("grant-admin", pending.ActionType);
        Assert.Equal(target.Id, pending.TargetUserId);
        Assert.Equal("pending", pending.Status);
        Assert.Equal(meId, pending.RequestedByUserId);
        users.Verify(u => u.AddToRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Grant_ByMaster_ExecutesImmediately()
    {
        await using var db = TestHelpers.NewDb();
        var target = TargetUser(Guid.NewGuid());
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(target);
        users.Setup(u => u.IsInRoleAsync(target, DbSeeder.AdminRole)).ReturnsAsync(false);
        users.Setup(u => u.IsInRoleAsync(target, DbSeeder.MasterRole)).ReturnsAsync(false);
        users.Setup(u => u.AddToRoleAsync(target, DbSeeder.AdminRole)).ReturnsAsync(IdentityResult.Success);
        var controller = NewController(db, users, Guid.NewGuid(), "Admin", "Master");

        var result = await controller.Grant(new GrantAdminRequest("target@test"));

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(db.PendingActions); // executed, not enqueued
        users.Verify(u => u.AddToRoleAsync(target, DbSeeder.AdminRole), Times.Once);
    }

    [Fact]
    public async Task Revoke_Master_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var target = TargetUser(Guid.NewGuid());
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByIdAsync(target.Id.ToString())).ReturnsAsync(target);
        users.Setup(u => u.IsInRoleAsync(target, DbSeeder.MasterRole)).ReturnsAsync(true);
        var controller = NewController(db, users, Guid.NewGuid(), "Admin", "Master");

        var result = await controller.Revoke(target.Id);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Revoke_Self_ReturnsBadRequest()
    {
        await using var db = TestHelpers.NewDb();
        var meId = Guid.NewGuid();
        var me = TargetUser(meId);
        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByIdAsync(meId.ToString())).ReturnsAsync(me);
        users.Setup(u => u.IsInRoleAsync(me, DbSeeder.MasterRole)).ReturnsAsync(false);
        users.Setup(u => u.IsInRoleAsync(me, DbSeeder.AdminRole)).ReturnsAsync(true);
        var controller = NewController(db, users, meId, "Admin", "Master");

        var result = await controller.Revoke(meId);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Approve_ByNonMaster_ReturnsForbid()
    {
        await using var db = TestHelpers.NewDb();
        var users = TestHelpers.MockUserManager();
        var controller = NewController(db, users, Guid.NewGuid(), "Admin"); // not master

        var result = await controller.Approve(Guid.NewGuid(), new ReviewActionRequest(null));

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task Reject_AlreadyProcessed_ReturnsConflict()
    {
        await using var db = TestHelpers.NewDb();
        var action = new PendingAction { ActionType = "grant-admin", TargetUserId = Guid.NewGuid(), Status = "approved" };
        db.PendingActions.Add(action);
        await db.SaveChangesAsync();
        var users = TestHelpers.MockUserManager();
        var controller = NewController(db, users, Guid.NewGuid(), "Admin", "Master");

        var result = await controller.Reject(action.Id, new ReviewActionRequest("late"));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Approve_RunsActionAndStampsApproved()
    {
        await using var db = TestHelpers.NewDb();
        var target = TargetUser(Guid.NewGuid());
        var action = new PendingAction { ActionType = "grant-admin", TargetUserId = target.Id, Status = "pending" };
        db.PendingActions.Add(action);
        await db.SaveChangesAsync();

        var users = TestHelpers.MockUserManager();
        users.Setup(u => u.FindByIdAsync(target.Id.ToString())).ReturnsAsync(target);
        users.Setup(u => u.IsInRoleAsync(target, DbSeeder.AdminRole)).ReturnsAsync(false);
        users.Setup(u => u.AddToRoleAsync(target, DbSeeder.AdminRole)).ReturnsAsync(IdentityResult.Success);
        var controller = NewController(db, users, Guid.NewGuid(), "Admin", "Master");

        var result = await controller.Approve(action.Id, new ReviewActionRequest("ok"));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("approved", db.PendingActions.Single().Status);
        users.Verify(u => u.AddToRoleAsync(target, DbSeeder.AdminRole), Times.Once);
    }

    [Fact]
    public async Task Approvals_RegularAdmin_SeesOnlyOwnRequests()
    {
        await using var db = TestHelpers.NewDb();
        var meId = Guid.NewGuid();
        db.PendingActions.Add(new PendingAction { ActionType = "grant-admin", TargetUserId = Guid.NewGuid(), RequestedByUserId = meId });
        db.PendingActions.Add(new PendingAction { ActionType = "grant-admin", TargetUserId = Guid.NewGuid(), RequestedByUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();
        var users = TestHelpers.MockUserManager();
        var controller = NewController(db, users, meId, "Admin"); // not master

        var result = await controller.Approvals();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IEnumerable<PendingActionDto>>(ok.Value).ToList();
        var only = Assert.Single(list);
        Assert.Equal(meId, only.RequestedByUserId);
    }
}
