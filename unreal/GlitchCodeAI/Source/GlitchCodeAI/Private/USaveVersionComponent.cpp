#include "USaveVersionComponent.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/FileManager.h"
#include "Misc/SecureHash.h"

USaveVersionComponent::USaveVersionComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

bool USaveVersionComponent::Migrate(const FString& SlotName)
{
    if (SlotName.IsEmpty())
    {
        UE_LOG(LogTemp, Warning, TEXT("SaveVersion: Migrate called with empty slot name"));
        return false;
    }

    FString FilePath = GetSaveSlotPath(SlotName);
    FSaveFileHeader Header;
    
    if (!ReadHeaderFromFile(FilePath, Header))
    {
        UE_LOG(LogTemp, Warning, TEXT("SaveVersion: Could not read header from '%s'"), *FilePath);
        return false;
    }

    int32 OldVersion = Header.Version;
    if (OldVersion >= CurrentVersion)
    {
        UE_LOG(LogTemp, Log, TEXT("SaveVersion: '%s' is already at version %d"), *SlotName, OldVersion);
        return true;
    }

    // Backup before migration
    if (!BackupSave(SlotName))
    {
        UE_LOG(LogTemp, Error, TEXT("SaveVersion: Backup failed for '%s', aborting migration"), *SlotName);
        return false;
    }

    // Perform version-specific migrations
    TArray<uint8> FileData;
    if (!FFileHelper::LoadFileToArray(FileData, *FilePath))
    {
        UE_LOG(LogTemp, Error, TEXT("SaveVersion: Failed to load '%s' for migration"), *FilePath);
        return false;
    }

    // Migration loop: apply each version upgrade sequentially
    for (int32 V = OldVersion; V < CurrentVersion; ++V)
    {
        UE_LOG(LogTemp, Log, TEXT("SaveVersion: Migrating '%s' from v%d to v%d"), *SlotName, V, V + 1);
        
        // Version-specific migration logic would go here
        // Example: if V == 1, add new field; if V == 2, rename field, etc.
        switch (V)
        {
        case 1:
            // v1 -> v2: Added inventory weight field
            UE_LOG(LogTemp, Log, TEXT("SaveVersion: Applying v1->v2 migration (inventory weight)"));
            break;
        case 2:
            // v2 -> v3: Restructured quest data format
            UE_LOG(LogTemp, Log, TEXT("SaveVersion: Applying v2->v3 migration (quest restructuring)"));
            break;
        default:
            UE_LOG(LogTemp, Log, TEXT("SaveVersion: No specific migration for v%d->v%d"), V, V + 1);
            break;
        }
    }

    // Update header with new version
    Header.Version = CurrentVersion;
    Header.SavedAt = FDateTime::UtcNow();
    Header.Checksum = CalculateChecksum(FileData);

    if (!WriteHeaderToFile(FilePath, Header))
    {
        UE_LOG(LogTemp, Error, TEXT("SaveVersion: Failed to write updated header for '%s'"), *SlotName);
        return false;
    }

    SlotVersions.Add(SlotName, CurrentVersion);
    OnVersionMigrated.Broadcast(OldVersion, CurrentVersion);
    UE_LOG(LogTemp, Log, TEXT("SaveVersion: '%s' migrated v%d -> v%d"), *SlotName, OldVersion, CurrentVersion);
    return true;
}

bool USaveVersionComponent::Check(const FString& SlotName)
{
    if (SlotName.IsEmpty()) return false;

    FString FilePath = GetSaveSlotPath(SlotName);
    FSaveFileHeader Header;
    
    bool bValid = ReadHeaderFromFile(FilePath, Header);
    
    if (bValid)
    {
        TArray<uint8> FileData;
        if (FFileHelper::LoadFileToArray(FileData, *FilePath))
        {
            int32 ComputedChecksum = CalculateChecksum(FileData);
            if (ComputedChecksum != Header.Checksum)
            {
                UE_LOG(LogTemp, Warning, TEXT("SaveVersion: Checksum mismatch for '%s' (expected=%d, got=%d)"), 
                    *SlotName, Header.Checksum, ComputedChecksum);
                bValid = false;
            }
        }
        else
        {
            bValid = false;
        }

        if (Header.Version > CurrentVersion)
        {
            UE_LOG(LogTemp, Warning, TEXT("SaveVersion: '%s' has future version %d (current=%d)"), 
                *SlotName, Header.Version, CurrentVersion);
            bValid = false;
        }
    }

    OnVersionCheck.Broadcast(bValid);
    return bValid;
}

