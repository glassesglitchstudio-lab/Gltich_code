#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UAtmosphereController.generated.h"

USTRUCT(BlueprintType)
struct FAtmospherePreset
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    FString PresetName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float FogDensity = 0.02f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    FLinearColor FogColor = FLinearColor(0.5f, 0.5f, 0.5f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float LightIntensity = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    FLinearColor LightColor = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float AmbientVolume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float MusicIntensity = 0.5f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAtmosphereChanged, const FString&, PresetName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnTransitionStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnTransitionCompleted);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAtmosphereController : public UActorComponent
{
    GENERATED_BODY()

public:
    UAtmosphereController();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetAtmosphere(const FString& PresetName);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetFogDensity(float NewDensity);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetFogColor(FLinearColor NewColor);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetLightIntensity(float NewIntensity);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetLightColor(FLinearColor NewColor);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetAmbientVolume(float NewVolume);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void SetMusicIntensity(float NewIntensity);

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void TransitionTo(const FString& PresetName, float Duration);

    UFUNCTION(BlueprintPure, Category = "Atmosphere")
    FString GetCurrentPreset() const { return CurrentPresetName; }

    UFUNCTION(BlueprintPure, Category = "Atmosphere")
    bool IsTransitioning() const { return bIsTransitioning; }

    UFUNCTION(BlueprintCallable, Category = "Atmosphere")
    void RegisterPreset(const FAtmospherePreset& Preset);

    UFUNCTION(BlueprintPure, Category = "Atmosphere")
    TArray<FString> GetAvailablePresets() const;

    UPROPERTY(BlueprintAssignable, Category = "Atmosphere")
    FOnAtmosphereChanged OnAtmosphereChanged;

    UPROPERTY(BlueprintAssignable, Category = "Atmosphere")
    FOnTransitionStarted OnTransitionStarted;

    UPROPERTY(BlueprintAssignable, Category = "Atmosphere")
    FOnTransitionCompleted OnTransitionCompleted;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    TMap<FString, FAtmospherePreset> Presets;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Atmosphere")
    FString CurrentPresetName;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Atmosphere")
    bool bIsTransitioning = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float CurrentFogDensity = 0.02f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    FLinearColor CurrentFogColor = FLinearColor(0.5f, 0.5f, 0.5f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float CurrentLightIntensity = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    FLinearColor CurrentLightColor = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float CurrentAmbientVolume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Atmosphere")
    float CurrentMusicIntensity = 0.5f;

    virtual void BeginPlay() override;

private:
    void InitializeDefaultPresets();
    void ApplyPreset(const FAtmospherePreset& Preset);
    void InterpolateAtmosphere(const FAtmospherePreset& From, const FAtmospherePreset& To, float Alpha);

    FAtmospherePreset TransitionStartPreset;
    FAtmospherePreset TransitionTargetPreset;
    float TransitionDuration = 0.0f;
    float TransitionElapsed = 0.0f;
};
