namespace NotSpotify.Api.Dtos;

// A seat on the current user's plan (as seen by the owner).
public record PlanMemberDto(
    Guid Id,
    string Status,          // invited | active
    string Email,
    UserRefDto? Member      // null while the invite is still pending
);

// An invite addressed to the current user that they can accept/decline.
public record PlanInviteDto(
    Guid Id,
    UserRefDto Owner,
    string Tier
);

public record PlanOverviewDto(
    string Tier,            // the caller's own tier (individual | duo | family | student)
    int MaxMembers,         // seats for a sharable tier the caller owns (incl. owner)
    bool IsOwner,           // true when the caller owns a sharable (duo/family) plan
    bool IsMember,          // true when the caller's premium is a shared seat
    UserRefDto? PlanOwner,  // who shares their plan with the caller (when IsMember)
    Guid? MySeatId,         // the caller's own seat id (when IsMember) — used to leave
    int SeatsUsed,          // owner + accepted + pending invites
    int SeatsTotal,
    IEnumerable<PlanMemberDto> Members,
    IEnumerable<PlanInviteDto> IncomingInvites
);

public record InvitePlanMemberRequest(string Email);
