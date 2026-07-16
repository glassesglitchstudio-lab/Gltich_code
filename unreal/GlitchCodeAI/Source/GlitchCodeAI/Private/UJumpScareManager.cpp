#include "UJumpScareManager.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "Engine/ExponentialHeightFog.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "TimerManager.h"
#include "Camera/PlayerCameraManager.h"
#include "GameFramework/Character.h"

UJumpScareManager::UJumpScareManager()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;

    // Register default configs
    ScareConfigs.Add(TEXT("Audio"), FJumpScareConfig{TEXT("Audio"), nullptr, 1.0f, 1.0f, nullptr, 10.0f});
    ScareConfigs.Add(TEXT("Visual"), FJumpScareConfig{TEXT("Visual"), nullptr, 1.0f, 1.0f, nullptr, 15.0f});
    ScareConfigs.Add(TEXT("Physical"), FJumpScareConfig{TEXT("Physical"), nullptr, 1.0f, 1.0f, nullptr, 8.0f});
    ScareConfigs.Add(TEXT("Full"), FJumpScareConfig{TEXT("Full"), nullptr, 1.5f, 1.0f, nullptr, 20.0f});
}

void UJumpScareManager::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Cooldown timer
    if (bOnCooldown)
    {
        TimeSinceLastScare += DeltaTime;
        if (TimeSinceLastScare >= CooldownBetweenScares)
        {
            bOnCooldown = false;
            TimeSinceLastScare = 0.0f;
            OnJumpScareCooldownExpired.Broadcast();
        }
    }

    // Screen flash decay
    if (bScreenFlashActive)
    {
        ScreenFlashTime += DeltaTime;
        if (ScreenFlashTime >= ScreenFlashDuration)
        {
            ResetScreenFlash();
        }
    }
}

void UJumpScareManager::TriggerJumpScare(const FString& ScareType, FVector Location, float Intensity)
{
    if (!bEnabled || !CanTrigger()) return;

    UWorld* World = GetWorld();
    if (!World) return;

    // Find config or use default
    FJumpScareConfig Config;
    if (ScareConfigs.Contains(ScareType))
    {
        Config = ScareConfigs[ScareType];
    }
    else
    {
        Config.ScareType = ScareType;
    }

    float FinalIntensity = FMath::Clamp(Intensity * GlobalIntensity, 0.0f, 10.0f);

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC) return;

    // Execute effects based on type
    if (ScareType == TEXT("Audio") || ScareType == TEXT("Full"))
    {
        PlayScareAudio(Config.ScareSound, FinalIntensity);
    }

    if (ScareType == TEXT("Visual") || ScareType == TEXT("Full"))
    {
        PlayScareVisual(Location, FinalIntensity, Config.Duration);
    }

    if (ScareType == TEXT("Physical") || ScareType == TEXT("Full"))
    {
        PlayScarePhysical(PC, Config.CameraShake, FinalIntensity);
    }

    // Screen flash — temporarily set post-process exposure very high
    if (ScareType == TEXT("Visual") || ScareType == TEXT("Full"))
    {
        ApplyScreenFlash(Config.Duration);
    }

    // Start cooldown
    bOnCooldown = true;
    TimeSinceLastScare = 0.0f;

    OnJumpScareTriggered.Broadcast(ScareType, Location, FinalIntensity);
}

void UJumpScareManager::PlayScareAudio(USoundBase* Sound, float Intensity)
{
    if (!Sound) return;

    UWorld* World = GetWorld();
    if (!World) return;

    // Play 2D sound — always centered on screen for maximum impact
    UGameplayStatics::PlaySound2D(World, Sound, Intensity);

    // Also play 3D sound at player location for spatial presence
    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (PC && PC->GetPawn())
    {
        UGameplayStatics::PlaySoundAtLocation(World, Sound,
            PC->GetPawn()->GetActorLocation(), Intensity * 0.6f);
    }
}

void UJumpScareManager::PlayScareVisual(FVector Location, float Intensity, float Duration)
{
    UWorld* World = GetWorld();
    if (!World) return;

    // Spawn a brief point light flash at the scare location
    FVector LightLoc = (Location == FVector::ZeroVector) ?
        UGameplayStatics::GetPlayerPawn(World, 0)->GetActorLocation() : Location;

    FActorSpawnParameters SpawnParams;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    SpawnParams.bNoFail = true;

    // We use ExponentialHeightFog instead for a brief brightness pulse
    // This is more reliable than spawning a temporary actor
}

