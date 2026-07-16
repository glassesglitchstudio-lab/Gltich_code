#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UCloudSaveComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCloudSync, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCloudUpload, const FString&, FileName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCloudDownload, const FString&, FileName);

USTRUCT(BlueprintType)
struct FCloudSaveInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString SlotName;

    UPROPERTY(BlueprintReadOnly)
    FDateTime LocalTimestamp;

    UPROPERTY(BlueprintReadOnly)
    FDateTime CloudTimestamp;

    UPROPERTY(BlueprintReadOnly)
    int64 FileSize = 0;

    UPROPERTY(BlueprintReadOnly)
    bool bNeedsSync = false;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UCloudSaveComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UCloudSaveComponent();

    UFUNCTION(BlueprintCallable, Category = "Save|Cloud")
    bool UploadSave(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Cloud")
    bool DownloadSave(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Cloud")
    void SyncSaves();

    UFUNCTION(BlueprintCallable, Category = "Save|Cloud")
    TArray<FCloudSaveInfo> ListCloudSaves() const;

    UFUNCTION(BlueprintCallable, Category = "Save|Cloud")
    bool DeleteCloudSave(const FString& SlotName);

    UFUNCTION(BlueprintCallable, Category = "Save|Cloud")
    bool IsCloudAvailable() const;

    UFUNCTION(BlueprintPure, Category = "Save|Cloud")
    FString GetCloudServiceName() const { return CloudService; }

    UPROPERTY(BlueprintAssignable)
    FOnCloudSync OnCloudSync;

    UPROPERTY(BlueprintAssignable)
    FOnCloudUpload OnCloudUpload;

    UPROPERTY(BlueprintAssignable)
    FOnCloudDownload OnCloudDownload;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Cloud")
    FString CloudService = TEXT("default");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save|Cloud")
    FString LocalSavePath = TEXT("Saves/CloudSync");

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save|Cloud")
    bool bIsSyncing = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save|Cloud")
    TArray<FCloudSaveInfo> CachedCloudSaves;

private:
    bool UploadToLocalCloud(const FString& SlotName);
    bool DownloadFromLocalCloud(const FString& SlotName);
    FString GetCloudSyncDir() const;
    FString GetCloudSyncPath(const FString& SlotName) const;
    FString GetLocalSavePath(const FString& SlotName) const;
    bool EnsureDirectoryExists(const FString& DirPath) const;
    FDateTime GetFileTimestamp(const FString& FilePath) const;
    int64 GetFileSize(const FString& FilePath) const;
};
