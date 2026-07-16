#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "OnlineSubsystem.h"
#include "Interfaces/OnlineSessionInterface.h"
#include "OnlineSessionSettings.h"
#include "UNetSessionComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSessionCreated, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSessionJoined, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSessionLeft, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSessionsFound, int32, NumResults);

USTRUCT(BlueprintType)
struct FGlitchSessionInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString SessionId;

    UPROPERTY(BlueprintReadOnly)
    FString OwningUserName;

    UPROPERTY(BlueprintReadOnly)
    int32 MaxPlayers = 4;

    UPROPERTY(BlueprintReadOnly)
    int32 NumPlayers = 0;

    UPROPERTY(BlueprintReadOnly)
    bool bIsLAN = false;

    UPROPERTY(BlueprintReadOnly)
    bool bIsPrivate = false;

    UPROPERTY(BlueprintReadOnly)
    FString MapName;

    UPROPERTY(BlueprintReadOnly)
    int32 Ping = 0;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UNetSessionComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UNetSessionComponent();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category = "Social|Session")
    bool CreateSession(int32 MaxPlayers = 4, bool bIsLAN = false);

    UFUNCTION(BlueprintCallable, Category = "Social|Session")
    bool JoinSession(const FString& SearchString);

    UFUNCTION(BlueprintCallable, Category = "Social|Session")
    bool JoinSessionByIndex(int32 ResultIndex);

    UFUNCTION(BlueprintCallable, Category = "Social|Session")
    void LeaveSession();

    UFUNCTION(BlueprintCallable, Category = "Social|Session")
    void FindSessions(bool bIsLAN = false, bool bIsPresence = true);

    UFUNCTION(BlueprintPure, Category = "Social|Session")
    bool IsInSession() const { return bIsInSession; }

    UFUNCTION(BlueprintPure, Category = "Social|Session")
    FString GetCurrentSessionId() const { return CurrentSessionId; }

    UFUNCTION(BlueprintPure, Category = "Social|Session")
    int32 GetFoundSessionCount() const { return FoundSessions.Num(); }

    UFUNCTION(BlueprintPure, Category = "Social|Session")
    FGlitchSessionInfo GetFoundSession(int32 Index) const;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Session")
    FString SessionName = TEXT("GlitchSession");

    UPROPERTY(BlueprintAssignable)
    FOnSessionCreated OnSessionCreated;

    UPROPERTY(BlueprintAssignable)
    FOnSessionJoined OnSessionJoined;

    UPROPERTY(BlueprintAssignable)
    FOnSessionLeft OnSessionLeft;

    UPROPERTY(BlueprintAssignable)
    FOnSessionsFound OnSessionsFound;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Session")
    bool bIsInSession = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Session")
    FString CurrentSessionId;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Session")
    TArray<FGlitchSessionInfo> FoundSessions;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Session")
    int32 MaxSearchResults = 20;

private:
    IOnlineSessionPtr SessionInterface;
    TSharedPtr<FOnlineSessionSearch> SessionSearch;

    void OnCreateSessionComplete(FName SessionName, bool bWasSuccessful);
    void OnJoinSessionComplete(FName SessionName, EOnJoinSessionCompleteResult::Type Result);
    void OnFindSessionsComplete(bool bWasSuccessful);
    void OnDestroySessionComplete(FName SessionName, bool bWasSuccessful);

    void BindSessionDelegates();
    void UnbindSessionDelegates();
};
