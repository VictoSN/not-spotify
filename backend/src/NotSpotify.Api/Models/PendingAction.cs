namespace NotSpotify.Api.Models;

/// <summary>
/// A privileged action that a non-master admin requested but is not allowed to
/// execute directly. It sits in the approval queue until a master admin approves
/// (which runs it) or rejects it. Master admins never enqueue — they execute
/// immediately. Today the only enqueued actions are admin grant/revoke; the
/// shape is general enough to cover more later.
/// </summary>
public class PendingAction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>"grant-admin" | "revoke-admin".</summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>The user the action targets (e.g. the one being promoted/demoted).</summary>
    public Guid TargetUserId { get; set; }
    public string TargetEmail { get; set; } = string.Empty;

    /// <summary>"pending" | "approved" | "rejected".</summary>
    public string Status { get; set; } = "pending";

    public Guid RequestedByUserId { get; set; }
    public string RequestedByName { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    public Guid? ReviewedByUserId { get; set; }
    public string? ReviewedByName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
}
