#include "UAtmosphereController.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"

UAtmosphereController::UAtmosphereController()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UAtmosphereController::BeginPlay()
{
    Super::BeginPlay();
    InitializeDefaultPresets();

    if (Presets.Num() > 0)
    {
        CurrentPresetName = Presets.begin()->Key;
        ApplyPreset(Presets.begin()->Value);
    }
}

void UAtmosphereController::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bIsTransitioning)
    {
        TransitionElapsed += DeltaTime;
        float Alpha = FMath::Clamp(TransitionElapsed / TransitionDuration, 0.0f, 1.0f);

        InterpolateAtmosphere(TransitionStartPreset, TransitionTargetPreset, Alpha);

        if (Alpha >= 1.0f)
        {
            bIsTransitioning = false;
            CurrentPresetName = TransitionTargetPreset.PresetName;
            OnTransitionCompleted.Broadcast();
            OnAtmosphereChanged.Broadcast(CurrentPresetName);
        }
    }
}

void UAtmosphereController::InitializeDefaultPresets()
{
    // Calm preset
    FAtmospherePreset Calm;
    Calm.PresetName = TEXT("Calm");
    Calm.FogDensity = 0.02f;
    Calm.FogColor = FLinearColor(0.5f, 0.5f, 0.5f, 1.0f);
    Calm.LightIntensity = 1.0f;
    Calm.LightColor = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f);
    Calm.AmbientVolume = 1.0f;
    Calm.MusicIntensity = 0.3f;
    Presets.Add(TEXT("Calm"), Calm);

    // Tense preset
    FAtmospherePreset Tense;
    Tense.PresetName = TEXT("Tense");
    Tense.FogDensity = 0.04f;
    Tense.FogColor = FLinearColor(0.3f, 0.3f, 0.35f, 1.0f);
    Tense.LightIntensity = 0.6f;
    Tense.LightColor = FLinearColor(0.8f, 0.8f, 1.0f, 1.0f);
    Tense.AmbientVolume = 0.7f;
    Tense.MusicIntensity = 0.6f;
    Presets.Add(TEXT("Tense"), Tense);

    // Horror preset
    FAtmospherePreset Horror;
    Horror.PresetName = TEXT("Horror");
    Horror.FogDensity = 0.08f;
    Horror.FogColor = FLinearColor(0.1f, 0.1f, 0.15f, 1.0f);
    Horror.LightIntensity = 0.2f;
    Horror.LightColor = FLinearColor(0.5f, 0.5f, 0.7f, 1.0f);
    Horror.AmbientVolume = 0.3f;
    Horror.MusicIntensity = 0.9f;
    Presets.Add(TEXT("Horror"), Horror);

    // Chase preset
    FAtmospherePreset Chase;
    Chase.PresetName = TEXT("Chase");
    Chase.FogDensity = 0.05f;
    Chase.FogColor = FLinearColor(0.4f, 0.2f, 0.2f, 1.0f);
    Chase.LightIntensity = 0.4f;
    Chase.LightColor = FLinearColor(1.0f, 0.6f, 0.6f, 1.0f);
    Chase.AmbientVolume = 0.8f;
    Chase.MusicIntensity = 1.0f;
    Presets.Add(TEXT("Chase"), Chase);

    // Safe preset
    FAtmospherePreset Safe;
    Safe.PresetName = TEXT("Safe");
    Safe.FogDensity = 0.01f;
    Safe.FogColor = FLinearColor(0.7f, 0.7f, 0.8f, 1.0f);
    Safe.LightIntensity = 1.2f;
    Safe.LightColor = FLinearColor(1.0f, 0.95f, 0.9f, 1.0f);
    Safe.AmbientVolume = 0.5f;
    Safe.MusicIntensity = 0.2f;
    Presets.Add(TEXT("Safe"), Safe);
}

void UAtmosphereController::SetAtmosphere(const FString& PresetName)
{
    if (!Presets.Contains(PresetName))
    {
        return;
    }

    const FAtmospherePreset& Preset = Presets[PresetName];
    ApplyPreset(Preset);
    CurrentPresetName = PresetName;

    OnAtmosphereChanged.Broadcast(CurrentPresetName);
}

void UAtmosphereController::SetFogDensity(float NewDensity)
{
    CurrentFogDensity = FMath::Max(0.0f, NewDensity);

    AExponentialHeightFog* Fog = Cast<AExponentialHeightFog>(
        UGameplayStatics::GetActorOfClass(GetWorld(), AExponentialHeightFog::StaticClass()));
    if (Fog && Fog->ExponentialHeightFogComponent)
    {
        Fog->ExponentialHeightFogComponent->SetFogDensity(CurrentFogDensity);
    }
}

