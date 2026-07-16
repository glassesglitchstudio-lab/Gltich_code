#include "UHorrorAtmosphereComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/CameraComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "Components/PostProcessComponent.h"
#include "Components/AudioComponent.h"
#include "Engine/ExponentialHeightFog.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "TimerManager.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "Sound/SoundCue.h"

UHorrorAtmosphereComponent::UHorrorAtmosphereComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UHorrorAtmosphereComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Apply sanity-based visual effects continuously
    float SanityRatio = SanityLevel / MaxSanity;
    ApplySanityEffects(SanityRatio);

    // Clean up any hallucination actors that have been destroyed
    HallucinationActors.RemoveAll([](AActor* A) { return A == nullptr; });
}

void UHorrorAtmosphereComponent::SetAmbientFear(float Intensity)
{
    CurrentAmbientFear = FMath::Clamp(Intensity, 0.0f, 1.0f);

    // Start or stop ambient horror sound based on fear level
    UWorld* World = GetWorld();
    if (!World) return;

    if (CurrentAmbientFear > 0.1f && AmbientHorrorLoop)
    {
        if (!ActiveAmbientAudio)
        {
            APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
            if (PC && PC->GetPawn())
            {
                ActiveAmbientAudio = UGameplayStatics::SpawnSoundAttached(
                    AmbientHorrorLoop, PC->GetPawn()->GetRootComponent(),
                    NAME_None, FVector::ZeroVector, FRotator::ZeroRotator,
                    EAttachLocation::SnapToTarget, true);
            }
        }

        if (ActiveAmbientAudio)
        {
            ActiveAmbientAudio->SetVolumeMultiplier(CurrentAmbientFear);
            ActiveAmbientAudio->SetPitchMultiplier(FMath::Lerp(0.8f, 1.2f, CurrentAmbientFear));
        }
    }
    else if (ActiveAmbientAudio)
    {
        ActiveAmbientAudio->Stop();
        ActiveAmbientAudio->DestroyComponent();
        ActiveAmbientAudio = nullptr;
    }

    // Increase fog density with fear
    AExponentialHeightFog* FogActor = Cast<AExponentialHeightFog>(
        UGameplayStatics::GetActorOfClass(World, AExponentialHeightFog::StaticClass()));
    if (FogActor)
    {
        UExponentialHeightFogComponent* FogComp = FogActor->GetComponent();
        if (FogComp)
        {
            float BaseFogDensity = FMath::Lerp(0.0f, 0.4f, CurrentAmbientFear);
            FogComp->SetFogDensity(BaseFogDensity);
            FogComp->SetFogInscatteringColor(
                FLinearColor::LerpUsingHSV(FLinearColor(0.5f, 0.5f, 0.5f),
                                            FLinearColor(0.1f, 0.05f, 0.1f), CurrentAmbientFear));
        }
    }
}

