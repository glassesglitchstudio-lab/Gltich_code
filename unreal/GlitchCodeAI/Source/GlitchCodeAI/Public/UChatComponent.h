#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UChatComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnChatMessageReceived, const FString&, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnChatPlayerMuted, const FString&, PlayerName);

USTRUCT(BlueprintType)
struct FGlitchChatMessage
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString SenderName;

    UPROPERTY(BlueprintReadOnly)
    FString Content;

    UPROPERTY(BlueprintReadOnly)
    FString Channel;

    UPROPERTY(BlueprintReadOnly)
    FDateTime Timestamp;

    UPROPERTY(BlueprintReadOnly)
    int32 SenderPlayerId = -1;

    UPROPERTY(BlueprintReadOnly)
    bool bIsSystemMessage = false;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UChatComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UChatComponent();

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    void SendMessage(const FString& Message, const FString& Channel = TEXT("global"));

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    void SendSystemMessage(const FString& Message, const FString& Channel = TEXT("system"));

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    TArray<FGlitchChatMessage> GetHistory(const FString& Channel = TEXT("")) const;

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    void ClearHistory();

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    void MutePlayer(const FString& PlayerName);

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    void UnmutePlayer(const FString& PlayerName);

    UFUNCTION(BlueprintPure, Category = "Social|Chat")
    bool IsPlayerMuted(const FString& PlayerName) const;

    UFUNCTION(BlueprintCallable, Category = "Social|Chat")
    void SetActiveChannel(const FString& Channel);

    UFUNCTION(BlueprintPure, Category = "Social|Chat")
    FString GetActiveChannel() const { return ActiveChannel; }

    UFUNCTION(BlueprintPure, Category = "Social|Chat")
    int32 GetMessageCount() const { return MessageHistory.Num(); }

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Chat", meta = (ClampMin = "10"))
    int32 MaxHistorySize = 200;

    UPROPERTY(BlueprintAssignable)
    FOnChatMessageReceived OnChatMessageReceived;

    UPROPERTY(BlueprintAssignable)
    FOnChatPlayerMuted OnChatPlayerMuted;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Chat")
    TArray<FGlitchChatMessage> MessageHistory;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Chat")
    FString ActiveChannel = TEXT("global");

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Chat")
    TSet<FString> MutedPlayers;

private:
    bool IsMessageMuted(const FString& SenderName) const;
    void TrimHistory();
};
