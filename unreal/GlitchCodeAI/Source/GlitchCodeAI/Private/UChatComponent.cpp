#include "UChatComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"

DEFINE_LOG_CATEGORY_STATIC(LogChat, Log, All);

UChatComponent::UChatComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UChatComponent::SendMessage(const FString& Message, const FString& Channel)
{
    if (Message.IsEmpty())
    {
        UE_LOG(LogChat, Warning, TEXT("Chat: Empty message ignored"));
        return;
    }

    // Get sender name from player controller
    FString SenderName = TEXT("Unknown");
    int32 SenderPlayerId = -1;

    if (UWorld* World = GetWorld())
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
        if (PC && PC->PlayerState)
        {
            SenderName = PC->PlayerState->GetPlayerName();
            SenderPlayerId = PC->PlayerState->GetPlayerId();
        }
    }

    // Check if sender is muted
    if (IsMessageMuted(SenderName))
    {
        UE_LOG(LogChat, Verbose, TEXT("Chat: Message from muted player '%s' discarded"), *SenderName);
        return;
    }

    FGlitchChatMessage NewMessage;
    NewMessage.SenderName = SenderName;
    NewMessage.Content = Message;
    NewMessage.Channel = Channel;
    NewMessage.Timestamp = FDateTime::UtcNow();
    NewMessage.SenderPlayerId = SenderPlayerId;
    NewMessage.bIsSystemMessage = false;

    MessageHistory.Add(NewMessage);
    TrimHistory();

    // Broadcast to local player via ClientMessage
    if (UWorld* World = GetWorld())
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
        if (PC)
        {
            FString FormattedMessage = FString::Printf(TEXT("[%s] %s: %s"), *Channel, *SenderName, *Message);
            PC->ClientMessage(FText::FromString(FormattedMessage));
        }
    }

    UE_LOG(LogChat, Log, TEXT("Chat [%s] %s: %s"), *Channel, *SenderName, *Message);
    OnChatMessageReceived.Broadcast(Message);
}

void UChatComponent::SendSystemMessage(const FString& Message, const FString& Channel)
{
    if (Message.IsEmpty()) return;

    FGlitchChatMessage NewMessage;
    NewMessage.SenderName = TEXT("System");
    NewMessage.Content = Message;
    NewMessage.Channel = Channel;
    NewMessage.Timestamp = FDateTime::UtcNow();
    NewMessage.SenderPlayerId = -1;
    NewMessage.bIsSystemMessage = true;

    MessageHistory.Add(NewMessage);
    TrimHistory();

    // Broadcast to all local players
    if (UWorld* World = GetWorld())
    {
        for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
        {
            APlayerController* PC = It->Get();
            if (PC)
            {
                FString FormattedMessage = FString::Printf(TEXT("[SYSTEM] %s"), *Message);
                PC->ClientMessage(FText::FromString(FormattedMessage));
            }
        }
    }

    UE_LOG(LogChat, Log, TEXT("Chat [SYSTEM] %s"), *Message);
    OnChatMessageReceived.Broadcast(Message);
}

TArray<FGlitchChatMessage> UChatComponent::GetHistory(const FString& Channel) const
{
    if (Channel.IsEmpty())
    {
        return MessageHistory;
    }

    TArray<FGlitchChatMessage> FilteredMessages;
    for (const FGlitchChatMessage& Msg : MessageHistory)
    {
        if (Msg.Channel == Channel)
        {
            FilteredMessages.Add(Msg);
        }
    }
    return FilteredMessages;
}

void UChatComponent::ClearHistory()
{
    MessageHistory.Empty();
    UE_LOG(LogChat, Log, TEXT("Chat: Message history cleared"));
}

void UChatComponent::MutePlayer(const FString& PlayerName)
{
    if (PlayerName.IsEmpty()) return;

    MutedPlayers.Add(PlayerName);
    UE_LOG(LogChat, Log, TEXT("Chat: Player '%s' muted"), *PlayerName);
    OnChatPlayerMuted.Broadcast(PlayerName);
}

void UChatComponent::UnmutePlayer(const FString& PlayerName)
{
    if (MutedPlayers.Remove(PlayerName) > 0)
    {
        UE_LOG(LogChat, Log, TEXT("Chat: Player '%s' unmuted"), *PlayerName);
    }
}

bool UChatComponent::IsPlayerMuted(const FString& PlayerName) const
{
    return MutedPlayers.Contains(PlayerName);
}

void UChatComponent::SetActiveChannel(const FString& Channel)
{
    if (Channel.IsEmpty()) return;
    ActiveChannel = Channel;
    UE_LOG(LogChat, Log, TEXT("Chat: Active channel changed to '%s'"), *Channel);
}

bool UChatComponent::IsMessageMuted(const FString& SenderName) const
{
    return MutedPlayers.Contains(SenderName);
}

void UChatComponent::TrimHistory()
{
    while (MessageHistory.Num() > MaxHistorySize)
    {
        MessageHistory.RemoveAt(0);
    }
}
