#include "UPluginLogsComponent.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/OutputDeviceFile.h"

DEFINE_LOG_CATEGORY_STATIC(LogPluginLogs, Log, All);

UPluginLogsComponent::UPluginLogsComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UPluginLogsComponent::BeginPlay()
{
    Super::BeginPlay();

    // Ensure log directory exists
    FString LogDir = FPaths::GetPath(GetFullLogPath());
    EnsureDirectoryExists(LogDir);

    UE_LOG(LogPluginLogs, Log, TEXT("PluginLogs: Initialized, log path='%s'"), *LogFilePath);
}

bool UPluginLogsComponent::ReadLog(const FString& FilePath)
{
    FString TargetPath = FilePath.IsEmpty() ? GetFullLogPath() : FilePath;

    if (!FPaths::FileExists(TargetPath))
    {
        UE_LOG(LogPluginLogs, Warning, TEXT("PluginLogs: Log file not found '%s'"), *TargetPath);
        return false;
    }

    FString Content;
    if (!FFileHelper::LoadFileToString(Content, *TargetPath))
    {
        UE_LOG(LogPluginLogs, Error, TEXT("PluginLogs: Failed to read '%s'"), *TargetPath);
        return false;
    }

    LogEntries.Empty();

    TArray<FString> Lines;
    Content.ParseIntoArrayLines(Lines, false);

    for (const FString& Line : Lines)
    {
        if (Line.IsEmpty()) continue;

        FLogEntry Entry;
        Entry.Timestamp = FDateTime::UtcNow();

        // Parse log line format: [Level] Category: Message
        if (Line.StartsWith(TEXT("[")))
        {
            int32 BracketEnd = Line.Find(TEXT("]"));
            if (BracketEnd != INDEX_NONE)
            {
                FString LevelStr = Line.Mid(1, BracketEnd - 1);
                Entry.Level = ParseLogLevel(LevelStr);

                FString Remainder = Line.Mid(BracketEnd + 2);
                int32 ColonIndex;
                if (Remainder.FindChar(TEXT(':'), ColonIndex))
                {
                    Entry.Category = Remainder.Left(ColonIndex).TrimStartAndEnd();
                    Entry.Message = Remainder.Mid(ColonIndex + 2).TrimStartAndEnd();
                }
                else
                {
                    Entry.Message = Remainder;
                }
            }
        }
        else
        {
            Entry.Message = Line;
            Entry.Level = ELogLevel::Log;
            Entry.Category = TEXT("Unknown");
        }

        LogEntries.Add(Entry);
    }

    UE_LOG(LogPluginLogs, Log, TEXT("PluginLogs: Read %d entries from '%s'"), LogEntries.Num(), *TargetPath);
    return true;
}

TArray<FLogEntry> UPluginLogsComponent::FilterLogs(ELogLevel MinLevel, const FString& Pattern) const
{
    TArray<FLogEntry> Filtered;

    for (const FLogEntry& Entry : LogEntries)
    {
        if (Entry.Level > MinLevel) continue;

        if (!Pattern.IsEmpty() && !Entry.Message.Contains(Pattern) && !Entry.Category.Contains(Pattern))
        {
            continue;
        }

        Filtered.Add(Entry);
    }

    return Filtered;
}

bool UPluginLogsComponent::ExportLog(const FString& DestinationPath) const
{
    FString ExportPath = DestinationPath.IsEmpty() ? 
        GetFullLogPath() + TEXT(".export") : DestinationPath;

    FString Dir = FPaths::GetPath(ExportPath);
    if (!EnsureDirectoryExists(Dir))
    {
        return false;
    }

    FString Content;
    for (const FLogEntry& Entry : LogEntries)
    {
        Content += FString::Printf(TEXT("[%s] %s: %s\n"), 
            *LogLevelToString(Entry.Level), *Entry.Category, *Entry.Message);
    }

    bool bSuccess = FFileHelper::SaveStringToFile(Content, *ExportPath);

    if (bSuccess)
    {
        UE_LOG(LogPluginLogs, Log, TEXT("PluginLogs: Exported %d entries to '%s'"), 
            LogEntries.Num(), *ExportPath);
    }

    return bSuccess;
}

