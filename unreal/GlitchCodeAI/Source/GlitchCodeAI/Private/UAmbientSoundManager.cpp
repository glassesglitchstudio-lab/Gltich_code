#include "UAmbientSoundManager.h"
#include "Kismet/GameplayStatics.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundWave.h"

void UAmbientSoundManager::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    UE_LOG(LogTemp, Log, TEXT("AmbientSoundManager: Initialized"));
}

void UAmbientSoundManager::Deinitialize()
{
    StopAllAmbientSounds(0.0f);
    Super::Deinitialize();
}

int32 UAmbientSoundManager::PlayAmbientSound(const FString& SoundPath, FVector Location, float Volume, float FadeInDuration)
{
    if (SoundPath.IsEmpty())
    {
        return -1;
    }

    USoundBase* Sound = LoadObject<USoundBase>(nullptr, *SoundPath);
    if (!Sound)
    {
        UE_LOG(LogTemp, Warning, TEXT("AmbientSoundManager: Failed to load sound '%s'"), *SoundPath);
        return -1;
    }

    UWorld* World = GetWorld();
    if (!World)
    {
        return -1;
    }

    FAmbientSoundEntry Entry;
    Entry.SoundID = NextSoundID++;
    Entry.SoundPath = SoundPath;
    Entry.Location = Location;
    Entry.Volume = Volume * GlobalVolume;
    Entry.bIsPlaying = true;

    // Create audio component at location
    UAudioComponent* AudioComp = UGameplayStatics::SpawnSoundAtLocation(
        World,
        Sound,
        Location,
        FRotator::ZeroRotator,
        Volume * GlobalVolume,
        1.0f,
        0.0f,
        nullptr,
        nullptr,
        true
    );

    Entry.AudioComponent = AudioComp;

    ActiveSounds.Add(Entry);

    UE_LOG(LogTemp, Log, TEXT("AmbientSoundManager: Playing '%s' at %s (ID: %d)"),
        *SoundPath, *Location.ToString(), Entry.SoundID);

    return Entry.SoundID;
}

bool UAmbientSoundManager::StopAmbientSound(int32 SoundID, float FadeOutDuration)
{
    for (int32 i = 0; i < ActiveSounds.Num(); ++i)
    {
        if (ActiveSounds[i].SoundID == SoundID)
        {
            FAmbientSoundEntry& Entry = ActiveSounds[i];

            if (Entry.AudioComponent && Entry.AudioComponent->IsPlaying())
            {
                if (FadeOutDuration > 0.0f)
                {
                    Entry.AudioComponent->FadeOut(FadeOutDuration, 0.0f);
                }
                else
                {
                    Entry.AudioComponent->Stop();
                }
            }

            Entry.bIsPlaying = false;
            ActiveSounds.RemoveAt(i);
            return true;
        }
    }
    return false;
}

void UAmbientSoundManager::StopAllAmbientSounds(float FadeOutDuration)
{
    for (FAmbientSoundEntry& Entry : ActiveSounds)
    {
        if (Entry.AudioComponent && Entry.AudioComponent->IsPlaying())
        {
            if (FadeOutDuration > 0.0f)
            {
                Entry.AudioComponent->FadeOut(FadeOutDuration, 0.0f);
            }
            else
            {
                Entry.AudioComponent->Stop();
            }
        }
        Entry.bIsPlaying = false;
    }
    ActiveSounds.Empty();
}

void UAmbientSoundManager::SetGlobalVolume(float Volume)
{
    GlobalVolume = FMath::Clamp(Volume, 0.0f, 1.0f);

    for (FAmbientSoundEntry& Entry : ActiveSounds)
    {
        if (Entry.AudioComponent)
        {
            Entry.AudioComponent->SetVolumeMultiplier(Entry.Volume * GlobalVolume);
        }
    }
}

float UAmbientSoundManager::GetGlobalVolume() const
{
    return GlobalVolume;
}

void UAmbientSoundManager::SetReverbSettings(float Density, float Diffusion, float Gain)
{
    CurrentReverb.Density = FMath::Clamp(Density, 0.0f, 1.0f);
    CurrentReverb.Diffusion = FMath::Clamp(Diffusion, 0.0f, 1.0f);
    CurrentReverb.Gain = FMath::Clamp(Gain, 0.0f, 1.0f);

    UE_LOG(LogTemp, Log, TEXT("AmbientSoundManager: Reverb updated (Density: %.2f, Diffusion: %.2f, Gain: %.2f)"),
        CurrentReverb.Density, CurrentReverb.Diffusion, CurrentReverb.Gain);
}

FReverbSettings UAmbientSoundManager::GetReverbSettings() const
{
    return CurrentReverb;
}

