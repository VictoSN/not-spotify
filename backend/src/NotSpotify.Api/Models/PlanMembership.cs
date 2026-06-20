namespace NotSpotify.Api.Models;

/// <summary>
/// A seat on a multi-account premium plan (Duo / Family). The plan owner holds
/// the Stripe subscription; each membership grants one other person Premium for
/// free while the plan is active. An invite starts as <c>invited</c> (matched by
/// email) and becomes <c>active</c> once the invitee accepts.
///
/// Seats are kept honest by syncing the member's <c>ApplicationUser.Plan</c> to
/// "premium" on accept and back to "free" when the seat is removed or the
/// owner's subscription lapses — so all existing premium checks keep working
/// without consulting this table.
/// </summary>
public class PlanMembership
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // The subscriber who owns the plan and the Stripe subscription.
    public Guid OwnerId { get; set; }
    public ApplicationUser Owner { get; set; } = null!;

    // The invited person's email (lowercased). Kept even after they accept so an
    // invite addressed to an email works before that account is matched.
    public string InvitedEmail { get; set; } = string.Empty;

    // Null until the invite is accepted (then the accepting user's id).
    public Guid? MemberId { get; set; }
    public ApplicationUser? Member { get; set; }

    // invited | active
    public string Status { get; set; } = "invited";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }
}
