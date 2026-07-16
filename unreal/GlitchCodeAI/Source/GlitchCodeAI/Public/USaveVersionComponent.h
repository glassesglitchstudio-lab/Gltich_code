#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "USaveVersionComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnVersionMigrated, int32, OldVersion, int32, NewVersion);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnVersionCheck, bool, bIsValid);

USTRUCT(BlueprintType)
struct FSaveFileHeader
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    int32 MagicNumber = 0x474C4954; // "GLIT"

    UPROPERTY(BlueprintReadOnly)
    int32 Version = 1;

    UPROPERTY(BlueprintReadOnly)
    int32 Checksum = 0;

    UPROPERTY(BlueprintReadOnly)
    FDateTime SavedAt;

    UPROPERTY(BlueprintReadOnly)
    FString LevelName;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API USaveVersionComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    USaveVersionComponent();

    UFUNCTION(BlueprintCallable, Category = "Save|Version")
    bool Migrate(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Version")
    bool Check(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Version")
    bool Rollback(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Version")
    void SetCurrentVersion(int32 NewVersion);

    UFUNCTION(BlueprintPure, Category = "Save|Version")
    int32 GetCurrentVersion() const;

    UFUNCTION(BlueprintPure, Category = "Save|Version")
    int32 GetSaveVersion(const FString& SlotName) const;

    UPROPERTY(BlueprintAssignable)
    FOnVersionMigrated OnVersionMigrated;

    UPROPERTY(BlueprintAssignable)
    FOnVersionCheck OnVersionCheck;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Version")
    int32 CurrentVersion = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Version")
    FString BackupDirectory = TEXT("Saves/Backups");

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save|Version")
    TMap<FString, int32> SlotVersions;

private:
    bool BackupSave(const FString& SlotName);
    int32 CalculateChecksum(const TArray<uint8>& Data) const;
    bool WriteHeaderToFile(const FString& FilePath, const FSaveFileHeader& Header);
    bool ReadHeaderFromFile(const FString& FilePath, FSaveFileHeader& OutHeader) const;
    FString GetSaveSlotPath(const FString& SlotName) const;
    FString GetBackupPath(const FString& SlotName, int32 Version) const;
    bool EnsureDirectoryExists(const FString& DirPath) const;
};
