#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundCue.h"
#include "UAmbientSoundManager.generated.h"

USTRUCT(BlueprintType)
struct FAmbientSoundEntry
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    int32 SoundID = -1;

    UPROPERTY(BlueprintReadOnly)
    FString SoundPath;

    UPROPERTY(BlueprintReadOnly)
    FVector Location = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    float Volume = 1.0f;

    UPROPERTY(BlueprintReadOnly)
    bool bIsPlaying = false;

    UPROPERTY()
    UAudioComponent* AudioComponent = nullptr;
};

USTRUCT(BlueprintType)
struct FSoundZone
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    int32 ZoneID = -1;

    UPROPERTY(BlueprintReadOnly)
    FVector Center = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    float Radius = 1000.0f;

    UPROPERTY(BlueprintReadOnly)
    FString AmbientSound;
};

USTRUCT(BlueprintType)
struct FReverbSettings
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Density = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Diffusion = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Gain = 0.5f;
};

UCLASS()
class GLITCHCODEAI_API UAmbientSoundManager : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    // Playback
    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    int32 PlayAmbientSound(const FString& SoundPath, FVector Location, float Volume = 1.0f, float FadeInDuration = 1.0f);

    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    bool StopAmbientSound(int32 SoundID, float FadeOutDuration = 1.0f);

    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    void StopAllAmbientSounds(float FadeOutDuration = 1.0f);

    // Volume
    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    void SetGlobalVolume(float Volume);

    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    float GetGlobalVolume() const;

    // Reverb
    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    void SetReverbSettings(float Density, float Diffusion, float Gain);

    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    FReverbSettings GetReverbSettings() const;

    // Sound Zones
    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    int32 AddSoundZone(FVector Center, float Radius, const FString& AmbientSound);

    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    bool RemoveSoundZone(int32 ZoneID);

    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    void ClearSoundZones();

    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    TArray<FSoundZone> GetSoundZones() const;

    // Transitions
    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    void TransitionAmbient(const FString& FromPreset, const FString& ToPreset, float Duration = 2.0f);

    // Presets
    UFUNCTION(BlueprintCallable, Category = "Ambient Sound")
    void ApplyPreset(const FString& PresetName);

    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    FString GetCurrentPreset() const;

    // Queries
    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    bool IsPlaying(int32 SoundID) const;

    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    TArray<FAmbientSoundEntry> GetAllSounds() const;

    UFUNCTION(BlueprintPure, Category = "Ambient Sound")
    int32 GetActiveSoundCount() const;

private:
    UPROPERTY()
    TArray<FAmbientSoundEntry> ActiveSounds;

    UPROPERTY()
    TArray<FSoundZone> SoundZones;

    float GlobalVolume = 1.0f;
    FReverbSettings CurrentReverb;
    FString CurrentPreset;
    int32 NextSoundID = 1;
    int32 NextZoneID = 1;

    void ApplyPresetSounds(const FString& PresetName);
    FString GetSoundPathForPreset(const FString& PresetName, int32 Index) const;
};
