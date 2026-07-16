#include "UNetSessionComponent.h"
#include "OnlineSubsystem.h"
#include "OnlineSessionSettings.h"
#include "Kismet/GameplayStatics.h"

DEFINE_LOG_CATEGORY_STATIC(LogNetSession, Log, All);

UNetSessionComponent::UNetSessionComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UNetSessionComponent::BeginPlay()
{
    Super::BeginPlay();

    IOnlineSubsystem* OnlineSub = IOnlineSubsystem::Get();
    if (OnlineSub)
    {
        SessionInterface = OnlineSub->GetSessionInterface();
        BindSessionDelegates();
        UE_LOG(LogNetSession, Log, TEXT("NetSession: Initialized with subsystem '%s'"), 
            *OnlineSub->GetSubsystemName());
    }
    else
    {
        UE_LOG(LogNetSession, Warning, TEXT("NetSession: No online subsystem available"));
    }
}

void UNetSessionComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (bIsInSession)
    {
        LeaveSession();
    }

    UnbindSessionDelegates();
    SessionInterface.Reset();

    Super::EndPlay(EndPlayReason);
}

bool UNetSessionComponent::CreateSession(int32 MaxPlayers, bool bIsLAN)
{
    if (!SessionInterface.IsValid())
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Session interface not available"));
        return false;
    }

    if (bIsInSession)
    {
        UE_LOG(LogNetSession, Warning, TEXT("NetSession: Already in a session, leave first"));
        return false;
    }

    FOnlineSessionSettings SessionSettings;
    SessionSettings.NumPublicConnections = MaxPlayers;
    SessionSettings.NumPrivateConnections = 0;
    SessionSettings.bShouldAdvertise = true;
    SessionSettings.bAllowJoinInProgress = true;
    SessionSettings.bIsLANMatch = bIsLAN;
    SessionSettings.bUsesPresence = true;
    SessionSettings.bAllowJoinViaPresence = true;
    SessionSettings.bAllowInvites = true;
    SessionSettings.bAllowJoinViaPresenceFriendsOnly = false;
    SessionSettings.bUseLobbiesIfAvailable = true;
    SessionSettings.bAllowPickupIfHostFails = true;

    // Set custom settings
    SessionSettings.Set(SETTING_MAPNAME, FString(TEXT("DefaultMap")), EOnlineDataAdvertisementType::ViaOnlineServiceAndPing);
    SessionSettings.Set(SETTING_CUSTOMDATA, SessionName, EOnlineDataAdvertisementType::ViaOnlineService);

    FName SessionSlotName = FName(*SessionName);
    
    bool bSuccess = SessionInterface->CreateSession(0, SessionSlotName, SessionSettings);
    
    if (bSuccess)
    {
        UE_LOG(LogNetSession, Log, TEXT("NetSession: Creating session '%s' (max=%d, LAN=%s)"), 
            *SessionName, MaxPlayers, bIsLAN ? TEXT("true") : TEXT("false"));
    }
    else
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Failed to initiate session creation"));
    }

    return bSuccess;
}

bool UNetSessionComponent::JoinSession(const FString& SearchString)
{
    if (!SessionInterface.IsValid())
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Session interface not available"));
        return false;
    }

    if (!SessionSearch.IsValid() || SessionSearch->SearchResults.Num() == 0)
    {
        UE_LOG(LogNetSession, Warning, TEXT("NetSession: No search results available"));
        return false;
    }

    // Find matching session
    for (int32 i = 0; i < SessionSearch->SearchResults.Num(); ++i)
    {
        const FOnlineSessionSearchResult& Result = SessionSearch->SearchResults[i];
        
        FString SessionIdStr = Result.GetSessionIdStr();
        FString OwningName = Result.Session.OwningUserName;
        
        if (SessionIdStr.Contains(SearchString) || OwningName.Contains(SearchString))
        {
            return JoinSessionByIndex(i);
        }
    }

    UE_LOG(LogNetSession, Warning, TEXT("NetSession: No session matching '%s' found"), *SearchString);
    return false;
}

bool UNetSessionComponent::JoinSessionByIndex(int32 ResultIndex)
{
    if (!SessionInterface.IsValid())
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Session interface not available"));
        return false;
    }

    if (!SessionSearch.IsValid() || !SessionSearch->SearchResults.IsValidIndex(ResultIndex))
    {
        UE_LOG(LogNetSession, Warning, TEXT("NetSession: Invalid search result index %d"), ResultIndex);
        return false;
    }

    const FOnlineSessionSearchResult& Result = SessionSearch->SearchResults[ResultIndex];
    FName SessionSlotName = FName(*SessionName);
    
    EOnlineSessionConnectResult::Type ConnectResult;
    bool bSuccess = SessionInterface->JoinSession(0, SessionSlotName, Result, ConnectResult);

    if (bSuccess)
    {
        UE_LOG(LogNetSession, Log, TEXT("NetSession: Joining session at index %d"), ResultIndex);
    }
    else
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Failed to join session, result=%d"), 
            static_cast<int32>(ConnectResult));
    }

    return bSuccess;
}

void UNetSessionComponent::LeaveSession()
{
    if (!SessionInterface.IsValid() || !bIsInSession)
    {
        return;
    }

    FName SessionSlotName = FName(*SessionName);
    SessionInterface->DestroySession(SessionSlotName);
    
    UE_LOG(LogNetSession, Log, TEXT("NetSession: Leaving session '%s'"), *CurrentSessionId);
}

