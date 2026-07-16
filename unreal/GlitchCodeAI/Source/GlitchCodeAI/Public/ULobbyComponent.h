#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "OnlineSubsystem.h"
#include "Interfaces/OnlineSessionInterface.h"
#include "ULobbyComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLobbyCreated, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLobbyJoined, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLobbyPlayerReady, const FString&, PlayerName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLobbyAllReady, bool, bAllReady);

USTRUCT(BlueprintType)
struct FLobbyPlayerInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString PlayerName;

    UPROPERTY(BlueprintReadOnly)
    int32 PlayerId = -1;

    UPROPERTY(BlueprintReadOnly)
    bool bIsReady = false;

    UPROPERTY(BlueprintReadOnly)
    bool bIsHost = false;

    UPROPERTY(BlueprintReadOnly)
    FDateTime JoinedAt;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API ULobbyComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    ULobbyComponent();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category = "Social|Lobby")
    bool CreateLobby(const FString& LobbyName = TEXT("MyLobby"), int32 MaxPlayers = 4);

    UFUNCTION(BlueprintCallable, Category = "Social|Lobby")
    bool JoinLobby(const FString& LobbyId);

    UFUNCTION(BlueprintCallable, Category = "Social|Lobby")
    void LeaveLobby();

    UFUNCTION(BlueprintCallable, Category = "Social|Lobby")
    bool ToggleReady();

    UFUNCTION(BlueprintCallable, Category = "Social|Lobby")
    bool SetPlayerReady(const FString& PlayerName, bool bReady);

    UFUNCTION(BlueprintCallable, Category = "Social|Lobby")
    bool StartGame();

    UFUNCTION(BlueprintPure, Category = "Social|Lobby")
    bool IsInLobby() const { return bIsInLobby; }

    UFUNCTION(BlueprintPure, Category = "Social|Lobby")
    bool IsHost() const { return bIsHost; }

    UFUNCTION(BlueprintPure, Category = "Social|Lobby")
    bool AreAllPlayersReady() const;

    UFUNCTION(BlueprintPure, Category = "Social|Lobby")
    TArray<FLobbyPlayerInfo> GetPlayers() const { return Players; }

    UFUNCTION(BlueprintPure, Category = "Social|Lobby")
    int32 GetPlayerCount() const { return Players.Num(); }

    UFUNCTION(BlueprintPure, Category = "Social|Lobby")
    FString GetLobbyId() const { return CurrentLobbyId; }

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Lobby")
    FString LobbyName = TEXT("GlitchLobby");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Lobby", meta = (ClampMin = "2", ClampMax = "16"))
    int32 MaxPlayers = 4;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Lobby")
    FString GameMapName = TEXT("/Game/Maps/MainMap");

    UPROPERTY(BlueprintAssignable)
    FOnLobbyCreated OnLobbyCreated;

    UPROPERTY(BlueprintAssignable)
    FOnLobbyJoined OnLobbyJoined;

    UPROPERTY(BlueprintAssignable)
    FOnLobbyPlayerReady OnLobbyPlayerReady;

    UPROPERTY(BlueprintAssignable)
    FOnLobbyAllReady OnLobbyAllReady;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Lobby")
    bool bIsInLobby = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Lobby")
    bool bIsHost = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Lobby")
    FString CurrentLobbyId;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Lobby")
    TArray<FLobbyPlayerInfo> Players;

private:
    IOnlineSessionPtr SessionInterface;
    
    void OnCreateSessionComplete(FName SessionName, bool bWasSuccessful);
    void OnJoinSessionComplete(FName SessionName, EOnJoinSessionCompleteResult::Type Result);
    void OnDestroySessionComplete(FName SessionName, bool bWasSuccessful);
    void OnFindSessionsComplete(bool bWasSuccessful);

    void AddLocalPlayer();
    FLobbyPlayerInfo CreatePlayerInfo(const FString& Name, int32 Id, bool bIsHostPlayer) const;
};