void UHorrorAtmosphereComponent::TriggerHorrorEvent()
{
    UWorld* World = GetWorld();
    if (!World) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC) return;

    // Pick a random horror event type
    int32 EventType = FMath::RandRange(0, 3);

    switch (EventType)
    {
    case 0: // Flicker nearby lights
    {
        TArray<AActor*> Lights;
        UGameplayStatics::GetAllActorsOfClass(World, APointLight::StaticClass(), Lights);
        for (AActor* Light : Lights)
        {
            float Dist = FVector::Distance(Light->GetActorLocation(), PC->GetPawn()->GetActorLocation());
            if (Dist < 2000.0f)
            {
                APointLight* PL = Cast<APointLight>(Light);
                if (PL && PL->GetLightComponent())
                {
                    PL->GetLightComponent()->SetIntensity(0.0f);
                    float RestoreDelay = FMath::RandRange(0.2f, 2.0f);
                    float OrigIntensity = PL->GetLightComponent()->Intensity > 0.0f ?
                        PL->GetLightComponent()->Intensity : 1.0f;
                    FTimerHandle RestoreHandle;
                    World->GetTimerManager().SetTimer(RestoreHandle,
                        [PL, OrigIntensity]() {
                            if (PL && PL->GetLightComponent())
                            {
                                PL->GetLightComponent()->SetIntensity(OrigIntensity);
                            }
                        }, RestoreDelay, false);
                }
            }
        }
        break;
    }
    case 1: // Play distant scream
    {
        if (DistantScreamSound)
        {
            FVector Offset = PC->GetPawn()->GetActorForwardVector() * -3000.0f;
            Offset += FVector(FMath::RandRange(-1000.0f, 1000.0f),
                              FMath::RandRange(-1000.0f, 1000.0f), 0.0f);
            UGameplayStatics::PlaySoundAtLocation(World, DistantScreamSound,
                PC->GetPawn()->GetActorLocation() + Offset, 0.8f);
        }
        break;
    }
    case 2: // Spawn enemy behind player
    {
        if (HallucinationEnemyClass)
        {
            FVector BehindLoc = PC->GetPawn()->GetActorLocation() -
                PC->GetPawn()->GetActorForwardVector() * 500.0f;
            BehindLoc.Z = PC->GetPawn()->GetActorLocation().Z;

            FActorSpawnParameters SpawnParams;
            SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

            ACharacter* Enemy = World->SpawnActor<ACharacter>(
                HallucinationEnemyClass, BehindLoc,
                (-PC->GetPawn()->GetActorForwardVector()).Rotation(), SpawnParams);

            if (Enemy)
            {
                // Make enemy face player
                FVector ToPlayer = (PC->GetPawn()->GetActorLocation() - Enemy->GetActorLocation()).GetSafeNormal2D();
                Enemy->SetActorRotation(ToPlayer.Rotation());
            }
        }
        break;
    }
    case 3: // Play jump scare sound + camera shake
    {
        if (JumpScareSound)
        {
            UGameplayStatics::PlaySound2D(World, JumpScareSound, 1.0f);
        }
        PC->ClientStartCameraShake(nullptr, 2.0f); // Generic camera shake
        break;
    }
    }

    // Drain sanity on horror event
    SanityLevel = FMath::Max(0.0f, SanityLevel - 15.0f);
    OnSanityChanged.Broadcast(SanityLevel);
    OnHorrorEventTriggered.Broadcast();
}

void UHorrorAtmosphereComponent::SetSanity(float Value)
{
    SanityLevel = FMath::Clamp(Value, 0.0f, MaxSanity);
    OnSanityChanged.Broadcast(SanityLevel);

    // Apply sanity effects immediately
    float SanityRatio = SanityLevel / MaxSanity;
    ApplySanityEffects(SanityRatio);

    // Play horror idle montage when sanity is low
    if (SanityLevel < 30.0f)
    {
        APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
        if (PC && PC->GetPawn())
        {
            ACharacter* Character = Cast<ACharacter>(PC->GetPawn());
            if (Character && Character->GetMesh() && Character->GetMesh()->GetAnimInstance()
                && HorrorIdleMontage)
            {
                Character->GetMesh()->GetAnimInstance()->Montage_Play(HorrorIdleMontage, 0.8f);
            }
        }
    }

    // Trigger hallucination at critical sanity
    if (SanityLevel <= 10.0f && HallucinationActors.Num() == 0)
    {
        TriggerHallucination();
    }
}

void UHorrorAtmosphereComponent::ApplySanityEffects(float SanityRatio)
{
    UWorld* World = GetWorld();
    if (!World) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC || !PC->GetPawn()) return;

    ACharacter* Character = Cast<ACharacter>(PC->GetPawn());
    if (!Character) return;

    // Create dynamic material for post-process if we don't have one yet
    if (!ActiveSanityMaterial && SanityPostProcessMaterial)
    {
        ActiveSanityMaterial = UMaterialInstanceDynamic::Create(SanityPostProcessMaterial, this);
    }

    if (ActiveSanityMaterial)
    {
        // Lower sanity = more vignette, more desaturation, more distortion
        float VignetteIntensity = FMath::Lerp(0.0f, 0.8f, 1.0f - SanityRatio);
        float Desaturation = FMath::Lerp(0.0f, 0.6f, 1.0f - SanityRatio);
        float DistortionStrength = FMath::Lerp(0.0f, 1.0f, 1.0f - SanityRatio);

        ActiveSanityMaterial->SetScalarParameterValue(FName("VignetteIntensity"), VignetteIntensity);
        ActiveSanityMaterial->SetScalarParameterValue(FName("Desaturation"), Desaturation);
        ActiveSanityMaterial->SetScalarParameterValue(FName("DistortionStrength"), DistortionStrength);

        // Camera FOV wobble when sanity is low
        if (SanityRatio < 0.3f)
        {
            float FOVWobble = FMath::Sin(World->GetTimeSeconds() * 3.0f) * 5.0f * (1.0f - SanityRatio);
            PC->SetFOV(90.0f + FOVWobble);
        }
        else
        {
            PC->SetFOV(90.0f);
        }

        // Movement slowdown at low sanity
        if (Character->GetCharacterMovement())
        {
            float SpeedMult = FMath::Lerp(0.4f, 1.0f, SanityRatio);
            Character->GetCharacterMovement()->MaxWalkSpeed = 600.0f * SpeedMult;
        }
    }
}