void UAtmosphereController::SetFogColor(FLinearColor NewColor)
{
    CurrentFogColor = NewColor;

    AExponentialHeightFog* Fog = Cast<AExponentialHeightFog>(
        UGameplayStatics::GetActorOfClass(GetWorld(), AExponentialHeightFog::StaticClass()));
    if (Fog && Fog->ExponentialHeightFogComponent)
    {
        Fog->ExponentialHeightFogComponent->SetFogInscatteringColor(CurrentFogColor);
    }
}

void UAtmosphereController::SetLightIntensity(float NewIntensity)
{
    CurrentLightIntensity = FMath::Max(0.0f, NewIntensity);

    ADirectionalLight* Light = Cast<ADirectionalLight>(
        UGameplayStatics::GetActorOfClass(GetWorld(), ADirectionalLight::StaticClass()));
    if (Light && Light->GetLightComponent())
    {
        Light->GetLightComponent()->SetIntensity(CurrentLightIntensity);
    }
}

void UAtmosphereController::SetLightColor(FLinearColor NewColor)
{
    CurrentLightColor = NewColor;

    ADirectionalLight* Light = Cast<ADirectionalLight>(
        UGameplayStatics::GetActorOfClass(GetWorld(), ADirectionalLight::StaticClass()));
    if (Light && Light->GetLightComponent())
    {
        Light->GetLightComponent()->SetLightColor(CurrentLightColor);
    }
}

void UAtmosphereController::SetAmbientVolume(float NewVolume)
{
    CurrentAmbientVolume = FMath::Clamp(NewVolume, 0.0f, 1.0f);
}

void UAtmosphereController::SetMusicIntensity(float NewIntensity)
{
    CurrentMusicIntensity = FMath::Clamp(NewIntensity, 0.0f, 1.0f);
}

void UAtmosphereController::TransitionTo(const FString& PresetName, float Duration)
{
    if (!Presets.Contains(PresetName) || PresetName == CurrentPresetName)
    {
        return;
    }

    // Store current state as start
    TransitionStartPreset.PresetName = CurrentPresetName;
    TransitionStartPreset.FogDensity = CurrentFogDensity;
    TransitionStartPreset.FogColor = CurrentFogColor;
    TransitionStartPreset.LightIntensity = CurrentLightIntensity;
    TransitionStartPreset.LightColor = CurrentLightColor;
    TransitionStartPreset.AmbientVolume = CurrentAmbientVolume;
    TransitionStartPreset.MusicIntensity = CurrentMusicIntensity;

    TransitionTargetPreset = Presets[PresetName];
    TransitionDuration = FMath::Max(0.1f, Duration);
    TransitionElapsed = 0.0f;
    bIsTransitioning = true;

    OnTransitionStarted.Broadcast();
}

void UAtmosphereController::RegisterPreset(const FAtmospherePreset& Preset)
{
    Presets.Add(Preset.PresetName, Preset);
}

TArray<FString> UAtmosphereController::GetAvailablePresets() const
{
    TArray<FString> PresetNames;
    Presets.GetKeys(PresetNames);
    return PresetNames;
}

void UAtmosphereController::ApplyPreset(const FAtmospherePreset& Preset)
{
    SetFogDensity(Preset.FogDensity);
    SetFogColor(Preset.FogColor);
    SetLightIntensity(Preset.LightIntensity);
    SetLightColor(Preset.LightColor);
    SetAmbientVolume(Preset.AmbientVolume);
    SetMusicIntensity(Preset.MusicIntensity);
}

void UAtmosphereController::InterpolateAtmosphere(const FAtmospherePreset& From, const FAtmospherePreset& To, float Alpha)
{
    float EasedAlpha = FMath::InterpEaseInOut(0.0f, 1.0f, Alpha, 2.0f);

    SetFogDensity(FMath::Lerp(From.FogDensity, To.FogDensity, EasedAlpha));
    SetFogColor(FLinearColor::LerpUsingHSV(From.FogColor, To.FogColor, EasedAlpha));
    SetLightIntensity(FMath::Lerp(From.LightIntensity, To.LightIntensity, EasedAlpha));
    SetLightColor(FLinearColor::LerpUsingHSV(From.LightColor, To.LightColor, EasedAlpha));
    CurrentAmbientVolume = FMath::Lerp(From.AmbientVolume, To.AmbientVolume, EasedAlpha);
    CurrentMusicIntensity = FMath::Lerp(From.MusicIntensity, To.MusicIntensity, EasedAlpha);
}