int32 UAmbientSoundManager::AddSoundZone(FVector Center, float Radius, const FString& AmbientSound)
{
    FSoundZone Zone;
    Zone.ZoneID = NextZoneID++;
    Zone.Center = Center;
    Zone.Radius = Radius;
    Zone.AmbientSound = AmbientSound;

    SoundZones.Add(Zone);

    UE_LOG(LogTemp, Log, TEXT("AmbientSoundManager: Added sound zone %d at %s (Radius: %.0f)"),
        Zone.ZoneID, *Center.ToString(), Radius);

    return Zone.ZoneID;
}

bool UAmbientSoundManager::RemoveSoundZone(int32 ZoneID)
{
    for (int32 i = 0; i < SoundZones.Num(); ++i)
    {
        if (SoundZones[i].ZoneID == ZoneID)
        {
            SoundZones.RemoveAt(i);
            return true;
        }
    }
    return false;
}

void UAmbientSoundManager::ClearSoundZones()
{
    SoundZones.Empty();
}

TArray<FSoundZone> UAmbientSoundManager::GetSoundZones() const
{
    return SoundZones;
}

void UAmbientSoundManager::TransitionAmbient(const FString& FromPreset, const FString& ToPreset, float Duration)
{
    UE_LOG(LogTemp, Log, TEXT("AmbientSoundManager: Transitioning '%s' → '%s' (%.1fs)"),
        *FromPreset, *ToPreset, Duration);

    StopAllAmbientSounds(Duration);
    CurrentPreset = ToPreset;
    ApplyPresetSounds(ToPreset);
}

void UAmbientSoundManager::ApplyPreset(const FString& PresetName)
{
    StopAllAmbientSounds(1.0f);
    CurrentPreset = PresetName;
    ApplyPresetSounds(PresetName);
}

void UAmbientSoundManager::ApplyPresetSounds(const FString& PresetName)
{
    FString Lower = PresetName.ToLower();

    if (Lower.Contains(TEXT("forest")))
    {
        PlayAmbientSound(TEXT("/Game/Ambient/Forest/Birds"), FVector(0, 0, 0), 0.4f, 2.0f);
        PlayAmbientSound(TEXT("/Game/Ambient/Forest/Wind"), FVector(0, 0, 0), 0.3f, 3.0f);
    }
    else if (Lower.Contains(TEXT("indoor")))
    {
        PlayAmbientSound(TEXT("/Game/Ambient/Indoor/RoomTone"), FVector(0, 0, 0), 0.3f, 1.5f);
        SetReverbSettings(0.8f, 0.6f, 0.4f);
    }
    else if (Lower.Contains(TEXT("horror")))
    {
        PlayAmbientSound(TEXT("/Game/Ambient/Horror/Drone"), FVector(0, 0, 0), 0.5f, 3.0f);
        PlayAmbientSound(TEXT("/Game/Ambient/Horror/Creaks"), FVector(100, 0, 0), 0.3f, 4.0f);
    }
    else if (Lower.Contains(TEXT("industrial")))
    {
        PlayAmbientSound(TEXT("/Game/Ambient/Industrial/Machines"), FVector(0, 0, 0), 0.6f, 1.0f);
        PlayAmbientSound(TEXT("/Game/Ambient/Industrial/Pipes"), FVector(200, 0, 0), 0.3f, 1.5f);
    }
    else if (Lower.Contains(TEXT("underwater")))
    {
        PlayAmbientSound(TEXT("/Game/Ambient/Underwater/Bubbles"), FVector(0, 0, 0), 0.5f, 2.0f);
        PlayAmbientSound(TEXT("/Game/Ambient/Underwater/Current"), FVector(0, 0, 0), 0.4f, 3.0f);
        SetReverbSettings(1.0f, 1.0f, 0.3f);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("AmbientSoundManager: Unknown preset '%s'"), *PresetName);
    }
}

FString UAmbientSoundManager::GetSoundPathForPreset(const FString& PresetName, int32 Index) const
{
    return TEXT("/Game/Ambient/") + PresetName + FString::Printf(TEXT("/Sound_%d"), Index);
}

FString UAmbientSoundManager::GetCurrentPreset() const
{
    return CurrentPreset;
}

bool UAmbientSoundManager::IsPlaying(int32 SoundID) const
{
    for (const FAmbientSoundEntry& Entry : ActiveSounds)
    {
        if (Entry.SoundID == SoundID)
        {
            return Entry.bIsPlaying && Entry.AudioComponent && Entry.AudioComponent->IsPlaying();
        }
    }
    return false;
}

TArray<FAmbientSoundEntry> UAmbientSoundManager::GetAllSounds() const
{
    return ActiveSounds;
}

int32 UAmbientSoundManager::GetActiveSoundCount() const
{
    int32 Count = 0;
    for (const FAmbientSoundEntry& Entry : ActiveSounds)
    {
        if (Entry.bIsPlaying)
        {
            Count++;
        }
    }
    return Count;
}
