#include "UCloudSaveComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformFileManager.h"

DEFINE_LOG_CATEGORY_STATIC(LogCloudSave, Log, All);

UCloudSaveComponent::UCloudSaveComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

bool UCloudSaveComponent::UploadSave(const FString& SlotName)
{
    if (SlotName.IsEmpty())
    {
        UE_LOG(LogCloudSave, Warning, TEXT("CloudSave: Upload called with empty slot name"));
        return false;
    }

    // Try online subsystem first
    IOnlineSubsystem* OnlineSub = IOnlineSubsystem::Get();
    if (OnlineSub && IsCloudAvailable())
    {
        UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Uploading '%s' via online subsystem '%s'"), 
            *SlotName, *OnlineSub->GetSubsystemName());
        
        // IOnlineSubsystem cloud storage API would go here
        // For now, fall through to local fallback
    }

    // Fallback: local cloud sync directory
    if (UploadToLocalCloud(SlotName))
    {
        OnCloudUpload.Broadcast(SlotName);
        return true;
    }

    return false;
}

bool UCloudSaveComponent::DownloadSave(const FString& SlotName)
{
    if (SlotName.IsEmpty()) return false;

    IOnlineSubsystem* OnlineSub = IOnlineSubsystem::Get();
    if (OnlineSub && IsCloudAvailable())
    {
        UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Downloading '%s' via online subsystem"), *SlotName);
    }

    if (DownloadFromLocalCloud(SlotName))
    {
        OnCloudDownload.Broadcast(SlotName);
        return true;
    }

    return false;
}

void UCloudSaveComponent::SyncSaves()
{
    if (bIsSyncing)
    {
        UE_LOG(LogCloudSave, Warning, TEXT("CloudSave: Sync already in progress"));
        return;
    }

    bIsSyncing = true;
    UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Starting sync..."));

    CachedCloudSaves.Empty();

    FString CloudDir = GetCloudSyncDir();
    TArray<FString> CloudFiles;
    
    IFileManager& FileManager = IFileManager::Get();
    FileManager.FindFiles(CloudFiles, *(CloudDir / TEXT("*.sav")), true, false);

    for (const FString& CloudFile : CloudFiles)
    {
        FString SlotName = FPaths::GetBaseFilename(CloudFile);
        FString CloudPath = GetCloudSyncPath(SlotName);
        FString LocalPath = GetLocalSavePath(SlotName);

        FCloudSaveInfo Info;
        Info.SlotName = SlotName;
        Info.CloudTimestamp = GetFileTimestamp(CloudPath);
        Info.FileSize = GetFileSize(CloudPath);

        if (FPaths::FileExists(LocalPath))
        {
            Info.LocalTimestamp = GetFileTimestamp(LocalPath);
            Info.bNeedsSync = Info.CloudTimestamp > Info.LocalTimestamp;
        }
        else
        {
            Info.bNeedsSync = true;
        }

        CachedCloudSaves.Add(Info);

        // Auto-download if cloud is newer
        if (Info.bNeedsSync)
        {
            DownloadSave(SlotName);
        }
    }

    bIsSyncing = false;
    OnCloudSync.Broadcast(true);
    UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Sync complete, %d saves checked"), CachedCloudSaves.Num());
}

TArray<FCloudSaveInfo> UCloudSaveComponent::ListCloudSaves() const
{
    return CachedCloudSaves;
}

bool UCloudSaveComponent::DeleteCloudSave(const FString& SlotName)
{
    FString CloudPath = GetCloudSyncPath(SlotName);

    if (!FPaths::FileExists(CloudPath))
    {
        UE_LOG(LogCloudSave, Warning, TEXT("CloudSave: '%s' not found in cloud"), *SlotName);
        return false;
    }

    IFileManager& FileManager = IFileManager::Get();
    bool bDeleted = FileManager.Delete(*CloudPath);

    if (bDeleted)
    {
        UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Deleted '%s' from cloud"), *SlotName);
    }

    return bDeleted;
}

bool UCloudSaveComponent::IsCloudAvailable() const
{
    // Check if cloud sync directory is accessible
    FString CloudDir = GetCloudSyncDir();
    return EnsureDirectoryExists(CloudDir);
}

bool UCloudSaveComponent::UploadToLocalCloud(const FString& SlotName)
{
    FString SourcePath = GetLocalSavePath(SlotName);
    FString DestPath = GetCloudSyncPath(SlotName);

    if (!FPaths::FileExists(SourcePath))
    {
        UE_LOG(LogCloudSave, Warning, TEXT("CloudSave: Local save '%s' not found"), *SlotName);
        return false;
    }

    if (!EnsureDirectoryExists(GetCloudSyncDir()))
    {
        return false;
    }

    IFileManager& FileManager = IFileManager::Get();
    bool bCopied = FileManager.Copy(*DestPath, *SourcePath, true);

    if (bCopied)
    {
        UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Uploaded '%s' to local cloud sync"), *SlotName);
    }

    return bCopied;
}

bool UCloudSaveComponent::DownloadFromLocalCloud(const FString& SlotName)
{
    FString SourcePath = GetCloudSyncPath(SlotName);
    FString DestPath = GetLocalSavePath(SlotName);

    if (!FPaths::FileExists(SourcePath))
    {
        UE_LOG(LogCloudSave, Warning, TEXT("CloudSave: Cloud save '%s' not found"), *SlotName);
        return false;
    }

    FString DestDir = FPaths::GetPath(DestPath);
    if (!EnsureDirectoryExists(DestDir))
    {
        return false;
    }

    IFileManager& FileManager = IFileManager::Get();
    bool bCopied = FileManager.Copy(*DestPath, *SourcePath, true);

    if (bCopied)
    {
        UE_LOG(LogCloudSave, Log, TEXT("CloudSave: Downloaded '%s' from local cloud"), *SlotName);
    }

    return bCopied;
}

FString UCloudSaveComponent::GetCloudSyncDir() const
{
    return FPaths::ProjectSavedDir() / LocalSavePath;
}

FString UCloudSaveComponent::GetCloudSyncPath(const FString& SlotName) const
{
    return GetCloudSyncDir() / (SlotName + TEXT(".sav"));
}

FString UCloudSaveComponent::GetLocalSavePath(const FString& SlotName) const
{
    return FPaths::ProjectSavedDir() / TEXT("Saves") / (SlotName + TEXT(".sav"));
}

bool UCloudSaveComponent::EnsureDirectoryExists(const FString& DirPath) const
{
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*DirPath))
    {
        return FileManager.MakeDirectory(*DirPath, true);
    }
    return true;
}

FDateTime UCloudSaveComponent::GetFileTimestamp(const FString& FilePath) const
{
    IFileManager& FileManager = IFileManager::Get();
    FDateTime Timestamp;
    FileManager.GetTimeStamp(*FilePath, Timestamp);
    return Timestamp;
}

int64 UCloudSaveComponent::GetFileSize(const FString& FilePath) const
{
    IFileManager& FileManager = IFileManager::Get();
    return FileManager.FileSize(*FilePath);
}
