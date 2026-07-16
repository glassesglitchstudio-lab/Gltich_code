#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "USaveGameData.h"
#include "USaveManager.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnGameSaved, const FString&, SlotName, int32, SlotIndex);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnGameLoaded, const FString&, SlotName, int32, SlotIndex);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAutosaveTriggered, const FString&, SlotName);

UCLASS()
class GLITCHCODEAI_API USaveManager : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    // Core save/load operations
    UFUNCTION(BlueprintCallable, Category = "Save System")
    bool SaveGame(const FString& SlotName, int32 SlotIndex);

    UFUNCTION(BlueprintCallable, Category = "Save System")
    bool LoadGame(const FString& SlotName, int32 SlotIndex);

    UFUNCTION(BlueprintCallable, Category = "Save System")
    bool DeleteSave(const FString& SlotName, int32 SlotIndex);

    UFUNCTION(BlueprintCallable, Category = "Save System")
    bool HasSaveGame(const FString& SlotName, int32 SlotIndex) const;

    UFUNCTION(BlueprintCallable, Category = "Save System")
    TArray<USaveGameData*> GetAllSaveSlots() const;

    // Convenience methods
    UFUNCTION(BlueprintCallable, Category = "Save System")
    void AutoSave();

    UFUNCTION(BlueprintCallable, Category = "Save System")
    bool QuickSave();

    UFUNCTION(BlueprintCallable, Category = "Save System")
    bool QuickLoad();

    UFUNCTION(BlueprintCallable, Category = "Save System")
    void CreateSaveSlot(const FString& SlotName);

    // Settings
    UFUNCTION(BlueprintCallable, Category = "Save System")
    void SetAutoSaveEnabled(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category = "Save System")
    void SetAutoSaveInterval(float IntervalSeconds);

    UFUNCTION(BlueprintPure, Category = "Save System")
    bool IsAutoSaveEnabled() const { return bAutoSaveEnabled; }

    UFUNCTION(BlueprintPure, Category = "Save System")
    float GetAutoSaveInterval() const { return AutoSaveInterval; }

    // Delegates
    UPROPERTY(BlueprintAssignable, Category = "Save System")
    FOnGameSaved OnGameSaved;

    UPROPERTY(BlueprintAssignable, Category = "Save System")
    FOnGameLoaded OnGameLoaded;

    UPROPERTY(BlueprintAssignable, Category = "Save System")
    FOnAutosaveTriggered OnAutosaveTriggered;

private:
    void StartAutoSaveTimer();
    void StopAutoSaveTimer();
    void CleanupOldAutoSaves();
    FString GetFormattedPlayTime(float TotalSeconds) const;

    UPROPERTY()
    FTimerHandle AutoSaveTimerHandle;

    UPROPERTY()
    float AutoSaveInterval = 300.0f; // 5 minutes

    UPROPERTY()
    int32 MaxAutoSaves = 5;

    UPROPERTY()
    bool bAutoSaveEnabled = true;

    static constexpr int32 QuickSaveSlotIndex = 0;
    static constexpr int32 AutoSaveSlotStart = 100; // Autosaves use slots 100+
};
