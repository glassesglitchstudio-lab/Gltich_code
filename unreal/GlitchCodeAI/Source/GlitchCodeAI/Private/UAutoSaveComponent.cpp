#include "UAutoSaveComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Character.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformFileManager.h"

DEFINE_LOG_CATEGORY_STATIC(LogAutoSave, Log, All);

UAutoSaveComponent::UAutoSaveComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UAutoSaveComponent::BeginPlay()
{
    Super::BeginPlay();

    if (bAutoSaveEnabled)
    {
        EnableAutoSave();
    }
}

void UAutoSaveComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (AutoSaveTimerHandle.IsValid())
    {
        GetWorld()->GetTimerManager().ClearTimer(AutoSaveTimerHandle);
    }

    Super::EndPlay(EndPlayReason);
}

void UAutoSaveComponent::EnableAutoSave()
{
    bAutoSaveEnabled = true;
    TimeSinceLastSave = 0.0f;

    if (UWorld* World = GetWorld())
    {
        FTimerManager& TimerManager = World->GetTimerManager();
        
        if (AutoSaveTimerHandle.IsValid())
        {
            TimerManager.ClearTimer(AutoSaveTimerHandle);
        }

        FTimerDelegate TimerDelegate;
        TimerDelegate.BindUObject(this, &UAutoSaveComponent::OnAutoSaveTick);
        TimerManager.SetTimer(AutoSaveTimerHandle, TimerDelegate, SaveInterval, true, SaveInterval);

        UE_LOG(LogAutoSave, Log, TEXT("AutoSave: Enabled with interval %.0f seconds"), SaveInterval);
    }
}

void UAutoSaveComponent::DisableAutoSave()
{
    bAutoSaveEnabled = false;

    if (UWorld* World = GetWorld())
    {
        World->GetTimerManager().ClearTimer(AutoSaveTimerHandle);
    }

    UE_LOG(LogAutoSave, Log, TEXT("AutoSave: Disabled"));
}

void UAutoSaveComponent::SetInterval(float Seconds)
{
    SaveInterval = FMath::Max(10.0f, Seconds);

    if (bAutoSaveEnabled)
    {
        DisableAutoSave();
        EnableAutoSave();
    }

    UE_LOG(LogAutoSave, Log, TEXT("AutoSave: Interval updated to %.0f seconds"), SaveInterval);
}

bool UAutoSaveComponent::ForceSave()
{
    FString SlotName = GenerateSaveSlotName();
    return ForceSaveToSlot(SlotName);
}

bool UAutoSaveComponent::ForceSaveToSlot(const FString& SlotName)
{
    UGlitchSaveGame* SaveGame = CreateSaveGameInstance();
    if (!SaveGame)
    {
        UE_LOG(LogAutoSave, Error, TEXT("AutoSave: Failed to create save game instance"));
        OnSaveCompleted.Broadcast(false);
        return false;
    }

    PopulateSaveGame(SaveGame);

    if (!WriteSaveToFile(SaveGame, SlotName))
    {
        UE_LOG(LogAutoSave, Error, TEXT("AutoSave: Failed to write save to '%s'"), *SlotName);
        OnSaveCompleted.Broadcast(false);
        return false;
    }

    CurrentSaveSlot = SlotName;
    TimeSinceLastSave = 0.0f;

    UE_LOG(LogAutoSave, Log, TEXT("AutoSave: Successfully saved to '%s'"), *SlotName);
    OnSaveCompleted.Broadcast(true);
    return true;
}

bool UAutoSaveComponent::LoadLastSave()
{
    if (CurrentSaveSlot.IsEmpty())
    {
        UE_LOG(LogAutoSave, Warning, TEXT("AutoSave: No previous save slot to load"));
        OnSaveLoaded.Broadcast(false);
        return false;
    }

    return LoadFromSlot(CurrentSaveSlot);
}

bool UAutoSaveComponent::LoadFromSlot(const FString& SlotName)
{
    UGlitchSaveGame* SaveGame = LoadSaveFromFile(SlotName);
    if (!SaveGame)
    {
        UE_LOG(LogAutoSave, Warning, TEXT("AutoSave: Failed to load save from '%s'"), *SlotName);
        OnSaveLoaded.Broadcast(false);
        return false;
    }

    ApplyLoadedSave(SaveGame);

    // Reload the current level to apply the loaded state
    if (UWorld* World = GetWorld())
    {
        FString CurrentLevel = World->GetMapName();
        UGameplayStatics::OpenLevel(World, FName(*CurrentLevel));
    }

    UE_LOG(LogAutoSave, Log, TEXT("AutoSave: Loaded save from '%s'"), *SlotName);
    OnSaveLoaded.Broadcast(true);
    return true;
}

FString UAutoSaveComponent::GetSaveStatus() const
{
    if (CurrentSaveSlot.IsEmpty())
    {
        return TEXT("No saves");
    }

    return FString::Printf(TEXT("Slot: '%s' | Last save: %.0fs ago | Index: %d"), 
        *CurrentSaveSlot, TimeSinceLastSave, CurrentSaveIndex);
}

