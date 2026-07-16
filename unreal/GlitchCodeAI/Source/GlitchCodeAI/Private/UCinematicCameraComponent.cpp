#include "UCinematicCameraComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

UCinematicCameraComponent::UCinematicCameraComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

int32 UCinematicCameraComponent::FindKeyframeIndex(const FString& Name) const
{
    for (int32 i = 0; i < Keyframes.Num(); ++i)
    {
        if (Keyframes[i].KeyframeName == Name)
        {
            return i;
        }
    }
    return INDEX_NONE;
}

void UCinematicCameraComponent::StartSequence()
{
    CurrentKeyframeIndex = 0;
    KeyframeElapsedTime = 0.0f;
    bIsPlaying = false;
    bIsPaused = false;

    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Sequence started (%d keyframes)"), Keyframes.Num());
}

void UCinematicCameraComponent::StopSequence()
{
    bIsPlaying = false;
    bIsPaused = false;
    CurrentKeyframeIndex = 0;
    KeyframeElapsedTime = 0.0f;

    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Sequence stopped"));
}

void UCinematicCameraComponent::AddKeyframe(const FString& Name, const FVector& Pos, const FRotator& Rot, float Duration, bool bLookAt, const FVector& LookAtTarget)
{
    FCinematicKeyframe NewKF;
    NewKF.KeyframeName = Name;
    NewKF.Position = Pos;
    NewKF.Rotation = Rot;
    NewKF.Duration = FMath::Max(Duration, 0.1f);
    NewKF.bUseLookAt = bLookAt;
    NewKF.LookAt = LookAtTarget;
    Keyframes.Add(NewKF);

    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Keyframe '%s' added at %s (%.1fs)"),
        *Name, *Pos.ToString(), Duration);
}

bool UCinematicCameraComponent::RemoveKeyframe(const FString& Name)
{
    int32 Index = FindKeyframeIndex(Name);
    if (Index == INDEX_NONE) return false;
    Keyframes.RemoveAt(Index);
    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Keyframe '%s' removed"), *Name);
    return true;
}

void UCinematicCameraComponent::PlaySequence()
{
    if (Keyframes.Num() < 2)
    {
        UE_LOG(LogTemp, Warning, TEXT("CinematicCam: Need at least 2 keyframes to play"));
        return;
    }

    bIsPlaying = true;
    bIsPaused = false;
    CurrentKeyframeIndex = 0;
    KeyframeElapsedTime = 0.0f;

    // Store initial position from first keyframe
    PreviousPosition = Keyframes[0].Position;
    PreviousRotation = Keyframes[0].Rotation;

    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Playing sequence (%d keyframes)"), Keyframes.Num());
}

void UCinematicCameraComponent::PauseSequence()
{
    if (!bIsPlaying) return;
    bIsPaused = true;
    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Paused at keyframe %d"), CurrentKeyframeIndex);
}

void UCinematicCameraComponent::ResumeSequence()
{
    if (!bIsPlaying || !bIsPaused) return;
    bIsPaused = false;
    UE_LOG(LogTemp, Log, TEXT("CinematicCam: Resumed from keyframe %d"), CurrentKeyframeIndex);
}

void UCinematicCameraComponent::ClearKeyframes()
{
    Keyframes.Empty();
    CurrentKeyframeIndex = 0;
    KeyframeElapsedTime = 0.0f;
}

void UCinematicCameraComponent::SetPlaybackSpeed(float Speed)
{
    PlaybackSpeed = FMath::Max(Speed, 0.0f);
}

float UCinematicCameraComponent::GetPlaybackProgress() const
{
    if (Keyframes.Num() < 2) return 0.0f;

    float TotalDuration = 0.0f;
    for (const FCinematicKeyframe& KF : Keyframes)
    {
        TotalDuration += KF.Duration;
    }

    if (TotalDuration <= 0.0f) return 0.0f;

    float Elapsed = KeyframeElapsedTime;
    for (int32 i = 0; i < CurrentKeyframeIndex && i < Keyframes.Num(); ++i)
    {
        Elapsed += Keyframes[i].Duration;
    }

    return FMath::Clamp(Elapsed / TotalDuration, 0.0f, 1.0f);
}

void UCinematicCameraComponent::UpdateCinematicCamera(float DeltaTime)
{
    if (!bIsPlaying || bIsPaused || Keyframes.Num() < 2) return;
    if (CurrentKeyframeIndex >= Keyframes.Num() - 1)
    {
        // Sequence finished
        bIsPlaying = false;
        OnSequenceFinished.Broadcast();

        if (bLoopSequence)
        {
            PlaySequence();
        }
        return;
    }

    const FCinematicKeyframe& CurrentKF = Keyframes[CurrentKeyframeIndex];
    const FCinematicKeyframe& NextKF = Keyframes[CurrentKeyframeIndex + 1];

    KeyframeElapsedTime += DeltaTime * PlaybackSpeed;

    float Alpha = FMath::Clamp(KeyframeElapsedTime / CurrentKF.Duration, 0.0f, 1.0f);

    // Get owning player controller for view target
    APlayerController* PC = nullptr;
    AActor* Owner = GetOwner();
    if (Owner)
    {
        APawn* Pawn = Cast<APawn>(Owner);
        if (Pawn)
        {
            PC = Cast<APlayerController>(Pawn->GetController());
        }
        if (!PC)
        {
            // Try to get player 0 controller
            PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
        }
    }

    if (PC)
    {
        // Calculate interpolated position
        FVector TargetPosition;
        FRotator TargetRotation;

        if (NextKF.bUseLookAt)
        {
            // Look at target position
            TargetPosition = FMath::VInterpTo(PreviousPosition, NextKF.Position, DeltaTime * InterpolationSpeed, 1.0f);
            FVector LookDir = (NextKF.LookAt - TargetPosition).GetSafeNormal();
            TargetRotation = LookDir.Rotation();
        }
        else
        {
            TargetPosition = FMath::VInterpTo(PreviousPosition, NextKF.Position, DeltaTime * InterpolationSpeed, 1.0f);
            TargetRotation = FMath::RInterpTo(PreviousRotation, NextKF.Rotation, DeltaTime * InterpolationSpeed, 1.0f);
        }

        // Set camera via player controller
        FTransform CameraTransform(TargetRotation, TargetPosition);
        PC->SetControlRotation(TargetRotation);

        // Store for next frame
        PreviousPosition = TargetPosition;
        PreviousRotation = TargetRotation;
    }

    // Check if keyframe is complete
    if (KeyframeElapsedTime >= CurrentKF.Duration)
    {
        KeyframeElapsedTime -= CurrentKF.Duration;
        CurrentKeyframeIndex++;
        OnKeyframeReached.Broadcast(CurrentKeyframeIndex);

        UE_LOG(LogTemp, Log, TEXT("CinematicCam: Reached keyframe %d"), CurrentKeyframeIndex);
    }
}

void UCinematicCameraComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    UpdateCinematicCamera(DeltaTime);
}
