namespace NotSpotify.Api.Dtos;

// UserRefDto is defined in ResourceDtos.cs — reused here.

/// <summary>An accepted friend, enriched with mutual-friend count.</summary>
public record FriendDto(
    string UserId,
    string Name,
    string? AvatarUrl,
    int MutualFriendsCount
);

/// <summary>A pending friend request.</summary>
public record FriendRequestDto(
    string Id,
    UserRefDto FromUser,
    UserRefDto ToUser,
    string Status,
    DateTime CreatedAt
);

/// <summary>
/// Online status and listening activity for a friend.
/// NowPlaying is the live track when IsListeningNow, otherwise the most
/// recently played track (PlayedAt tells the frontend how long ago).
/// </summary>
public record FriendActivityDto(
    string UserId,
    bool IsOnline,
    TrackDto? NowPlaying,
    DateTime? PlayedAt,
    bool IsListeningNow
);

/// <summary>A suggested friend — 2nd-degree connection ranked by mutual count.</summary>
public record FriendSuggestionDto(
    string Id,
    string Name,
    string? AvatarUrl,
    int MutualFriendsCount
);

/// <summary>A mutual friend between the current user and another user.</summary>
public record MutualFriendDto(
    string UserId,
    string Name,
    string? AvatarUrl
);

/// <summary>Public user search result with social context.</summary>
public record UserSearchResultDto(
    string Id,
    string Name,
    string Email,
    string? AvatarUrl,
    int MutualFriendsCount,
    bool IsArtist
);

/// <summary>Public profile for a user's profile page.</summary>
public record PublicUserProfileDto(
    string Id,
    string Name,
    string? AvatarUrl,
    DateTime CreatedAt,
    int MutualFriendsCount
);

public record SendFriendRequestDto(Guid UserId);
public record RespondToRequestDto(string Action); // "accept" | "decline"
