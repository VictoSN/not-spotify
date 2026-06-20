using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;

namespace NotSpotify.Api.Services;

/// <summary>
/// Shared seat-release logic for multi-account plans. Called when an owner's
/// subscription ends (cancellation or a Stripe downgrade webhook): every active
/// member is dropped back to free and all seat rows are removed, so members
/// don't keep Premium after the plan they ride on is gone.
/// </summary>
public static class PlanSeats
{
    public static async Task ReleaseAllForOwnerAsync(AppDbContext db, Guid ownerId, CancellationToken ct = default)
    {
        var seats = await db.PlanMemberships.Where(m => m.OwnerId == ownerId).ToListAsync(ct);
        if (seats.Count == 0)
        {
            // Still normalise the owner's tier below even with no seats.
        }

        var memberIds = seats.Where(s => s.MemberId != null).Select(s => s.MemberId!.Value).ToList();
        if (memberIds.Count > 0)
        {
            var members = await db.Users.Where(u => memberIds.Contains(u.Id)).ToListAsync(ct);
            foreach (var member in members)
            {
                member.Plan = "free";
                member.PlanOwnerId = null;
                member.PlanTier = "individual";
            }
        }

        db.PlanMemberships.RemoveRange(seats);

        var owner = await db.Users.FirstOrDefaultAsync(u => u.Id == ownerId, ct);
        if (owner is not null) owner.PlanTier = "individual";
    }
}