void UHorrorAtmosphereComponent::DrainSanity(float Rate)
{
    SanityDrainRate = FMath::Max(0.0f, Rate);

    UWorld* World = GetWorld();
    if (!World) return;

    if (SanityDrainRate > 0.0f)
    {
        World->GetTimerManager().SetTimer(SanityDrainTimer, this,
            &UHorrorAtmosphereComponent::OnSanityDrainTick, 0.1f, true);
    }
    else
    {
        World->GetTimerManager().ClearTimer(SanityDrainTimer);
    }
}

void UHorrorAtmosphereComponent::StopDrainSanity()
{
    SanityDrainRate = 0.0f;
    UWorld* World = GetWorld();
    if (World)
    {
        World->GetTimerManager().ClearTimer(SanityDrainTimer);
    }
}

void UHorrorAtmosphereComponent::OnSanityDrainTick()
{
    SanityLevel = FMath::Max(0.0f, SanityLevel - SanityDrainRate * 0.1f);
    OnSanityChanged.Broadcast(SanityLevel);

    // Check for hallucination threshold
    if (SanityLevel <= 10.0f && HallucinationActors.Num() == 0)
    {
        TriggerHallucination();
    }
}

void UHorrorAtmosphereComponent::TriggerHallucination()
{
    SpawnHallucinationEnemy();

    // Schedule hallucination actor disappearance
    UWorld* World = GetWorld();
    if (World)
    {
        World->GetTimerManager().SetTimer(HallucinationTimer, this,
            &UHorrorAtmosphereComponent::ClearHallucinations,
            FMath::RandRange(3.0f, 8.0f), false);
    }
}

void UHorrorAtmosphereComponent::SpawnHallucinationEnemy()
{
    UWorld* World = GetWorld();
    if (!World) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC || !PC->GetPawn()) return;

    FVector PlayerLoc = PC->GetPawn()->GetActorLocation();
    FVector Forward = PC->GetPawn()->GetActorForwardVector();

    // Spawn at random position around the player
    float Angle = FMath::RandRange(0.0f, 360.0f);
    float Distance = FMath::RandRange(800.0f, 2000.0f);
    FVector SpawnOffset = FRotator(0.0f, Angle, 0.0f).RotateVector(Forward * Distance);
    FVector SpawnLoc = PlayerLoc + SpawnOffset;
    SpawnLoc.Z = PlayerLoc.Z; // Keep at same height

    // Trace down to find ground
    FHitResult Hit;
    FVector TraceStart = SpawnLoc + FVector(0, 0, 500.0f);
    FVector TraceEnd = SpawnLoc - FVector(0, 0, 1000.0f);
    if (World->LineTraceSingleByChannel(Hit, TraceStart, TraceEnd, ECC_Visibility))
    {
        SpawnLoc = Hit.ImpactPoint;
    }

    if (HallucinationEnemyClass)
    {
        FActorSpawnParameters SpawnParams;
        SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

        ACharacter* Hallucination = World->SpawnActor<ACharacter>(
            HallucinationEnemyClass, SpawnLoc,
            (-Forward).Rotation(), SpawnParams);

        if (Hallucination)
        {
            HallucinationActors.Add(Hallucination);
            OnHallucinationStarted.Broadcast(Hallucination);

            // Apply a ghost-like translucent material
            if (Hallucination->GetMesh())
            {
                UMaterialInstanceDynamic* GhostMat = UMaterialInstanceDynamic::Create(
                    Hallucination->GetMesh()->GetMaterial(0), this);
                if (GhostMat)
                {
                    GhostMat->SetScalarParameterValue(FName("Opacity"), 0.4f);
                    Hallucination->GetMesh()->SetMaterial(0, GhostMat);
                }
            }
        }
    }
}

void UHorrorAtmosphereComponent::ClearHallucinations()
{
    for (AActor* FakeActor : HallucinationActors)
    {
        if (FakeActor)
        {
            // Fade out before destroying
            ACharacter* FakeChar = Cast<ACharacter>(FakeActor);
            if (FakeChar && FakeChar->GetMesh())
            {
                FakeChar->GetMesh()->SetVisibility(false, true);
            }
            FakeActor->Destroy();
        }
    }
    HallucinationActors.Empty();
}
