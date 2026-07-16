#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "OnlineSubsystem.h"
#include "Interfaces/OnlineLeaderboardInterface.h"
#include "ULeaderboardComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnScoreSubmitted, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLeaderboardQueried, int32, NumResults);

USTRUCT(BlueprintType)
struct FLeaderboardEntry
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString PlayerName;

    UPROPERTY(BlueprintReadOnly)
    int32 Rank = 0;

    UPROPERTY(BlueprintReadOnly)
    int64 Score = 0;

    UPROPERTY(BlueprintReadOnly)
    int32 NumWins = 0;

    UPROPERTY(BlueprintReadOnly)
    FString UniqueId;
};

USTRUCT(BlueprintType)
struct FLeaderboardStat
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString StatName;

    UPROPERTY(BlueprintReadOnly)
    int64 StatValue = 0;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API ULeaderboardComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    ULeaderboardComponent();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category = "Social|Leaderboard")
    bool SubmitScore(int64 Score, const FString& BoardName = TEXT("Default"));

    UFUNCTION(BlueprintCallable, Category = "Social|Leaderboard")
    bool SubmitScoreWithStats(int64 Score, const TArray<FLeaderboardStat>& Stats, 
        const FString& BoardName = TEXT("Default"));

    UFUNCTION(BlueprintCallable, Category = "Social|Leaderboard")
    void QueryLeaderboard(const FString& BoardName = TEXT("Default"), int32 NumResults = 10);

    UFUNCTION(BlueprintCallable, Category = "Social|Leaderboard")
    void QueryLeaderboardAroundPlayer(const FString& BoardName = TEXT("Default"), int32 Range = 5);

    UFUNCTION(BlueprintPure, Category = "Social|Leaderboard")
    TArray<FLeaderboardEntry> GetResults() const { return CachedResults; }

    UFUNCTION(BlueprintPure, Category = "Social|Leaderboard")
    int32 GetPlayerRank(const FString& PlayerName) const;

    UFUNCTION(BlueprintPure, Category = "Social|Leaderboard")
    int64 GetPlayerScore(const FString& PlayerName) const;

    UFUNCTION(BlueprintPure, Category = "Social|Leaderboard")
    bool HasResults() const { return CachedResults.Num() > 0; }

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Leaderboard")
    FString DefaultBoardName = TEXT("Default");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Social|Leaderboard", meta = (ClampMin = "1"))
    int32 DefaultQueryLimit = 20;

    UPROPERTY(BlueprintAssignable)
    FOnScoreSubmitted OnScoreSubmitted;

    UPROPERTY(BlueprintAssignable)
    FOnLeaderboardQueried OnLeaderboardQueried;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Leaderboard")
    TArray<FLeaderboardEntry> CachedResults;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Social|Leaderboard")
    bool bIsQuerying = false;

private:
    IOnlineLeaderboardsPtr LeaderboardsInterface;
    TSharedPtr<FOnlineLeaderboardRead> LeaderboardRead;

    void OnWriteLeaderboardsComplete(FName BoardName, bool bWasSuccessful);
    void OnReadLeaderboardsComplete(bool bWasSuccessful);
    void OnReadLeaderboardsComplete_AroundPlayer(bool bWasSuccessful);
};
