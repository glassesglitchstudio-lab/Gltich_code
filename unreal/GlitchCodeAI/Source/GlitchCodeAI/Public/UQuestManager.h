#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UQuestData.h"
#include "UQuestManager.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnQuestAccepted, const FString&, QuestID);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnQuestCompleted, const FString&, QuestID);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnQuestFailed, const FString&, QuestID);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnObjectiveUpdated, const FString&, QuestID, const FString&, ObjectiveID);

UCLASS(ClassGroup=(GlitchCodeAI), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UQuestManager : public UActorComponent
{
    GENERATED_BODY()

public:
    UQuestManager();

    // --- Delegates ---
    UPROPERTY(BlueprintAssignable, Category = "Quest|Events")
    FOnQuestAccepted OnQuestAccepted;

    UPROPERTY(BlueprintAssignable, Category = "Quest|Events")
    FOnQuestCompleted OnQuestCompleted;

    UPROPERTY(BlueprintAssignable, Category = "Quest|Events")
    FOnQuestFailed OnQuestFailed;

    UPROPERTY(BlueprintAssignable, Category = "Quest|Events")
    FOnObjectiveUpdated OnObjectiveUpdated;

    // --- Quest Management ---
    UFUNCTION(BlueprintCallable, Category = "Quest")
    bool AcceptQuest(const FString& QuestID);

    UFUNCTION(BlueprintCallable, Category = "Quest")
    bool AbandonQuest(const FString& QuestID);

    UFUNCTION(BlueprintCallable, Category = "Quest")
    bool CompleteQuest(const FString& QuestID);

    UFUNCTION(BlueprintCallable, Category = "Quest")
    bool UpdateObjective(const FString& QuestID, const FString& ObjectiveID, int32 Count = 1);

    // --- Queries ---
    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Quest")
    bool IsQuestCompleted(const FString& QuestID) const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Quest")
    EQuestStatus GetQuestStatus(const FString& QuestID) const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Quest")
    bool CheckPrerequisites(const FString& QuestID) const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Quest")
    float GetQuestProgress(const FString& QuestID) const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Quest")
    TArray<FString> GetActiveQuests() const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Quest")
    TArray<FString> GetCompletedQuests() const;

    // --- Data Management ---
    UFUNCTION(BlueprintCallable, Category = "Quest")
    void RegisterQuestData(UQuestData* QuestData);

    UFUNCTION(BlueprintCallable, Category = "Quest")
    UQuestData* GetQuestData(const FString& QuestID) const;

    virtual void BeginPlay() override;

private:
    UPROPERTY()
    TMap<FString, UQuestData*> QuestDataMap;

    UPROPERTY()
    TMap<FString, EQuestStatus> QuestStatusMap;

    UPROPERTY()
    TMap<FString, TArray<FQuestObjective>> QuestObjectivesMap;

    FQuestObjective* FindObjective(const FString& QuestID, const FString& ObjectiveID);
    const FQuestObjective* FindObjective(const FString& QuestID, const FString& ObjectiveID) const;
    void MarkQuestFailed(const FString& QuestID);
};
