#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/SaveGame.h"
#include "UAutoSaveComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSaveCompleted, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSaveLoaded, bool, bSuccess);

UCLASS()
class GLITCHCODEAI_API UGlitchSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly)
    FString SlotName;

    UPROPERTY(BlueprintReadOnly)
    int32 SlotIndex = 0;

    UPROPERTY(BlueprintReadOnly)
    FDateTime SaveTimestamp;

    UPROPERTY(BlueprintReadOnly)
    float PlayTimeSeconds = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    FString LevelName;

    UPROPERTY(BlueprintReadOnly)
    FVector PlayerLocation = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FRotator PlayerRotation = FRotator::ZeroRotator;

    UPROPERTY(BlueprintReadOnly)
    TMap<FString, FString> GameStateData;

    UPROPERTY(BlueprintReadOnly)
    int32 SaveVersion = 1;
};

USTRUCT(BlueprintType)
struct FSaveMetadata
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString SlotName;

    UPROPERTY(BlueprintReadOnly)
    FDateTime Timestamp;

    UPROPERTY(BlueprintReadOnly)
    float PlayTime = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    FString LevelName;

    UPROPERTY(BlueprintReadOnly)
    FVector PlayerPosition = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    int32 Version = 1;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAutoSaveComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAutoSaveComponent();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    void EnableAutoSave();

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    void DisableAutoSave();

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    void SetInterval(float Seconds);

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    bool ForceSave();

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    bool ForceSaveToSlot(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    bool LoadLastSave();

    UFUNCTION(BlueprintCallable, Category = "Save|Auto")
    bool LoadFromSlot(const FString& SlotName);

    UFUNCTION(BlueprintPure, Category = "Save|Auto")
    FString GetSaveStatus() const;

    UFUNCTION(BlueprintPure, Category = "Save|Auto")
    TArray<FSaveMetadata> GetAllSaveSlots() const;

    UFUNCTION(BlueprintPure, Category = "Save|Auto")
    FString GetCurrentSaveSlot() const { return CurrentSaveSlot; }

    UFUNCTION(BlueprintPure, Category = "Save|Auto")
    float GetTimeSinceLastSave() const { return TimeSinceLastSave; }

    UPROPERTY(BlueprintAssignable)
    FOnSaveCompleted OnSaveCompleted;

    UPROPERTY(BlueprintAssignable)
    FOnSaveLoaded OnSaveLoaded;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Auto")
    bool bAutoSaveEnabled = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Auto", meta = (ClampMin = "10.0"))
    float SaveInterval = 300.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Auto", meta = (ClampMin = "1"))
    int32 MaxSaves = 10;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save|Auto")
    FString CurrentSaveSlot;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save|Auto")
    float TimeSinceLastSave = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save|Auto")
    int32 CurrentSaveIndex = 0;

private:
    FTimerHandle AutoSaveTimerHandle;

    void OnAutoSaveTick();
    FString GenerateSaveSlotName() const;
    UGlitchSaveGame* CreateSaveGameInstance() const;
    void PopulateSaveGame(UGlitchSaveGame* SaveGame) const;
    bool WriteSaveToFile(UGlitchSaveGame* SaveGame, const FString& SlotName);
    UGlitchSaveGame* LoadSaveFromFile(const FString& SlotName) const;
    void ApplyLoadedSave(UGlitchSaveGame* SaveGame);
    FString GetSaveFilePath(const FString& SlotName) const;
    FSaveMetadata ExtractMetadata(const UGlitchSaveGame* SaveGame) const;
};
