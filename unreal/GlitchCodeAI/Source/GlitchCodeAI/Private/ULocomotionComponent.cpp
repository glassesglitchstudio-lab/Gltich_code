#include "ULocomotionComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"

ULocomotionComponent::ULocomotionComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

ACharacter* ULocomotionComponent::GetOwnerCharacter() const
{
    return Cast<ACharacter>(GetOwner());
}

UCharacterMovementComponent* ULocomotionComponent::GetMovementComponent() const
{
    ACharacter* Character = GetOwnerCharacter();
    return Character ? Character->GetCharacterMovement() : nullptr;
}

float ULocomotionComponent::GetCurrentSpeed() const
{
    UCharacterMovementComponent* Movement = GetMovementComponent();
    return Movement ? Movement->MaxWalkSpeed : 0.0f;
}

bool ULocomotionComponent::IsCrouching() const
{
    UCharacterMovementComponent* Movement = GetMovementComponent();
    return Movement ? Movement->IsCrouching() : false;
}

bool ULocomotionComponent::IsProne() const
{
    return bIsProne;
}

FVector ULocomotionComponent::GetVelocity() const
{
    UCharacterMovementComponent* Movement = GetMovementComponent();
    return Movement ? Movement->Velocity : FVector::ZeroVector;
}

void ULocomotionComponent::SetSpeed(float Speed)
{
    UCharacterMovementComponent* Movement = GetMovementComponent();
    if (!Movement)
    {
        UE_LOG(LogTemp, Warning, TEXT("Locomotion: No CharacterMovementComponent found"));
        return;
    }

    Speed = FMath::Clamp(Speed, 0.0f, MaxWalkSpeed);
    Movement->MaxWalkSpeed = Speed;
}

void ULocomotionComponent::SetMaxWalkSpeed(float Speed)
{
    UCharacterMovementComponent* Movement = GetMovementComponent();
    if (Movement)
    {
        MaxWalkSpeed = FMath::Max(Speed, 0.0f);
        Movement->MaxWalkSpeed = MaxWalkSpeed;
    }
}

void ULocomotionComponent::SetDirection(float Angle)
{
    CurrentDirection = FMath::Fmod(Angle, 360.0f);
    if (CurrentDirection < 0.0f) CurrentDirection += 360.0f;
}

void ULocomotionComponent::SetStrafe(bool bEnabled)
{
    bIsStrafing = bEnabled;
}

void ULocomotionComponent::SetCrouchState(bool bEnabled)
{
    ACharacter* Character = GetOwnerCharacter();
    UCharacterMovementComponent* Movement = GetMovementComponent();
    if (!Character || !Movement) return;

    if (bEnabled)
    {
        // Exit prone first if active
        if (bIsProne)
        {
            SetProneState(false);
        }

        // Enable crouch capability
        Movement->NavAgentProps.bCanCrouch = true;
        Movement->CrouchedHalfHeight = 42.0f;
        Character->Crouch();

        bIsCrouching = true;
        UE_LOG(LogTemp, Log, TEXT("Locomotion: Crouch ON"));
    }
    else
    {
        Character->UnCrouch();
        bIsCrouching = false;
        UE_LOG(LogTemp, Log, TEXT("Locomotion: Crouch OFF"));
    }
}

void ULocomotionComponent::SetProneState(bool bEnabled)
{
    ACharacter* Character = GetOwnerCharacter();
    UCharacterMovementComponent* Movement = GetMovementComponent();
    UCapsuleComponent* Capsule = Character ? Character->GetCapsuleComponent() : nullptr;
    USkeletalMeshComponent* Mesh = Character ? Character->GetMesh() : nullptr;
    if (!Character || !Movement || !Capsule || !Mesh) return;

    if (bEnabled)
    {
        // Exit crouch first if active
        if (bIsCrouching)
        {
            SetCrouchState(false);
        }

        // Store original capsule height
        OriginalCapsuleHalfHeight = Capsule->GetScaledCapsuleHalfHeight();

        // Scale capsule for prone
        Capsule->SetCapsuleHalfHeight(ProneCapsuleHalfHeight, true);

        // Adjust mesh offset for prone
        Mesh->SetRelativeLocation(ProneMeshOffset);

        // Reduce speed for prone
        Movement->MaxWalkSpeed = ProneSpeed;

        // Disable crouch while prone
        Movement->NavAgentProps.bCanCrouch = false;

        bIsProne = true;
        UE_LOG(LogTemp, Log, TEXT("Locomotion: Prone ON (capsule half=%.0f)"), ProneCapsuleHalfHeight);
    }
    else
    {
        // Restore original capsule height
        if (OriginalCapsuleHalfHeight > 0.0f)
        {
            Capsule->SetCapsuleHalfHeight(OriginalCapsuleHalfHeight, true);
        }

        // Reset mesh offset
        Mesh->SetRelativeLocation(FVector::ZeroVector);

        // Restore normal speed
        Movement->MaxWalkSpeed = MaxWalkSpeed;

        // Re-enable crouch capability
        Movement->NavAgentProps.bCanCrouch = true;

        bIsProne = false;
        UE_LOG(LogTemp, Log, TEXT("Locomotion: Prone OFF"));
    }
}

void ULocomotionComponent::LaunchCharacter(const FVector& LaunchVelocity, bool bXYOverride, bool bZOverride)
{
    ACharacter* Character = GetOwnerCharacter();
    if (Character)
    {
        Character->LaunchCharacter(LaunchVelocity, bXYOverride, bZOverride);
        UE_LOG(LogTemp, Log, TEXT("Locomotion: Launched with velocity %s"), *LaunchVelocity.ToString());
    }
}

void ULocomotionComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Smooth direction interpolation for strafing
    if (bIsStrafing)
    {
        // Direction smoothing can be applied here for animation blend spaces
        float TargetDirection = CurrentDirection;
        CurrentDirection = FMath::FInterpTo(CurrentDirection, TargetDirection, DeltaTime, DirectionSmoothingSpeed);
    }
}
