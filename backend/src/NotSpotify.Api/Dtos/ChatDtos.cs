namespace NotSpotify.Api.Dtos;

/// <summary>A single direct message in a conversation.</summary>
public record ChatMessageDto(
    string Id,
    string SenderId,
    string RecipientId,
    string Body,
    DateTime SentAt,
    DateTime? ReadAt
);

/// <summary>
/// A conversation summary for the chat list — the friend, the latest message,
/// and how many of their messages I haven't read yet.
/// </summary>
public record ConversationDto(
    string UserId,
    string Name,
    string? AvatarUrl,
    ChatMessageDto? LastMessage,
    int UnreadCount
);

public record SendChatMessageDto(string Body);
