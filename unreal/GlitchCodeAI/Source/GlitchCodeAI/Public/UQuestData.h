#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "UQuestData.generated.h"

UENUM(BlueprintType)
enum class EQuestStatus : uint8
{
    Locked,
    Available,
    Active,
    Completed,
    Failed
};

UENUM(BlueprintType)
enum class EObjectiveType : uint8
{
    Kill,
    Collect,
    Reach,
    Talk,
    Interact,
    Survive,
    Custom
};

USTRUCT(BlueprintType)
struct FQuestObjective
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString ObjectiveID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString Description;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    EObjectiveType Type = EObjectiveType::Custom;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 RequiredCount = 1;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 CurrentCount = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bCompleted = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bOptional = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString TargetID; // ActorID, ItemID, etc.
};

USTRUCT(BlueprintType)
struct FQuestReward
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 Experience = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 Currency = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FString> Items;
};

UCLASS(BlueprintType)
class GLITCHCODEAI_API UQuestData : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString QuestID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString QuestName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (MultiLine = "true"))
    FString Description;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FQuestObjective> Objectives;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FQuestReward Reward;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FString> PrerequisiteQuests;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bCanRepeat = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 LevelRequirement = 1;
};