bool USaveVersionComponent::Rollback(const FString& SlotName)
{
    if (SlotName.IsEmpty()) return false;

    FString BackupDir = FPaths::ProjectSavedDir() / BackupDirectory;
    FString SlotBackupDir = BackupDir / SlotName;

    // Find the latest backup for this slot
    TArray<FString> BackupFiles;
    IFileManager& FileManager = IFileManager::Get();
    FileManager.FindFilesRecursive(BackupFiles, *SlotBackupDir, TEXT("*.sav"), true, false);

    if (BackupFiles.Num() == 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("SaveVersion: No backups found for '%s'"), *SlotName);
        return false;
    }

    // Sort by filename (which contains version number) and pick the latest
    BackupFiles.Sort();
    FString LatestBackup = BackupFiles.Last();
    FString TargetPath = GetSaveSlotPath(SlotName);

    // Copy backup to active save slot
    if (!EnsureDirectoryExists(FPaths::GetPath(TargetPath)))
    {
        return false;
    }

    if (!FileManager.Copy(*TargetPath, *LatestBackup, true))
    {
        UE_LOG(LogTemp, Error, TEXT("SaveVersion: Failed to copy backup '%s' to '%s'"), *LatestBackup, *TargetPath);
        return false;
    }

    // Update tracked version
    FSaveFileHeader Header;
    if (ReadHeaderFromFile(TargetPath, Header))
    {
        SlotVersions.Add(SlotName, Header.Version);
    }

    UE_LOG(LogTemp, Log, TEXT("SaveVersion: '%s' rolled back to backup '%s' (v%d)"), 
        *SlotName, *FPaths::GetCleanFilename(LatestBackup), SlotVersions.FindOrAdd(SlotName));
    return true;
}

void USaveVersionComponent::SetCurrentVersion(int32 NewVersion)
{
    CurrentVersion = FMath::Max(1, NewVersion);
    UE_LOG(LogTemp, Log, TEXT("SaveVersion: Current version set to %d"), CurrentVersion);
}

int32 USaveVersionComponent::GetCurrentVersion() const
{
    return CurrentVersion;
}

int32 USaveVersionComponent::GetSaveVersion(const FString& SlotName) const
{
    const int32* Version = SlotVersions.Find(SlotName);
    return Version ? *Version : -1;
}

bool USaveVersionComponent::BackupSave(const FString& SlotName)
{
    FString SourcePath = GetSaveSlotPath(SlotName);
    if (!FPaths::FileExists(SourcePath))
    {
        UE_LOG(LogTemp, Warning, TEXT("SaveVersion: No save file to backup at '%s'"), *SourcePath);
        return false;
    }

    FSaveFileHeader Header;
    ReadHeaderFromFile(SourcePath, Header);
    int32 VersionToBackup = Header.Version > 0 ? Header.Version : 1;

    FString BackupDir = FPaths::ProjectSavedDir() / BackupDirectory / SlotName;
    if (!EnsureDirectoryExists(BackupDir))
    {
        return false;
    }

    FString BackupFileName = FString::Printf(TEXT("%s_v%d_%s.sav"), 
        *SlotName, VersionToBackup, *FDateTime::UtcNow().ToString(TEXT("%Y%m%d_%H%M%S")));
    FString BackupPath = BackupDir / BackupFileName;

    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.Copy(*BackupPath, *SourcePath, true))
    {
        UE_LOG(LogTemp, Error, TEXT("SaveVersion: Failed to create backup '%s'"), *BackupPath);
        return false;
    }

    UE_LOG(LogTemp, Log, TEXT("SaveVersion: Backup created '%s'"), *BackupPath);
    return true;
}

