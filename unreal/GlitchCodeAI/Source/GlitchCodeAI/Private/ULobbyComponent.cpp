#include "ULobbyComponent.h"
#include "OnlineSubsystem.h"
#include "OnlineSessionSettings.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

DEFINE_LOG_CATEGORY_STATIC(LogLobby, Log, All);

ULobbyComponent::ULobbyComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void ULobbyComponent::BeginPlay()
{
    Super::BeginPlay();

    IOnlineSubsystem* OnlineSub = IOnlineSubsystem::Get();
    if (OnlineSub)
    {
        SessionInterface = OnlineSub->GetSessionInterface();
        UE_LOG(LogLobby, Log, TEXT("Lobby: Initialized with subsystem '%s'"), 
            *OnlineSub->GetSubsystemName());
    }
}

void ULobbyComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (bIsInLobby)
    {
        LeaveLobby();
    }

    SessionInterface.Reset();
    Super::EndPlay(EndPlayReason);
}

bool ULobbyComponent::CreateLobby(const FString& InLobbyName, int32 InMaxPlayers)
{
    if (!SessionInterface.IsValid())
    {
        UE_LOG(LogLobby, Error, TEXT("Lobby: Session interface not available"));
        return false;
    }

    if (bIsInLobby)
    {
        UE_LOG(LogLobby, Warning, TEXT("Lobby: Already in a lobby, leave first"));
        return false;
    }

    LobbyName = InLobbyName;
    MaxPlayers = InMaxPlayers;

    FOnlineSessionSettings SessionSettings;
    SessionSettings.NumPublicConnections = MaxPlayers;
    SessionSettings.NumPrivateConnections = 0;
    SessionSettings.bShouldAdvertise = true;
    SessionSettings.bAllowJoinInProgress = true;
    SessionSettings.bIsLANMatch = false;
    SessionSettings.bUsesPresence = true;
    SessionSettings.bAllowJoinViaPresence = true;
    SessionSettings.bAllowInvites = true;
    SessionSettings.bUseLobbiesIfAvailable = true;
    SessionSettings.bAllowPickupIfHostFails = false;

    // Store lobby-specific settings
    SessionSettings.Set(SETTING_MAPNAME, GameMapName, EOnlineDataAdvertisementType::ViaOnlineServiceAndPing);
    SessionSettings.Set(SETTING_CUSTOMDATA, LobbyName, EOnlineDataAdvertisementType::ViaOnlineService);

    FName SessionSlotName = FName(*LobbyName);
    bool bSuccess = SessionInterface->CreateSession(0, SessionSlotName, SessionSettings);

    if (bSuccess)
    {
        UE_LOG(LogLobby, Log, TEXT("Lobby: Creating lobby '%s' (max=%d)"), *LobbyName, MaxPlayers);
    }

    return bSuccess;
}

bool ULobbyComponent::JoinLobby(const FString& LobbyId)
{
    if (!SessionInterface.IsValid())
    {
        UE_LOG(LogLobby, Error, TEXT("Lobby: Session interface not available"));
        return false;
    }

    if (bIsInLobby)
    {
        UE_LOG(LogLobby, Warning, TEXT("Lobby: Already in a lobby"));
        return false;
    }

    // Find sessions to get the specific one
    TSharedPtr<FOnlineSessionSearch> Search = MakeShareable(new FOnlineSessionSearch());
    Search->MaxSearchResults = 10;
    Search->bIsLanQuery = false;
    Search->QuerySettings.Set(SEARCH_PRESENCE, true, EOnlineComparisonOp::Equals);

    SessionInterface->FindSessions(0, Search.ToSharedRef());

    // Wait for results and join matching session
    // In practice, this would use a callback; simplified here
    UE_LOG(LogLobby, Log, TEXT("Lobby: Searching for lobby '%s'"), *LobbyId);
    
    return true;
}

void ULobbyComponent::LeaveLobby()
{
    if (!bIsInLobby) return;

    FName SessionSlotName = FName(*LobbyName);
    
    if (SessionInterface.IsValid())
    {
        SessionInterface->DestroySession(SessionSlotName);
    }

    Players.Empty();
    bIsInLobby = false;
    bIsHost = false;
    CurrentLobbyId.Empty();

    UE_LOG(LogLobby, Log, TEXT("Lobby: Left lobby"));
}