void UNetSessionComponent::FindSessions(bool bIsLAN, bool bIsPresence)
{
    if (!SessionInterface.IsValid())
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Session interface not available"));
        return;
    }

    SessionSearch = MakeShareable(new FOnlineSessionSearch());
    SessionSearch->MaxSearchResults = MaxSearchResults;
    SessionSearch->bIsLanQuery = bIsLAN;
    SessionSearch->QuerySettings.Set(SEARCH_PRESENCE, bIsPresence, EOnlineComparisonOp::Equals);
    SessionSearch->QuerySettings.Set(SEARCH_MAPNAME, FString(TEXT("")), EOnlineComparisonOp::Equals);

    SessionInterface->FindSessions(0, SessionSearch.ToSharedRef());

    UE_LOG(LogNetSession, Log, TEXT("NetSession: Searching for sessions (LAN=%s, Presence=%s)"),
        bIsLAN ? TEXT("true") : TEXT("false"), bIsPresence ? TEXT("true") : TEXT("false"));
}

FGlitchSessionInfo UNetSessionComponent::GetFoundSession(int32 Index) const
{
    FGlitchSessionInfo EmptyInfo;
    
    if (!FoundSessions.IsValidIndex(Index))
    {
        return EmptyInfo;
    }

    return FoundSessions[Index];
}

void UNetSessionComponent::OnCreateSessionComplete(FName SessionName, bool bWasSuccessful)
{
    if (bWasSuccessful)
    {
        bIsInSession = true;
        CurrentSessionId = SessionName.ToString();
        UE_LOG(LogNetSession, Log, TEXT("NetSession: Session '%s' created successfully"), *CurrentSessionId);
    }
    else
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Failed to create session '%s'"), *SessionName.ToString());
    }

    OnSessionCreated.Broadcast(bWasSuccessful);
}

void UNetSessionComponent::OnJoinSessionComplete(FName SessionName, EOnJoinSessionCompleteResult::Type Result)
{
    bool bSuccess = (Result == EOnJoinSessionCompleteResult::Success);
    
    if (bSuccess)
    {
        bIsInSession = true;
        CurrentSessionId = SessionName.ToString();

        // Get connection info for travel
        FString ConnectString;
        if (SessionInterface->GetResolvedConnectString(NAME_GameSession, ConnectString))
        {
            UE_LOG(LogNetSession, Log, TEXT("NetSession: Connected to '%s' at %s"), 
                *CurrentSessionId, *ConnectString);
        }
    }
    else
    {
        UE_LOG(LogNetSession, Warning, TEXT("NetSession: Failed to join session, result=%d"), 
            static_cast<int32>(Result));
    }

    OnSessionJoined.Broadcast(bSuccess);
}

void UNetSessionComponent::OnFindSessionsComplete(bool bWasSuccessful)
{
    FoundSessions.Empty();

    if (bWasSuccessful && SessionSearch.IsValid())
    {
        for (const FOnlineSessionSearchResult& Result : SessionSearch->SearchResults)
        {
            FGlitchSessionInfo Info;
            Info.SessionId = Result.GetSessionIdStr();
            Info.OwningUserName = Result.Session.OwningUserName;
            Info.MaxPlayers = Result.Session.SessionSettings.NumPublicConnections;
            Info.NumPlayers = Info.MaxPlayers - Result.Session.NumOpenPublicConnections;
            Info.bIsLAN = Result.Session.SessionSettings.bIsLANMatch;
            Info.bIsPrivate = Result.Session.SessionSettings.bAllowJoinInProgress == false;
            Info.Ping = Result.PingInMs;

            // Get map name from settings
            FString MapName;
            if (Result.Session.SessionSettings.Get(SETTING_MAPNAME, MapName))
            {
                Info.MapName = MapName;
            }

            FoundSessions.Add(Info);
        }

        UE_LOG(LogNetSession, Log, TEXT("NetSession: Found %d sessions"), FoundSessions.Num());
    }
    else
    {
        UE_LOG(LogNetSession, Warning, TEXT("NetSession: Session search failed or returned no results"));
    }

    OnSessionsFound.Broadcast(FoundSessions.Num());
}

void UNetSessionComponent::OnDestroySessionComplete(FName SessionName, bool bWasSuccessful)
{
    if (bWasSuccessful)
    {
        bIsInSession = false;
        CurrentSessionId.Empty();
        UE_LOG(LogNetSession, Log, TEXT("NetSession: Session '%s' destroyed"), *SessionName.ToString());
    }
    else
    {
        UE_LOG(LogNetSession, Error, TEXT("NetSession: Failed to destroy session '%s'"), *SessionName.ToString());
    }

    OnSessionLeft.Broadcast(bWasSuccessful);
}

void UNetSessionComponent::BindSessionDelegates()
{
    if (!SessionInterface.IsValid()) return;

    SessionInterface->AddOnCreateSessionCompleteDelegate_Handle(
        FOnCreateSessionCompleteDelegate::CreateUObject(this, &UNetSessionComponent::OnCreateSessionComplete));

    SessionInterface->AddOnJoinSessionCompleteDelegate_Handle(
        FOnJoinSessionCompleteDelegate::CreateUObject(this, &UNetSessionComponent::OnJoinSessionComplete));

    SessionInterface->AddOnFindSessionsCompleteDelegate_Handle(
        FOnFindSessionsCompleteDelegate::CreateUObject(this, &UNetSessionComponent::OnFindSessionsComplete));

    SessionInterface->AddOnDestroySessionCompleteDelegate_Handle(
        FOnDestroySessionCompleteDelegate::CreateUObject(this, &UNetSessionComponent::OnDestroySessionComplete));
}

void UNetSessionComponent::UnbindSessionDelegates()
{
    // Delegates are automatically cleaned up when SessionInterface is released
}