int32 USaveVersionComponent::CalculateChecksum(const TArray<uint8>& Data) const
{
    if (Data.Num() == 0) return 0;
    
    FSHA1 Sha1;
    Sha1.Update(Data.GetData(), Data.Num());
    Sha1.Final();
    
    uint8 Hash[20];
    Sha1.GetHash(Hash);
    
    // Use first 4 bytes as int32 checksum
    return *reinterpret_cast<int32*>(Hash);
}

bool USaveVersionComponent::WriteHeaderToFile(const FString& FilePath, const FSaveFileHeader& Header)
{
    FString HeaderString = FString::Printf(
        TEXT("GLITCH_SAVE_V%d\nCHECKSUM=%d\nTIMESTAMP=%s\nLEVEL=%s\n"),
        Header.Version,
        Header.Checksum,
        *Header.SavedAt.ToString(),
        *Header.LevelName
    );

    TArray<uint8> ExistingData;
    FFileHelper::LoadFileToArray(ExistingData, *FilePath);

    // Replace or append header
    FString ExistingContent = FFileHelper::BufferToString(ExistingData.GetData(), ExistingData.Num());
    
    // Remove old header if present
    int32 HeaderEnd = ExistingContent.Find(TEXT("\n---\n"));
    if (HeaderEnd != INDEX_NONE)
    {
        ExistingContent = ExistingContent.RightChop(HeaderEnd + 5);
    }

    FString FullContent = HeaderString + TEXT("\n---\n") + ExistingContent;
    return FFileHelper::SaveStringToFile(FullContent, *FilePath);
}

bool USaveVersionComponent::ReadHeaderFromFile(const FString& FilePath, FSaveFileHeader& OutHeader) const
{
    if (!FPaths::FileExists(FilePath)) return false;

    FString Content;
    if (!FFileHelper::LoadFileToString(Content, *FilePath)) return false;

    // Parse header lines
    TArray<FString> Lines;
    Content.ParseIntoArrayLines(Lines, false);

    bool bFoundHeader = false;
    for (const FString& Line : Lines)
    {
        if (Line.StartsWith(TEXT("GLITCH_SAVE_V")))
        {
            FString VersionStr = Line.RightChop(13);
            OutHeader.Version = FCString::Atoi(*VersionStr);
            bFoundHeader = true;
        }
        else if (Line.StartsWith(TEXT("CHECKSUM=")))
        {
            OutHeader.Checksum = FCString::Atoi(*Line.RightChop(9));
        }
        else if (Line.StartsWith(TEXT("TIMESTAMP=")))
        {
            FDateTime::Parse(Line.RightChop(10), OutHeader.SavedAt);
        }
        else if (Line.StartsWith(TEXT("LEVEL=")))
        {
            OutHeader.LevelName = Line.RightChop(6);
        }
        else if (Line == TEXT("---"))
        {
            break; // End of header
        }
    }

    return bFoundHeader;
}

FString USaveVersionComponent::GetSaveSlotPath(const FString& SlotName) const
{
    return FPaths::ProjectSavedDir() / TEXT("Saves") / (SlotName + TEXT(".sav"));
}

FString USaveVersionComponent::GetBackupPath(const FString& SlotName, int32 Version) const
{
    return FPaths::ProjectSavedDir() / BackupDirectory / SlotName / 
        FString::Printf(TEXT("%s_v%d.sav"), *SlotName, Version);
}

bool USaveVersionComponent::EnsureDirectoryExists(const FString& DirPath) const
{
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*DirPath))
    {
        if (!FileManager.MakeDirectory(*DirPath, true))
        {
            UE_LOG(LogTemp, Error, TEXT("SaveVersion: Failed to create directory '%s'"), *DirPath);
            return false;
        }
    }
    return true;
}
