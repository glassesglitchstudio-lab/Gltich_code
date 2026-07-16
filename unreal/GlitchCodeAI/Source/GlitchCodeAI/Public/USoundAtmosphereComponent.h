#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "USoundAtmosphereComponent.generated.h"

USTRUCT(BlueprintType)
struct FSoundLayer
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    FString LayerName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    FString SoundPath;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float Volume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    bool bPlaying = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float FadeInDuration = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float FadeOutDuration = 1.0f;
};

USTRUCT(BlueprintType)
struct FReverbSettings
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float Density = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float Diffusion = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float Gain = 1.0f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAmbientSoundPlayed, const FString&, SoundPath);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAmbientSoundStopped);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSoundLayerAdded, const FString&, LayerName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSoundLayerRemoved, const FString&, LayerName);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API USoundAtmosphereComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    USoundAtmosphereComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "SoundAtmosphere")
    void PlayAmbientSound(const FString& SoundPath, float Volume, float FadeIn);

    UFUNCTION(BlueprintCallable, Category = "SoundAtmosphere")
    void StopAmbientSound(float FadeOut);

    UFUNCTION(BlueprintCallable, Category = "SoundAtmosphere")
    void SetReverbSettings(float Density, float Diffusion, float Gain);

    UFUNCTION(BlueprintCallable, Category = "SoundAtmosphere")
    void SetOcclusionSettings(float NewOcclusion);

    UFUNCTION(BlueprintCallable, Category = "SoundAtmosphere")
    void AddSoundLayer(const FString& LayerName, float Volume);

    UFUNCTION(BlueprintCallable, Category = "SoundAtmosphere")
    void RemoveSoundLayer(const FString& LayerName);

    UFUNCTION(BlueprintPure, Category = "SoundAtmosphere")
    bool IsPlaying() const { return bIsPlaying; }

    UFUNCTION(BlueprintPure, Category = "SoundAtmosphere")
    FString GetCurrentSound() const { return CurrentSoundPath; }

    UFUNCTION(BlueprintPure, Category = "SoundAtmosphere")
    TArray<FSoundLayer> GetSoundLayers() const { return SoundLayers; }

    UPROPERTY(BlueprintAssignable, Category = "SoundAtmosphere")
    FOnAmbientSoundPlayed OnAmbientSoundPlayed;

    UPROPERTY(BlueprintAssignable, Category = "SoundAtmosphere")
    FOnAmbientSoundStopped OnAmbientSoundStopped;

    UPROPERTY(BlueprintAssignable, Category = "SoundAtmosphere")
    FOnSoundLayerAdded OnSoundLayerAdded;

    UPROPERTY(BlueprintAssignable, Category = "SoundAtmosphere")
    FOnSoundLayerRemoved OnSoundLayerRemoved;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SoundAtmosphere")
    bool bIsPlaying = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SoundAtmosphere")
    FString CurrentSoundPath;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float MasterVolume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    FReverbSettings ReverbSettings;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "SoundAtmosphere")
    float OcclusionSettings = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SoundAtmosphere")
    TArray<FSoundLayer> SoundLayers;

private:
    void ApplyReverbSettings();
    void ApplyOcclusionSettings();
    int32 FindLayerIndex(const FString& LayerName) const;
};
