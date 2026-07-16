#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "USaveGameData.generated.h"

USTRUCT(BlueprintType)
struct FPlayerSaveData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString PlayerName;

    UPROPERTY(BlueprintReadOnly)
    int32 Level = 1;

    UPROPERTY(BlueprintReadOnly)
    int32 Experience = 0;

    UPROPERTY(BlueprintReadOnly)
    float Health = 100.0f;

    UPROPERTY(BlueprintReadOnly)
    float MaxHealth = 100.0f;

    UPROPERTY(BlueprintReadOnly)
    float Stamina = 100.0f;

    UPROPERTY(BlueprintReadOnly)
    FVector Location = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FRotator Rotation = FRotator::ZeroRotator;

    UPROPERTY(BlueprintReadOnly)
    FString CurrentLevel;

    UPROPERTY(BlueprintReadOnly)
    float PlayTime = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    int32 Currency = 0;
};

USTRUCT(BlueprintType)
struct FInventorySaveData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString ItemID;

    UPROPERTY(BlueprintReadOnly)
    int32 Quantity = 1;
};

USTRUCT(BlueprintType)
struct FQuestSaveData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString QuestID;

    UPROPERTY(BlueprintReadOnly)
    int32 Status = 0; // 0=Locked, 1=Available, 2=Active, 3=Completed, 4=Failed

    UPROPERTY(BlueprintReadOnly)
    TArray<int32> ObjectiveCounts;
};

UCLASS()
class GLITCHCODEAI_API USaveGameData : public USaveGame
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly)
    FString SaveSlotName;

    UPROPERTY(BlueprintReadOnly)
    int32 SaveSlotIndex = 0;

    UPROPERTY(BlueprintReadOnly)
    FString Timestamp;

    UPROPERTY(BlueprintReadOnly)
    FString PlayTimeFormatted;

    UPROPERTY(BlueprintReadOnly)
    FPlayerSaveData PlayerData;

    UPROPERTY(BlueprintReadOnly)
    TArray<FInventorySaveData> InventoryData;

    UPROPERTY(BlueprintReadOnly)
    TArray<FQuestSaveData> QuestData;

    UPROPERTY(BlueprintReadOnly)
    TArray<FString> DiscoveredLocations;

    UPROPERTY(BlueprintReadOnly)
    TMap<FString, bool> UnlockedSkills;

    UPROPERTY(BlueprintReadOnly)
    int32 AutosaveSlot = -1; // -1 = not autosave
};
