#include "USaveManager.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "TimerManager.h"

void USaveManager::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);

    if (bAutoSaveEnabled)
    {
        StartAutoSaveTimer();
    }
}

void USaveManager::Deinitialize()
{
    StopAutoSaveTimer();
    Super::Deinitialize();
}

bool USaveManager::SaveGame(const FString& SlotName, int32 SlotIndex)
{
    USaveGameData* SaveGameInstance = Cast<USaveGameData>(
        UGameplayStatics::CreateSaveGameObject(USaveGameData::StaticClass())
    );

    if (!SaveGameInstance)
    {
        UE_LOG(LogTemp, Error, TEXT("SaveManager: Failed to create save game object"));
        return false;
    }

    // Populate slot metadata
    SaveGameInstance->SaveSlotName = SlotName;
    SaveGameInstance->SaveSlotIndex = SlotIndex;
    SaveGameInstance->Timestamp = FDateTime::Now().ToString(TEXT("%Y-%m-%d %H:%M:%S"));

    // Gather player state
    UWorld* World = GetWorld();
    if (World)
    {
        APlayerController* PC = World->GetFirstPlayerController();
        if (PC)
        {
            APawn* Pawn = PC->GetPawn();
            if (Pawn)
            {
                SaveGameInstance->PlayerData.Location = Pawn->GetActorLocation();
                SaveGameInstance->PlayerData.Rotation = Pawn->GetActorRotation();
            }

            FString LevelName = World->GetMapName();
            LevelName.RemoveFromStart(World->StreamingLevelsPrefix);
            SaveGameInstance->PlayerData.CurrentLevel = LevelName;
        }
    }

    // Serialize play time
    float TotalPlayTime = 0.0f;
    // Get play time from game instance or world
    SaveGameInstance->PlayerData.PlayTime = TotalPlayTime;
    SaveGameInstance->PlayTimeFormatted = GetFormattedPlayTime(TotalPlayTime);

    // Capture game state via delegates or direct queries
    // These would be connected to your game's specific systems
    // For now, we save what we have

    const FString FullSlotName = FString::Printf(TEXT("%s_%d"), *SlotName, SlotIndex);

    bool bSuccess = UGameplayStatics::SaveGameToSlot(SaveGameInstance, FullSlotName, SlotIndex);

    if (bSuccess)
    {
        OnGameSaved.Broadcast(SlotName, SlotIndex);
        UE_LOG(LogTemp, Log, TEXT("SaveManager: Game saved to slot '%s' (index %d)"), *SlotName, SlotIndex);
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("SaveManager: Failed to save to slot '%s' (index %d)"), *SlotName, SlotIndex);
    }

    return bSuccess;
}

bool USaveManager::LoadGame(const FString& SlotName, int32 SlotIndex)
{
    const FString FullSlotName = FString::Printf(TEXT("%s_%d"), *SlotName, SlotIndex);

    if (!UGameplayStatics::DoesSaveGameExist(FullSlotName, SlotIndex))
    {
        UE_LOG(LogTemp, Warning, TEXT("SaveManager: Save slot '%s_%d' does not exist"), *SlotName, SlotIndex);
        return false;
    }

    USaveGameData* LoadedGame = Cast<USaveGameData>(
        UGameplayStatics::LoadGameFromSlot(FullSlotName, SlotIndex)
    );

    if (!LoadedGame)
    {
        UE_LOG(LogTemp, Error, TEXT("SaveManager: Failed to load save game from slot '%s_%d'"), *SlotName, SlotIndex);
        return false;
    }

    // Restore player state
    UWorld* World = GetWorld();
    if (World)
    {
        APlayerController* PC = World->GetFirstPlayerController();
        if (PC)
        {
            APawn* Pawn = PC->GetPawn();
            if (Pawn)
            {
                Pawn->SetActorLocation(LoadedGame->PlayerData.Location);
                Pawn->SetActorRotation(LoadedGame->PlayerData.Rotation);
            }
        }

        // Handle level transition if needed
        if (!LoadedGame->PlayerData.CurrentLevel.IsEmpty())
        {
            FString CurrentLevel = World->GetMapName();
            CurrentLevel.RemoveFromStart(World->StreamingLevelsPrefix);

            if (CurrentLevel != LoadedGame->PlayerData.CurrentLevel)
            {
                UGameplayStatics::OpenLevel(World, FName(*LoadedGame->PlayerData.CurrentLevel));
            }
        }
    }

    OnGameLoaded.Broadcast(SlotName, SlotIndex);
    UE_LOG(LogTemp, Log, TEXT("SaveManager: Game loaded from slot '%s' (index %d)"), *SlotName, SlotIndex);

    return true;
}

bool USaveManager::DeleteSave(const FString& SlotName, int32 SlotIndex)
{
    const FString FullSlotName = FString::Printf(TEXT("%s_%d"), *SlotName, SlotIndex);

    if (!UGameplayStatics::DoesSaveGameExist(FullSlotName, SlotIndex))
    {
        UE_LOG(LogTemp, Warning, TEXT("SaveManager: Save slot '%s_%d' does not exist for deletion"), *SlotName, SlotIndex);
        return false;
    }

    bool bSuccess = UGameplayStatics::DeleteGameInSlot(FullSlotName, SlotIndex);

    if (bSuccess)
    {
        UE_LOG(LogTemp, Log, TEXT("SaveManager: Deleted save slot '%s' (index %d)"), *SlotName, SlotIndex);
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("SaveManager: Failed to delete save slot '%s' (index %d)"), *SlotName, SlotIndex);
    }

    return bSuccess;
}

bool USaveManager::HasSaveGame(const FString& SlotName, int32 SlotIndex) const
{
    const FString FullSlotName = FString::Printf(TEXT("%s_%d"), *SlotName, SlotIndex);
    return UGameplayStatics::DoesSaveGameExist(FullSlotName, SlotIndex);
}

