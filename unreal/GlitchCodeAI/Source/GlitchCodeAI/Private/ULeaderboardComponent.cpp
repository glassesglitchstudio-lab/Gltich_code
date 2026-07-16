#include "ULeaderboardComponent.h"
#include "OnlineSubsystem.h"
#include "OnlineLeaderboardInterface.h"
#include "Kismet/GameplayStatics.h"

DEFINE_LOG_CATEGORY_STATIC(LogLeaderboard, Log, All);

ULeaderboardComponent::ULeaderboardComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void ULeaderboardComponent::BeginPlay()
{
    Super::BeginPlay();

    IOnlineSubsystem* OnlineSub = IOnlineSubsystem::Get();
    if (OnlineSub)
    {
        LeaderboardsInterface = OnlineSub->GetLeaderboardsInterface();
        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Initialized with subsystem '%s'"), 
            *OnlineSub->GetSubsystemName());
    }
    else
    {
        UE_LOG(LogLeaderboard, Warning, TEXT("Leaderboard: No online subsystem available"));
    }
}

bool ULeaderboardComponent::SubmitScore(int64 Score, const FString& BoardName)
{
    if (!LeaderboardsInterface.IsValid())
    {
        UE_LOG(LogLeaderboard, Error, TEXT("Leaderboard: Interface not available"));
        return false;
    }

    FString PlayerName = TEXT("LocalPlayer");
    FUniqueNetIdRepl PlayerUniqueId;

    if (UWorld* World = GetWorld())
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
        if (PC && PC->PlayerState)
        {
            PlayerName = PC->PlayerState->GetPlayerName();
            PlayerUniqueId = PC->PlayerState->GetUniqueId();
        }
    }

    TSharedPtr<FOnlineLeaderboardWrite> WriteObject = MakeShareable(new FOnlineLeaderboardWrite());
    WriteObject->LeaderboardNames.Add(FName(*BoardName));
    WriteObject->SortedColumns.Add(FName(*BoardName));
    WriteObject->Properties.Add(FOnlineStatsProperty(FName(*BoardName), Score));
    WriteObject->UpdateMethod = ELeaderboardUpdateMethod::KeepBest;
    WriteObject->Ranks.Add(FName(*BoardName));

    // Write the leaderboard
    bool bSuccess = LeaderboardsInterface->WriteLeaderboards(
        FName(*BoardName),
        PlayerUniqueId.IsValid() ? PlayerUniqueId.GetUniqueNetId() : nullptr,
        WriteObject
    );

    if (bSuccess)
    {
        LeaderboardsInterface->FlushLeaderboards(FName(*BoardName));
        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Score %lld submitted to '%s' for '%s'"), 
            Score, *BoardName, *PlayerName);
    }
    else
    {
        UE_LOG(LogLeaderboard, Error, TEXT("Leaderboard: Failed to submit score"));
    }

    OnScoreSubmitted.Broadcast(bSuccess);
    return bSuccess;
}

bool ULeaderboardComponent::SubmitScoreWithStats(int64 Score, const TArray<FLeaderboardStat>& Stats, 
    const FString& BoardName)
{
    if (!LeaderboardsInterface.IsValid()) return false;

    FString PlayerName = TEXT("LocalPlayer");
    FUniqueNetIdRepl PlayerUniqueId;

    if (UWorld* World = GetWorld())
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
        if (PC && PC->PlayerState)
        {
            PlayerName = PC->PlayerState->GetPlayerName();
            PlayerUniqueId = PC->PlayerState->GetUniqueId();
        }
    }

    TSharedPtr<FOnlineLeaderboardWrite> WriteObject = MakeShareable(new FOnlineLeaderboardWrite());
    WriteObject->LeaderboardNames.Add(FName(*BoardName));
    WriteObject->SortedColumns.Add(FName(*BoardName));
    
    // Add main score
    WriteObject->Properties.Add(FOnlineStatsProperty(FName(*BoardName), Score));
    
    // Add additional stats
    for (const FLeaderboardStat& Stat : Stats)
    {
        WriteObject->Properties.Add(FOnlineStatsProperty(FName(*Stat.StatName), Stat.StatValue));
    }

    WriteObject->UpdateMethod = ELeaderboardUpdateMethod::KeepBest;
    WriteObject->Ranks.Add(FName(*BoardName));

    bool bSuccess = LeaderboardsInterface->WriteLeaderboards(
        FName(*BoardName),
        PlayerUniqueId.IsValid() ? PlayerUniqueId.GetUniqueNetId() : nullptr,
        WriteObject
    );

    if (bSuccess)
    {
        LeaderboardsInterface->FlushLeaderboards(FName(*BoardName));
        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Score with stats submitted to '%s'"), *BoardName);
    }

    OnScoreSubmitted.Broadcast(bSuccess);
    return bSuccess;
}