bool ULobbyComponent::ToggleReady()
{
    if (!bIsInLobby || Players.Num() == 0) return false;

    // Toggle local player's ready state
    FLobbyPlayerInfo* LocalPlayer = Players.FindByPredicate([this](const FLobbyPlayerInfo& P)
    {
        return P.bIsHost == bIsHost; // Simple heuristic; would use player ID in practice
    });

    if (LocalPlayer)
    {
        LocalPlayer->bIsReady = !LocalPlayer->bIsReady;
        OnLobbyPlayerReady.Broadcast(LocalPlayer->PlayerName);
        OnLobbyAllReady.Broadcast(AreAllPlayersReady());
        return true;
    }

    return false;
}

bool ULobbyComponent::SetPlayerReady(const FString& PlayerName, bool bReady)
{
    for (FLobbyPlayerInfo& Player : Players)
    {
        if (Player.PlayerName == PlayerName)
        {
            Player.bIsReady = bReady;
            OnLobbyPlayerReady.Broadcast(PlayerName);
            OnLobbyAllReady.Broadcast(AreAllPlayersReady());
            return true;
        }
    }
    return false;
}

bool ULobbyComponent::StartGame()
{
    if (!bIsHost)
    {
        UE_LOG(LogLobby, Warning, TEXT("Lobby: Only host can start the game"));
        return false;
    }

    if (!AreAllPlayersReady())
    {
        UE_LOG(LogLobby, Warning, TEXT("Lobby: Not all players are ready"));
        return false;
    }

    if (Players.Num() < 1)
    {
        UE_LOG(LogLobby, Warning, TEXT("Lobby: No players in lobby"));
        return false;
    }

    UE_LOG(LogLobby, Log, TEXT("Lobby: Starting game with %d players"), Players.Num());

    // Travel to game map
    UWorld* World = GetWorld();
    if (World)
    {
        UGameplayStatics::OpenLevel(World, FName(*GameMapName));
        return true;
    }

    return false;
}

bool ULobbyComponent::AreAllPlayersReady() const
{
    if (Players.Num() == 0) return false;

    for (const FLobbyPlayerInfo& Player : Players)
    {
        if (!Player.bIsReady)
        {
            return false;
        }
    }
    return true;
}

void ULobbyComponent::OnCreateSessionComplete(FName SessionName, bool bWasSuccessful)
{
    if (bWasSuccessful)
    {
        bIsInLobby = true;
        bIsHost = true;
        CurrentLobbyId = SessionName.ToString();
        
        AddLocalPlayer();

        UE_LOG(LogLobby, Log, TEXT("Lobby: Created lobby '%s'"), *CurrentLobbyId);
    }
    else
    {
        UE_LOG(LogLobby, Error, TEXT("Lobby: Failed to create lobby"));
    }

    OnLobbyCreated.Broadcast(bWasSuccessful);
}

void ULobbyComponent::OnJoinSessionComplete(FName SessionName, EOnJoinSessionCompleteResult::Type Result)
{
    bool bSuccess = (Result == EOnJoinSessionCompleteResult::Success);
    
    if (bSuccess)
    {
        bIsInLobby = true;
        bIsHost = false;
        CurrentLobbyId = SessionName.ToString();
        
        AddLocalPlayer();

        UE_LOG(LogLobby, Log, TEXT("Lobby: Joined lobby '%s'"), *CurrentLobbyId);
    }

    OnLobbyJoined.Broadcast(bSuccess);
}

void ULobbyComponent::OnDestroySessionComplete(FName SessionName, bool bWasSuccessful)
{
    if (bWasSuccessful)
    {
        UE_LOG(LogLobby, Log, TEXT("Lobby: Session '%s' destroyed"), *SessionName.ToString());
    }
}

void ULobbyComponent::OnFindSessionsComplete(bool bWasSuccessful)
{
    // Handle lobby search results
}

void ULobbyComponent::AddLocalPlayer()
{
    FString PlayerName = TEXT("Player");
    int32 PlayerId = 0;

    if (UWorld* World = GetWorld())
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
        if (PC && PC->PlayerState)
        {
            PlayerName = PC->PlayerState->GetPlayerName();
            PlayerId = PC->PlayerState->GetPlayerId();
        }
    }

    Players.Add(CreatePlayerInfo(PlayerName, PlayerId, bIsHost));
}

FLobbyPlayerInfo ULobbyComponent::CreatePlayerInfo(const FString& Name, int32 Id, bool bIsHostPlayer) const
{
    FLobbyPlayerInfo Info;
    Info.PlayerName = Name;
    Info.PlayerId = Id;
    Info.bIsReady = false;
    Info.bIsHost = bIsHostPlayer;
    Info.JoinedAt = FDateTime::UtcNow();
    return Info;
}
