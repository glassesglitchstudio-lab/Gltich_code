#include "UFearCurveSystem.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Camera/CameraComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/World.h"
#include "Curves/CurveFloat.h"
#include "Components/AudioComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Components/PostProcessComponent.h"
#include "Sound/SoundCue.h"
#include "TimerManager.h"

UFearCurveSystem::UFearCurveSystem()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;

    // Register default modifiers
    FearModifiers.Add(FFearModifier{TEXT("Darkness"), 0.0f, false});
    FearModifiers.Add(FFearModifier{TEXT("Isolation"), 0.0f, false});
    FearModifiers.Add(FFearModifier{TEXT("Sound"), 0.0f, false});
    FearModifiers.Add(FFearModifier{TEXT("Light"), 0.0f, false});
    FearModifiers.Add(FFearModifier{TEXT("Safety"), 0.0f, false});
    FearModifiers.Add(FFearModifier{TEXT("Known"), 0.0f, false});
}

void UFearCurveSystem::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Apply fear decay after delay
    TimeSinceLastChange += DeltaTime;
    if (TimeSinceLastChange > FearDecayDelay && CurrentFearLevel > MinFearLevel)
    {
        float DecayAmount = FearDecayRate * DeltaTime;
        float NewLevel = FMath::Max(MinFearLevel, CurrentFearLevel - DecayAmount);

        if (!FMath::IsNearlyEqual(NewLevel, CurrentFearLevel))
        {
            CurrentFearLevel = NewLevel;
            OnFearLevelChanged.Broadcast(CurrentFearLevel);

            // Apply fear-based effects via curves
            float NormalizedFear = CurrentFearLevel / MaxFearLevel;
            float CurveValue = FearResponseCurve ? FearResponseCurve->GetFloatValue(NormalizedFear) : NormalizedFear;
            ApplyFearEffects(CurveValue);

            // Check for state change
            EFearState NewState = GetFearStateFromLevel(CurrentFearLevel);
            if (NewState != PreviousState)
            {
                PreviousState = NewState;
                OnFearStateChanged.Broadcast(FearStateToString(NewState));
            }
        }
    }
}

void UFearCurveSystem::SetFearLevel(float NewFearLevel)
{
    float ClampedLevel = FMath::Clamp(NewFearLevel, MinFearLevel, MaxFearLevel);

    if (!FMath::IsNearlyEqual(ClampedLevel, CurrentFearLevel))
    {
        CurrentFearLevel = ClampedLevel;
        TimeSinceLastChange = 0.0f;

        OnFearLevelChanged.Broadcast(CurrentFearLevel);

        // Apply fear effects via curve
        float NormalizedFear = CurrentFearLevel / MaxFearLevel;
        float CurveValue = FearResponseCurve ? FearResponseCurve->GetFloatValue(NormalizedFear) : NormalizedFear;
        ApplyFearEffects(CurveValue);

        // Check for state change
        EFearState NewState = GetFearStateFromLevel(CurrentFearLevel);
        if (NewState != PreviousState)
        {
            PreviousState = NewState;
            OnFearStateChanged.Broadcast(FearStateToString(NewState));
        }
    }
}

void UFearCurveSystem::ApplyFearEffects(float CurveValue)
{
    UWorld* World = GetWorld();
    if (!World) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC || !PC->GetPawn()) return;

    ACharacter* Character = Cast<ACharacter>(PC->GetPawn());
    if (!Character) return;

    // 1. Movement slowdown via curve
    if (MovementSpeedCurve && Character->GetCharacterMovement())
    {
        float SpeedMultiplier = MovementSpeedCurve->GetFloatValue(CurveValue);
        Character->GetCharacterMovement()->MaxWalkSpeed = 600.0f * SpeedMultiplier;
    }
    else
    {
        // Fallback: linear slowdown
        float SpeedMult = FMath::Lerp(1.0f, 0.3f, CurveValue);
        if (Character->GetCharacterMovement())
        {
            Character->GetCharacterMovement()->MaxWalkSpeed = 600.0f * SpeedMult;
        }
    }

    // 2. Camera distortion via post-process
    if (CameraDistortionCurve)
    {
        float DistortionAmount = CameraDistortionCurve->GetFloatValue(CurveValue);

        APlayerCameraManager* CamMgr = PC->PlayerCameraManager;
        if (CamMgr)
        {
            FPostProcessSettings& PP = CamMgr->MutablePostProcessSettings;

            // Chromatic aberration increases with fear
            PP.bOverride_SceneFringeIntensity = true;
            PP.SceneFringeIntensity = FMath::Lerp(0.0f, 30.0f, CurveValue);

            // Vignette darkens
            PP.bOverride_VignetteIntensity = true;
            PP.VignetteIntensity = FMath::Lerp(0.0f, 0.8f, CurveValue);

            // Slight desaturation
            PP.bOverride_ColorSaturation = true;
            float Saturation = FMath::Lerp(1.0f, 0.6f, CurveValue);
            PP.ColorSaturation = FVector4(Saturation, Saturation, Saturation, 1.0f);

            // Camera FOV shrinks with fear (tunnel vision)
            float FOV = FMath::Lerp(90.0f, 75.0f, CurveValue);
            PC->SetFOV(FOV);

            // Brief camera shake impulse when fear spikes
            if (CurveValue > 0.6f)
            {
                float ShakeScale = (CurveValue - 0.6f) * 5.0f; // 0-2 range
                FVector ShakeOffset = FVector(
                    FMath::Sin(World->GetTimeSeconds() * 7.0f) * ShakeScale,
                    FMath::Cos(World->GetTimeSeconds() * 5.0f) * ShakeScale,
                    0.0f);
                CamMgr->AddWorldCameraOffset(ShakeOffset, true);
            }
        }
    }

    // 3. Audio warp — adjust ambient audio pitch
    if (AudioWarpCurve)
    {
        float WarpAmount = AudioWarpCurve->GetFloatValue(CurveValue);

        // Find and adjust any attached audio components
        TArray<UAudioComponent*> AudioComps;
        Character->GetComponents<UAudioComponent>(AudioComps);
        for (UAudioComponent* AudioComp : AudioComps)
        {
            if (AudioComp && AudioComp->IsPlaying())
            {
                // Pitch drops and becomes wobbly with fear
                float PitchBase = FMath::Lerp(1.0f, 0.7f, CurveValue);
                float PitchWobble = FMath::Sin(World->GetTimeSeconds() * 3.0f) * WarpAmount * 0.2f;
                AudioComp->SetPitchMultiplier(PitchBase + PitchWobble);
            }
        }
    }
}