void UPluginLogsComponent::ClearLog()
{
    LogEntries.Empty();
    UE_LOG(LogPluginLogs, Log, TEXT("PluginLogs: Log cleared"));
}

void UPluginLogsComponent::AddLogEntry(const FString& Message, ELogLevel Level, const FString& Category)
{
    FLogEntry Entry;
    Entry.Message = Message;
    Entry.Level = Level;
    Entry.Category = Category;
    Entry.Timestamp = FDateTime::UtcNow();

    LogEntries.Add(Entry);

    // Trim if too large
    while (LogEntries.Num() > 10000)
    {
        LogEntries.RemoveAt(0);
    }

    // Write to file
    FString LogLine = FString::Printf(TEXT("[%s] %s: %s\n"), 
        *LogLevelToString(Level), *Category, *Message);

    FString FullPath = GetFullLogPath();
    FFileHelper::SaveStringToFile(LogLine, *FullPath, EFileHelper::FileOptions::None, 
        &FPlatformFileManager::Get().GetPlatformFile());

    RotateLogIfNeeded();

    OnLogEntry.Broadcast(Message);
}

TArray<FLogEntry> UPluginLogsComponent::GetRecentEntries(int32 Count) const
{
    TArray<FLogEntry> Recent;
    int32 StartIndex = FMath::Max(0, LogEntries.Num() - Count);

    for (int32 i = StartIndex; i < LogEntries.Num(); ++i)
    {
        Recent.Add(LogEntries[i]);
    }

    return Recent;
}

FString UPluginLogsComponent::GetFullLogPath() const
{
    if (FPaths::IsRelative(LogFilePath))
    {
        return FPaths::ProjectDir() / LogFilePath;
    }
    return LogFilePath;
}

ELogLevel UPluginLogsComponent::ParseLogLevel(const FString& LevelStr) const
{
    if (LevelStr.Equals(TEXT("Fatal"), ESearchCase::IgnoreCase)) return ELogLevel::Fatal;
    if (LevelStr.Equals(TEXT("Error"), ESearchCase::IgnoreCase)) return ELogLevel::Error;
    if (LevelStr.Equals(TEXT("Warning"), ESearchCase::IgnoreCase)) return ELogLevel::Warning;
    if (LevelStr.Equals(TEXT("Display"), ESearchCase::IgnoreCase)) return ELogLevel::Display;
    if (LevelStr.Equals(TEXT("Log"), ESearchCase::IgnoreCase)) return ELogLevel::Log;
    if (LevelStr.Equals(TEXT("Verbose"), ESearchCase::IgnoreCase)) return ELogLevel::Verbose;
    if (LevelStr.Equals(TEXT("VeryVerbose"), ESearchCase::IgnoreCase)) return ELogLevel::VeryVerbose;
    return ELogLevel::Log;
}

FString UPluginLogsComponent::LogLevelToString(ELogLevel Level) const
{
    switch (Level)
    {
    case ELogLevel::Fatal:       return TEXT("Fatal");
    case ELogLevel::Error:       return TEXT("Error");
    case ELogLevel::Warning:     return TEXT("Warning");
    case ELogLevel::Display:     return TEXT("Display");
    case ELogLevel::Log:         return TEXT("Log");
    case ELogLevel::Verbose:     return TEXT("Verbose");
    case ELogLevel::VeryVerbose: return TEXT("VeryVerbose");
    default:                     return TEXT("Unknown");
    }
}

bool UPluginLogsComponent::EnsureDirectoryExists(const FString& DirPath) const
{
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*DirPath))
    {
        return FileManager.MakeDirectory(*DirPath, true);
    }
    return true;
}

void UPluginLogsComponent::RotateLogIfNeeded()
{
    FString FullPath = GetFullLogPath();
    IFileManager& FileManager = IFileManager::Get();

    if (FileManager.FileSize(*FullPath) > MaxLogSize)
    {
        FString BackupPath = FullPath + TEXT(".") + FDateTime::UtcNow().ToString(TEXT("%Y%m%d_%H%M%S"));
        FileManager.Move(*BackupPath, *FullPath);
        UE_LOG(LogPluginLogs, Log, TEXT("PluginLogs: Rotated log to '%s'"), *BackupPath);
    }
}