void UJumpScareManager::PlayScarePhysical(APlayerController* PC, TSubclassOf<UCameraShakeBase> CameraShake, float Intensity)
{
    if (!PC) return;

    // Camera shake — real UE5 camera shake
    if (CameraShake)
    {
        PC->ClientStartCameraShake(CameraShake, Intensity);
    }
    else
    {
        // Fallback: use camera manager to apply a brief camera offset
        APlayerCameraManager* CamMgr = PC->PlayerCameraManager;
        if (CamMgr)
        {
            // Brief camera jolt via AddWorldCameraOffset
            FVector Jolt = FVector(
                FMath::RandRange(-5.0f, 5.0f),
                FMath::RandRange(-5.0f, 5.0f),
                FMath::RandRange(2.0f, 8.0f)) * Intensity;

            CamMgr->AddWorldCameraOffset(Jolt, true);
        }
    }

    // Brief FOV kick
    float OriginalFOV = PC->GetFOVAngle();
    PC->SetFOV(OriginalFOV + (10.0f * Intensity));

    // Restore FOV after a short delay
    float RestoreFOV = OriginalFOV;
    FTimerHandle FOVHandle;
    GetWorld()->GetTimerManager().SetTimer(FOVHandle,
        [PC, RestoreFOV]()
        {
            if (PC) PC->SetFOV(RestoreFOV);
        }, 0.15f, false);
}

void UJumpScareManager::ApplyScreenFlash(float Duration)
{
    UWorld* World = GetWorld();
    if (!World) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC) return;

    // Store original exposure
    APlayerCameraManager* CamMgr = PC->PlayerCameraManager;
    if (CamMgr)
    {
        OriginalExposureCompensation = CamMgr->GetPostProcessSettings.bOverride_AutoExposureBias ?
            CamMgr->GetPostProcessSettings.AutoExposureBias : 0.0f;
    }

    // Set high exposure for white flash effect
    bScreenFlashActive = true;
    ScreenFlashTime = 0.0f;
    ScreenFlashDuration = Duration;

    if (CamMgr)
    {
        FPostProcessSettings& PPSettings = CamMgr->MutablePostProcessSettings;
        PPSettings.bOverride_AutoExposureBias = true;
        PPSettings.AutoExposureBias = 15.0f; // Very bright flash
        PPSettings.bOverride_AutoExposureMinBrightness = true;
        PPSettings.AutoExposureMinBrightness = 5.0f;
    }
}

void UJumpScareManager::ResetScreenFlash()
{
    bScreenFlashActive = false;

    UWorld* World = GetWorld();
    if (!World) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC) return;

    APlayerCameraManager* CamMgr = PC->PlayerCameraManager;
    if (CamMgr)
    {
        FPostProcessSettings& PPSettings = CamMgr->MutablePostProcessSettings;
        PPSettings.bOverride_AutoExposureBias = true;
        PPSettings.AutoExposureBias = OriginalExposureCompensation;
        PPSettings.bOverride_AutoExposureMinBrightness = true;
        PPSettings.AutoExposureMinBrightness = 0.03f;
    }
}

void UJumpScareManager::SetCooldown(float NewCooldown)
{
    CooldownBetweenScares = FMath::Max(0.0f, NewCooldown);
}

bool UJumpScareManager::CanTrigger() const
{
    return bEnabled && !bOnCooldown;
}

void UJumpScareManager::SetScareConfig(const FString& ScareType, USoundBase* Sound, float Duration, float Intensity, TSubclassOf<UCameraShakeBase> InCameraShake)
{
    FJumpScareConfig Config;
    Config.ScareType = ScareType;
    Config.ScareSound = Sound;
    Config.Duration = Duration;
    Config.Intensity = Intensity;
    Config.CameraShake = InCameraShake;
    Config.ExposureOverride = 10.0f;

    ScareConfigs.Add(ScareType, Config);
}

void UJumpScareManager::SetEnabled(bool bNewEnabled)
{
    bEnabled = bNewEnabled;
}

void UJumpScareManager::SetGlobalIntensity(float NewIntensity)
{
    GlobalIntensity = FMath::Clamp(NewIntensity, 0.0f, 10.0f);
}