TArray<USaveGameData*> USaveManager::GetAllSaveSlots() const
{
    TArray<USaveGameData*> SaveSlots;

    // Enumerate user save slots (0 to 9)
    for (int32 i = 0; i < 10; ++i)
    {
        FString SlotName = FString::Printf(TEXT("Slot_%d"), i);
        if (HasSaveGame(SlotName, i))
        {
            const FString FullSlotName = FString::Printf(TEXT("%s_%d"), *SlotName, i);
            USaveGameData* LoadedGame = Cast<USaveGameData>(
                UGameplayStatics::LoadGameFromSlot(FullSlotName, i)
            );
            if (LoadedGame)
            {
                SaveSlots.Add(LoadedGame);
            }
        }
    }

    return SaveSlots;
}

void USaveManager::AutoSave()
{
    // Find next autosave slot
    int32 NextSlot = AutoSaveSlotStart;

    // Check existing autosaves to find the next one
    for (int32 i = AutoSaveSlotStart; i < AutoSaveSlotStart + MaxAutoSaves; ++i)
    {
        FString SlotName = FString::Printf(TEXT("Autosave_%d"), i);
        if (!HasSaveGame(SlotName, i))
        {
            NextSlot = i;
            break;
        }
        NextSlot = i + 1;
    }

    // Wrap around if we've exceeded max autosaves
    if (NextSlot >= AutoSaveSlotStart + MaxAutoSaves)
    {
        NextSlot = AutoSaveSlotStart;
        // Delete the oldest autosave
        FString OldSlotName = FString::Printf(TEXT("Autosave_%d"), NextSlot);
        DeleteSave(OldSlotName, NextSlot);
    }

    FString AutoSlotName = FString::Printf(TEXT("Autosave_%d"), NextSlot);

    // Mark as autosave
    USaveGameData* SaveGameInstance = Cast<USaveGameData>(
        UGameplayStatics::CreateSaveGameObject(USaveGameData::StaticClass())
    );

    if (SaveGameInstance)
    {
        SaveGameInstance->AutosaveSlot = NextSlot;
        // The SaveGame function will handle the rest
    }

    SaveGame(AutoSlotName, NextSlot);
    OnAutosaveTriggered.Broadcast(AutoSlotName);
}

bool USaveManager::QuickSave()
{
    return SaveGame(TEXT("QuickSave"), QuickSaveSlotIndex);
}

bool USaveManager::QuickLoad()
{
    return LoadGame(TEXT("QuickSave"), QuickSaveSlotIndex);
}

void USaveManager::CreateSaveSlot(const FString& SlotName)
{
    // Create an empty save slot
    USaveGameData* NewSave = Cast<USaveGameData>(
        UGameplayStatics::CreateSaveGameObject(USaveGameData::StaticClass())
    );

    if (NewSave)
    {
        NewSave->SaveSlotName = SlotName;
        NewSave->Timestamp = FDateTime::Now().ToString(TEXT("%Y-%m-%d %H:%M:%S"));
        NewSave->PlayerData.PlayerName = SlotName;

        const FString FullSlotName = FString::Printf(TEXT("%s_0"), *SlotName);
        UGameplayStatics::SaveGameToSlot(NewSave, FullSlotName, 0);
    }
}

void USaveManager::SetAutoSaveEnabled(bool bEnabled)
{
    bAutoSaveEnabled = bEnabled;

    if (bAutoSaveEnabled)
    {
        StartAutoSaveTimer();
    }
    else
    {
        StopAutoSaveTimer();
    }
}

void USaveManager::SetAutoSaveInterval(float IntervalSeconds)
{
    AutoSaveInterval = FMath::Max(30.0f, IntervalSeconds); // Minimum 30 seconds

    if (bAutoSaveEnabled)
    {
        StopAutoSaveTimer();
        StartAutoSaveTimer();
    }
}

void USaveManager::StartAutoSaveTimer()
{
    UWorld* World = GetWorld();
    if (World)
    {
        World->GetTimerManager().SetTimer(
            AutoSaveTimerHandle,
            this,
            &USaveManager::AutoSave,
            AutoSaveInterval,
            true // Looping
        );
    }
}

void USaveManager::StopAutoSaveTimer()
{
    UWorld* World = GetWorld();
    if (World)
    {
        World->GetTimerManager().ClearTimer(AutoSaveTimerHandle);
    }
}

void USaveManager::CleanupOldAutoSaves()
{
    // Remove oldest autosaves when exceeding max
    int32 CurrentCount = 0;
    for (int32 i = AutoSaveSlotStart; i < AutoSaveSlotStart + MaxAutoSaves; ++i)
    {
        FString SlotName = FString::Printf(TEXT("Autosave_%d"), i);
        if (HasSaveGame(SlotName, i))
        {
            CurrentCount++;
        }
    }

    while (CurrentCount >= MaxAutoSaves)
    {
        FString OldestSlot = FString::Printf(TEXT("Autosave_%d"), AutoSaveSlotStart);
        DeleteSave(OldestSlot, AutoSaveSlotStart);
        CurrentCount--;
    }
}

FString USaveManager::GetFormattedPlayTime(float TotalSeconds) const
{
    int32 Hours = FMath::FloorToInt(TotalSeconds / 3600.0f);
    int32 Minutes = FMath::FloorToInt(FMath::Fmod(TotalSeconds, 3600.0f) / 60.0f);
    int32 Seconds = FMath::FloorToInt(FMath::Fmod(TotalSeconds, 60.0f));

    return FString::Printf(TEXT("%02d:%02d:%02d"), Hours, Minutes, Seconds);
}