void ULeaderboardComponent::QueryLeaderboard(const FString& BoardName, int32 NumResults)
{
    if (!LeaderboardsInterface.IsValid())
    {
        UE_LOG(LogLeaderboard, Error, TEXT("Leaderboard: Interface not available"));
        return;
    }

    if (bIsQuerying)
    {
        UE_LOG(LogLeaderboard, Warning, TEXT("Leaderboard: Query already in progress"));
        return;
    }

    bIsQuerying = true;
    CachedResults.Empty();

    LeaderboardRead = MakeShareable(new FOnlineLeaderboardRead());
    LeaderboardRead->LeaderboardName = FName(*BoardName);
    LeaderboardRead->SortedColumns.Add(FName(*BoardName));
    LeaderboardRead->Properties.Add(FName(*BoardName));

    // Query top N entries
    bool bSuccess = LeaderboardsInterface->ReadLeaderboardsAroundRank(
        LeaderboardRead.ToSharedRef(),
        1,  // Start rank
        NumResults
    );

    if (bSuccess)
    {
        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Querying '%s' (limit=%d)"), *BoardName, NumResults);
    }
    else
    {
        bIsQuerying = false;
        UE_LOG(LogLeaderboard, Error, TEXT("Leaderboard: Query failed"));
    }
}

void ULeaderboardComponent::QueryLeaderboardAroundPlayer(const FString& BoardName, int32 Range)
{
    if (!LeaderboardsInterface.IsValid()) return;

    FString PlayerName = TEXT("LocalPlayer");
    FUniqueNetIdRepl PlayerUniqueId;

    if (UWorld* World = GetWorld())
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
        if (PC && PC->PlayerState)
        {
            PlayerName = PC->PlayerState->GetPlayerName();
            PlayerUniqueId = PC->PlayerState->GetUniqueId();
        }
    }

    if (!PlayerUniqueId.IsValid())
    {
        UE_LOG(LogLeaderboard, Warning, TEXT("Leaderboard: No valid player ID"));
        return;
    }

    bIsQuerying = true;
    CachedResults.Empty();

    LeaderboardRead = MakeShareable(new FOnlineLeaderboardRead());
    LeaderboardRead->LeaderboardName = FName(*BoardName);
    LeaderboardRead->SortedColumns.Add(FName(*BoardName));
    LeaderboardRead->Properties.Add(FName(*BoardName));

    bool bSuccess = LeaderboardsInterface->ReadLeaderboardsAroundPlayer(
        LeaderboardRead.ToSharedRef(),
        PlayerUniqueId.GetUniqueNetId(),
        Range
    );

    if (bSuccess)
    {
        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Querying around player '%s' in '%s'"), 
            *PlayerName, *BoardName);
    }
    else
    {
        bIsQuerying = false;
    }
}

int32 ULeaderboardComponent::GetPlayerRank(const FString& PlayerName) const
{
    for (const FLeaderboardEntry& Entry : CachedResults)
    {
        if (Entry.PlayerName == PlayerName)
        {
            return Entry.Rank;
        }
    }
    return -1; // Not found
}

int64 ULeaderboardComponent::GetPlayerScore(const FString& PlayerName) const
{
    for (const FLeaderboardEntry& Entry : CachedResults)
    {
        if (Entry.PlayerName == PlayerName)
        {
            return Entry.Score;
        }
    }
    return -1; // Not found
}

void ULeaderboardComponent::OnWriteLeaderboardsComplete(FName BoardName, bool bWasSuccessful)
{
    if (bWasSuccessful)
    {
        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Write to '%s' complete"), *BoardName.ToString());
    }
    else
    {
        UE_LOG(LogLeaderboard, Warning, TEXT("Leaderboard: Write to '%s' failed"), *BoardName.ToString());
    }
}

void ULeaderboardComponent::OnReadLeaderboardsComplete(bool bWasSuccessful)
{
    bIsQuerying = false;

    if (bWasSuccessful && LeaderboardRead.IsValid())
    {
        CachedResults.Empty();

        for (const FOnlineStatsRow& Row : LeaderboardRead->Rows)
        {
            FLeaderboardEntry Entry;
            Entry.PlayerName = Row.NickName;
            Entry.Rank = Row.Rank;
            Entry.UniqueId = Row.PlayerId->ToString();

            // Get score from properties
            for (const FStatsColumn& Col : Row.Columns)
            {
                Entry.Score = Col.StatValue.GetValue<int64>();
                break;
            }

            CachedResults.Add(Entry);
        }

        UE_LOG(LogLeaderboard, Log, TEXT("Leaderboard: Query returned %d results"), CachedResults.Num());
    }

    OnLeaderboardQueried.Broadcast(CachedResults.Num());
}

void ULeaderboardComponent::OnReadLeaderboardsComplete_AroundPlayer(bool bWasSuccessful)
{
    OnReadLeaderboardsComplete(bWasSuccessful);
}
