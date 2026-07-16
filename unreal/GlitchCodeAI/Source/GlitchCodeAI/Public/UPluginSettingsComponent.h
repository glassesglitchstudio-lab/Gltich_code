#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UPluginSettingsComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnSettingChanged, const FString&, Key, const FString&, Value);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSettingsLoaded, bool, bSuccess);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UPluginSettingsComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPluginSettingsComponent();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    FString GetString(const FString& Key, const FString& Section = TEXT("General")) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    void SetString(const FString& Key, const FString& Value, const FString& Section = TEXT("General"));

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    int32 GetInt(const FString& Key, int32 Default = 0, const FString& Section = TEXT("General")) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    void SetInt(const FString& Key, int32 Value, const FString& Section = TEXT("General"));

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    float GetFloat(const FString& Key, float Default = 0.0f, const FString& Section = TEXT("General")) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    void SetFloat(const FString& Key, float Value, const FString& Section = TEXT("General"));

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    bool GetBool(const FString& Key, bool bDefault = false, const FString& Section = TEXT("General")) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    void SetBool(const FString& Key, bool bValue, const FString& Section = TEXT("General"));

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    bool SaveSettings();

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    bool LoadSettings();

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    bool ExportToJson(const FString& FilePath) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    bool ImportFromJson(const FString& FilePath);

    UFUNCTION(BlueprintCallable, Category = "Plugin|Settings")
    void ResetToDefaults();

    UFUNCTION(BlueprintPure, Category = "Plugin|Settings")
    FString GetConfigFilePath() const { return ConfigFilePath; }

    UFUNCTION(BlueprintPure, Category = "Plugin|Settings")
    TMap<FString, FString> GetAllSettings() const { return SettingsMap; }

    UPROPERTY(BlueprintAssignable)
    FOnSettingChanged OnSettingChanged;

    UPROPERTY(BlueprintAssignable)
    FOnSettingsLoaded OnSettingsLoaded;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Settings")
    FString ConfigFilePath = TEXT("Config/PluginSettings.ini");

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Plugin|Settings")
    TMap<FString, FString> SettingsMap;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Settings")
    bool bAutoSave = true;

private:
    void ApplyDefaults();
    FString GetFullConfigPath() const;
};
