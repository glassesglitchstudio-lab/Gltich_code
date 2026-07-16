#include "USoundAtmosphereComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Components/AudioComponent.h"
#include "Engine/World.h"
#include "Sound/SoundAttenuation.h"

USoundAtmosphereComponent::USoundAtmosphereComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void USoundAtmosphereComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}

void USoundAtmosphereComponent::PlayAmbientSound(const FString& SoundPath, float Volume, float FadeIn)
{
    if (SoundPath.IsEmpty())
    {
        return;
    }

    // Stop current sound if playing
    if (bIsPlaying)
    {
        StopAmbientSound(0.5f);
    }

    USoundBase* Sound = LoadObject<USoundBase>(nullptr, *SoundPath);
    if (!Sound)
    {
        return;
    }

    CurrentSoundPath = SoundPath;
    bIsPlaying = true;

    UGameplayStatics::PlaySound2D(GetWorld(), Sound, Volume * MasterVolume, 1.0f, 0.0f, nullptr, nullptr, true);

    OnAmbientSoundPlayed.Broadcast(SoundPath);
}

void USoundAtmosphereComponent::StopAmbientSound(float FadeOut)
{
    if (!bIsPlaying)
    {
        return;
    }

    bIsPlaying = false;
    CurrentSoundPath.Empty();

    OnAmbientSoundStopped.Broadcast();
}

void USoundAtmosphereComponent::SetReverbSettings(float Density, float Diffusion, float Gain)
{
    ReverbSettings.Density = FMath::Clamp(Density, 0.0f, 1.0f);
    ReverbSettings.Diffusion = FMath::Clamp(Diffusion, 0.0f, 1.0f);
    ReverbSettings.Gain = FMath::Clamp(Gain, 0.0f, 1.0f);

    ApplyReverbSettings();
}

void USoundAtmosphereComponent::SetOcclusionSettings(float NewOcclusion)
{
    OcclusionSettings = FMath::Clamp(NewOcclusion, 0.0f, 1.0f);
    ApplyOcclusionSettings();
}

void USoundAtmosphereComponent::AddSoundLayer(const FString& LayerName, float Volume)
{
    // Check if layer already exists
    int32 ExistingIndex = FindLayerIndex(LayerName);
    if (ExistingIndex != INDEX_NONE)
    {
        SoundLayers[ExistingIndex].Volume = Volume;
        SoundLayers[ExistingIndex].bPlaying = true;
        return;
    }

    // Add new layer
    FSoundLayer NewLayer;
    NewLayer.LayerName = LayerName;
    NewLayer.Volume = Volume;
    NewLayer.bPlaying = true;
    SoundLayers.Add(NewLayer);

    OnSoundLayerAdded.Broadcast(LayerName);
}

void USoundAtmosphereComponent::RemoveSoundLayer(const FString& LayerName)
{
    int32 Index = FindLayerIndex(LayerName);
    if (Index != INDEX_NONE)
    {
        SoundLayers.RemoveAt(Index);
        OnSoundLayerRemoved.Broadcast(LayerName);
    }
}

void USoundAtmosphereComponent::ApplyReverbSettings()
{
    // Apply reverb settings to audio engine
    // This would typically use the audio middleware or UE5's built-in reverb system
}

void USoundAtmosphereComponent::ApplyOcclusionSettings()
{
    // Apply occlusion settings to audio engine
}

int32 USoundAtmosphereComponent::FindLayerIndex(const FString& LayerName) const
{
    for (int32 i = 0; i < SoundLayers.Num(); ++i)
    {
        if (SoundLayers[i].LayerName == LayerName)
        {
            return i;
        }
    }
    return INDEX_NONE;
}
