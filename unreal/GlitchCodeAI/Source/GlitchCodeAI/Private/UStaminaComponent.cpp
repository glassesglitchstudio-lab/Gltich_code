#include "UStaminaComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"

UStaminaComponent::UStaminaComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    CurrentStamina = MaxStamina;
}

void UStaminaComponent::BeginPlay()
{
    Super::BeginPlay();
    CurrentStamina = FMath::Clamp(CurrentStamina, 0.0f, MaxStamina);
    ApplyWalkSpeed(WalkSpeed);
}

void UStaminaComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Drain stamina while sprinting
    if (bIsSprinting && !bIsExhausted && CurrentStamina > 0.0f)
    {
        float OldStamina = CurrentStamina;
        CurrentStamina = FMath::Clamp(CurrentStamina - SprintDrainRate * DeltaTime, 0.0f, MaxStamina);

        if (CurrentStamina != OldStamina)
        {
            OnStaminaChanged.Broadcast(CurrentStamina);
        }

        if (CurrentStamina <= 0.0f && !bIsExhausted)
        {
            bIsExhausted = true;
            OnExhausted.Broadcast();
            ApplyWalkSpeed(ExhaustionSpeed);
        }
    }

    // Passive stamina recovery when not sprinting or when exhausted
    if ((!bIsSprinting || bIsExhausted) && CurrentStamina < MaxStamina)
    {
        float OldStamina = CurrentStamina;
        CurrentStamina = FMath::Clamp(CurrentStamina + PassiveRecoverRate * DeltaTime, 0.0f, MaxStamina);

        if (CurrentStamina != OldStamina)
        {
            OnStaminaChanged.Broadcast(CurrentStamina);
        }

        // Recover from exhaustion once stamina reaches threshold
        if (bIsExhausted && CurrentStamina >= ExhaustionRecoveryThreshold)
        {
            bIsExhausted = false;
            OnStaminaRecovered.Broadcast();
            ApplyWalkSpeed(bIsSprinting ? SprintSpeed : WalkSpeed);
        }
    }
}

void UStaminaComponent::SetStamina(float Value)
{
    float OldStamina = CurrentStamina;
    CurrentStamina = FMath::Clamp(Value, 0.0f, MaxStamina);

    if (CurrentStamina != OldStamina)
    {
        OnStaminaChanged.Broadcast(CurrentStamina);
    }

    // Check if exhaustion should be cleared
    if (bIsExhausted && CurrentStamina >= ExhaustionRecoveryThreshold)
    {
        bIsExhausted = false;
        OnStaminaRecovered.Broadcast();
        ApplyWalkSpeed(bIsSprinting ? SprintSpeed : WalkSpeed);
    }
}

void UStaminaComponent::Drain(float Amount)
{
    if (Amount <= 0.0f || bIsExhausted) return;

    float OldStamina = CurrentStamina;
    CurrentStamina = FMath::Clamp(CurrentStamina - Amount, 0.0f, MaxStamina);

    if (CurrentStamina != OldStamina)
    {
        OnStaminaChanged.Broadcast(CurrentStamina);
    }

    if (CurrentStamina <= 0.0f && !bIsExhausted)
    {
        bIsExhausted = true;
        OnExhausted.Broadcast();
        ApplyWalkSpeed(ExhaustionSpeed);
    }
}

void UStaminaComponent::Recover(float Amount)
{
    if (Amount <= 0.0f) return;

    float OldStamina = CurrentStamina;
    CurrentStamina = FMath::Clamp(CurrentStamina + Amount, 0.0f, MaxStamina);

    if (CurrentStamina != OldStamina)
    {
        OnStaminaChanged.Broadcast(CurrentStamina);
    }

    if (bIsExhausted && CurrentStamina >= ExhaustionRecoveryThreshold)
    {
        bIsExhausted = false;
        OnStaminaRecovered.Broadcast();
        ApplyWalkSpeed(bIsSprinting ? SprintSpeed : WalkSpeed);
    }
}

void UStaminaComponent::SetMaxStamina(float Value)
{
    MaxStamina = FMath::Max(1.0f, Value);
    CurrentStamina = FMath::Clamp(CurrentStamina, 0.0f, MaxStamina);
}

void UStaminaComponent::SetSprintDrain(float Rate)
{
    SprintDrainRate = FMath::Max(0.0f, Rate);
}

void UStaminaComponent::SetSprinting(bool bSprint)
{
    if (bIsExhausted && bSprint) return;

    bIsSprinting = bSprint;
    ApplyWalkSpeed(bSprint ? SprintSpeed : WalkSpeed);
}

ACharacter* UStaminaComponent::GetOwningCharacter() const
{
    return Cast<ACharacter>(GetOwner());
}

void UStaminaComponent::ApplyWalkSpeed(float Speed)
{
    ACharacter* Character = GetOwningCharacter();
    if (Character)
    {
        UCharacterMovementComponent* Movement = Character->GetCharacterMovement();
        if (Movement)
        {
            Movement->MaxWalkSpeed = Speed;
        }
    }
}