TArray<FSaveMetadata> UAutoSaveComponent::GetAllSaveSlots() const
{
    TArray<FSaveMetadata> SaveSlots;

    FString SaveDir = FPaths::ProjectSavedDir() / TEXT("Saves");
    TArray<FString> SaveFiles;
    
    IFileManager& FileManager = IFileManager::Get();
    FileManager.FindFiles(SaveFiles, *(SaveDir / TEXT("*.sav")), true, false);

    for (const FString& FileName : SaveFiles)
    {
        FString SlotName = FPaths::GetBaseFilename(FileName);
        UGlitchSaveGame* SaveGame = LoadSaveFromFile(SlotName);
        if (SaveGame)
        {
            SaveSlots.Add(ExtractMetadata(SaveGame));
        }
    }

    return SaveSlots;
}

void UAutoSaveComponent::OnAutoSaveTick()
{
    TimeSinceLastSave += SaveInterval;

    if (bAutoSaveEnabled)
    {
        ForceSave();
    }
}

FString UAutoSaveComponent::GenerateSaveSlotName() const
{
    CurrentSaveIndex = (CurrentSaveIndex + 1) % MaxSaves;
    return FString::Printf(TEXT("autosave_%d"), CurrentSaveIndex);
}

UGlitchSaveGame* UAutoSaveComponent::CreateSaveGameInstance() const
{
    return Cast<UGlitchSaveGame>(
        UGameplayStatics::CreateSaveGameObject(UGlitchSaveGame::StaticClass()));
}

void UAutoSaveComponent::PopulateSaveGame(UGlitchSaveGame* SaveGame) const
{
    if (!SaveGame) return;

    UWorld* World = GetWorld();
    if (!World) return;

    SaveGame->SaveTimestamp = FDateTime::UtcNow();
    SaveGame->LevelName = World->GetMapName();

    // Capture player state
    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (PC && PC->GetPawn())
    {
        SaveGame->PlayerLocation = PC->GetPawn()->GetActorLocation();
        SaveGame->PlayerRotation = PC->GetPawn()->GetActorRotation();
    }

    // Capture game mode state (override in subclass for game-specific data)
    SaveGame->GameStateData.Add(TEXT("playTime"), FString::SanitizeFloat(TimeSinceLastSave));
    SaveGame->GameStateData.Add(TEXT("saveIndex"), FString::FromInt(CurrentSaveIndex));
    SaveGame->GameStateData.Add(TEXT("bAutoSave"), bAutoSaveEnabled ? TEXT("true") : TEXT("false"));
}

bool UAutoSaveComponent::WriteSaveToFile(UGlitchSaveGame* SaveGame, const FString& SlotName)
{
    if (!SaveGame) return false;

    FString SavePath = GetSaveFilePath(SlotName);
    FString SaveDir = FPaths::GetPath(SavePath);

    // Ensure save directory exists
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*SaveDir))
    {
        FileManager.MakeDirectory(*SaveDir, true);
    }

    // Serialize save game to slot
    SaveGame->SlotName = SlotName;
    return UGameplayStatics::SaveGameToSlot(SaveGame, SlotName, 0);
}

UGlitchSaveGame* UAutoSaveComponent::LoadSaveFromFile(const FString& SlotName) const
{
    FString SavePath = GetSaveFilePath(SlotName);
    
    if (!FPaths::FileExists(SavePath))
    {
        return nullptr;
    }

    USaveGame* LoadedGame = UGameplayStatics::LoadGameFromSlot(SlotName, 0);
    return Cast<UGlitchSaveGame>(LoadedGame);
}

void UAutoSaveComponent::ApplyLoadedSave(UGlitchSaveGame* SaveGame)
{
    if (!SaveGame) return;

    UWorld* World = GetWorld();
    if (!World) return;

    // Restore player position
    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (PC && PC->GetPawn())
    {
        PC->GetPawn()->SetActorLocation(SaveGame->PlayerLocation);
        PC->GetPawn()->SetActorRotation(SaveGame->PlayerRotation);
    }

    // Restore time since last save
    const FString* PlayTimeStr = SaveGame->GameStateData.Find(TEXT("playTime"));
    if (PlayTimeStr)
    {
        TimeSinceLastSave = FCString::Atof(**PlayTimeStr);
    }
}

FString UAutoSaveComponent::GetSaveFilePath(const FString& SlotName) const
{
    return FPaths::ProjectSavedDir() / TEXT("Saves") / (SlotName + TEXT(".sav"));
}

FSaveMetadata UAutoSaveComponent::ExtractMetadata(const UGlitchSaveGame* SaveGame) const
{
    FSaveMetadata Meta;
    if (SaveGame)
    {
        Meta.SlotName = SaveGame->SlotName;
        Meta.Timestamp = SaveGame->SaveTimestamp;
        Meta.PlayTime = SaveGame->PlayTimeSeconds;
        Meta.LevelName = SaveGame->LevelName;
        Meta.PlayerPosition = SaveGame->PlayerLocation;
        Meta.Version = SaveGame->SaveVersion;
    }
    return Meta;
}