float UFearCurveSystem::EvaluateCurve() const
{
    float NormalizedFear = CurrentFearLevel / MaxFearLevel;
    return FearResponseCurve ? FearResponseCurve->GetFloatValue(NormalizedFear) : NormalizedFear;
}

void UFearCurveSystem::AddFearModifier(const FString& ModifierName, float Value)
{
    for (FFearModifier& Modifier : FearModifiers)
    {
        if (Modifier.Name == ModifierName)
        {
            Modifier.Value = Value;
            Modifier.bActive = true;
            SetFearLevel(CalculateFinalFearLevel());
            return;
        }
    }

    FearModifiers.Add(FFearModifier{ModifierName, Value, true});
    SetFearLevel(CalculateFinalFearLevel());
}

void UFearCurveSystem::RemoveFearModifier(const FString& ModifierName)
{
    for (FFearModifier& Modifier : FearModifiers)
    {
        if (Modifier.Name == ModifierName)
        {
            Modifier.bActive = false;
            Modifier.Value = 0.0f;
            SetFearLevel(CalculateFinalFearLevel());
            return;
        }
    }
}

FString UFearCurveSystem::GetFearState() const
{
    return FearStateToString(GetFearStateFromLevel(CurrentFearLevel));
}

float UFearCurveSystem::GetModifierValue(const FString& ModifierName) const
{
    for (const FFearModifier& Modifier : FearModifiers)
    {
        if (Modifier.Name == ModifierName && Modifier.bActive)
        {
            return Modifier.Value;
        }
    }
    return 0.0f;
}

void UFearCurveSystem::ResetFear()
{
    CurrentFearLevel = MinFearLevel;
    TimeSinceLastChange = 0.0f;
    PreviousState = EFearState::Calm;

    for (FFearModifier& Modifier : FearModifiers)
    {
        Modifier.Value = 0.0f;
        Modifier.bActive = false;
    }

    // Reset all applied effects
    ApplyFearEffects(0.0f);

    OnFearLevelChanged.Broadcast(CurrentFearLevel);
    OnFearStateChanged.Broadcast(FearStateToString(EFearState::Calm));
}

float UFearCurveSystem::CalculateFinalFearLevel() const
{
    float TotalModifier = 0.0f;
    for (const FFearModifier& Modifier : FearModifiers)
    {
        if (Modifier.bActive)
        {
            TotalModifier += Modifier.Value;
        }
    }

    return FMath::Clamp(CurrentFearLevel + TotalModifier, MinFearLevel, MaxFearLevel);
}

EFearState UFearCurveSystem::GetFearStateFromLevel(float Level) const
{
    if (Level < 20.0f)
        return EFearState::Calm;
    else if (Level < 40.0f)
        return EFearState::Uneasy;
    else if (Level < 60.0f)
        return EFearState::Nervous;
    else if (Level < 80.0f)
        return EFearState::Scared;
    else
        return EFearState::Terrified;
}

FString UFearCurveSystem::FearStateToString(EFearState State) const
{
    switch (State)
    {
    case EFearState::Calm:      return TEXT("Calm");
    case EFearState::Uneasy:    return TEXT("Uneasy");
    case EFearState::Nervous:   return TEXT("Nervous");
    case EFearState::Scared:    return TEXT("Scared");
    case EFearState::Terrified: return TEXT("Terrified");
    default:                    return TEXT("Calm");
    }
}
