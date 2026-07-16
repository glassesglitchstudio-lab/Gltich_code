#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UPluginLogsComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLogEntry, const FString&, Message);

UENUM(BlueprintType)
enum class ELogLevel : uint8
{
    Fatal   = 0 UMETA(DisplayName = "Fatal"),
    Error   = 1 UMETA(DisplayName = "Error"),
    Warning = 2 UMETA(DisplayName = "Warning"),
    Display = 3 UMETA(DisplayName = "Display"),
    Log     = 4 UMETA(DisplayName = "Log"),
    Verbose = 5 UMETA(DisplayName = "Verbose"),
    VeryVerbose = 6 UMETA(DisplayName = "VeryVerbose")
};

USTRUCT(BlueprintType)
struct FLogEntry
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString Message;

    UPROPERTY(BlueprintReadOnly)
    ELogLevel Level = ELogLevel::Log;

    UPROPERTY(BlueprintReadOnly)
    FString Category;

    UPROPERTY(BlueprintReadOnly)
    FDateTime Timestamp;

    UPROPERTY(BlueprintReadOnly)
    FString File;

    UPROPERTY(BlueprintReadOnly)
    int32 Line = 0;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UPluginLogsComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPluginLogsComponent();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Logs")
    bool ReadLog(const FString& FilePath = TEXT(""));

    UFUNCTION(BlueprintCallable, Category = "Plugin|Logs")
    TArray<FLogEntry> FilterLogs(ELogLevel MinLevel = ELogLevel::Log, 
        const FString& Pattern = TEXT("")) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Logs")
    bool ExportLog(const FString& DestinationPath) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Logs")
    void ClearLog();

    UFUNCTION(BlueprintCallable, Category = "Plugin|Logs")
    void AddLogEntry(const FString& Message, ELogLevel Level = ELogLevel::Log, 
        const FString& Category = TEXT("Plugin"));

    UFUNCTION(BlueprintPure, Category = "Plugin|Logs")
    int32 GetLogEntryCount() const { return LogEntries.Num(); }

    UFUNCTION(BlueprintPure, Category = "Plugin|Logs")
    TArray<FLogEntry> GetRecentEntries(int32 Count = 50) const;

    UFUNCTION(BlueprintPure, Category = "Plugin|Logs")
    FString GetLogFilePath() const { return LogFilePath; }

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Logs")
    FString LogFilePath = TEXT("Logs/PluginLogs.log");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Logs", meta = (ClampMin = "1024"))
    int64 MaxLogSize = 10 * 1024 * 1024; // 10MB

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Logs")
    ELogLevel MinLogLevel = ELogLevel::Log;

    UPROPERTY(BlueprintAssignable)
    FOnLogEntry OnLogEntry;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Plugin|Logs")
    TArray<FLogEntry> LogEntries;

private:
    FString GetFullLogPath() const;
    ELogLevel ParseLogLevel(const FString& LevelStr) const;
    FString LogLevelToString(ELogLevel Level) const;
    bool EnsureDirectoryExists(const FString& DirPath) const;
    void RotateLogIfNeeded();
};
