#include "UAnimStateComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"

UAnimStateComponent::UAnimStateComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
    AvailableStates.Add(TEXT("idle"));
    AvailableStates.Add(TEXT("walk"));
    AvailableStates.Add(TEXT("run"));
}

UAnimInstance* UAnimStateComponent::FindAnimInstance() const
{
    AActor* Owner = GetOwner();
    if (!Owner) return nullptr;

    USkeletalMeshComponent* Mesh = Owner->FindComponentByClass<USkeletalMeshComponent>();
    if (!Mesh) return nullptr;

    return Mesh->GetAnimInstance();
}

UAnimInstance* UAnimStateComponent::GetAnimInstance() const
{
    return FindAnimInstance();
}

void UAnimStateComponent::SetState(const FString& Name)
{
    if (!AvailableStates.Contains(Name)) return;

    UAnimInstance* AnimInstance = FindAnimInstance();
    if (!AnimInstance)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimState: No AnimInstance found on owner"));
        return;
    }

    CurrentState = Name;

    // Set state as a name parameter for state machine transitions
    AnimInstance->SetCurrentStateName(FName(*Name));

    UE_LOG(LogTemp, Log, TEXT("AnimState: Set state -> '%s'"), *Name);
    OnStateChanged.Broadcast(Name);
}

void UAnimStateComponent::BlendToState(const FString& Name, float BlendTime)
{
    if (!AvailableStates.Contains(Name)) return;

    UAnimInstance* AnimInstance = FindAnimInstance();
    if (!AnimInstance)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimState: No AnimInstance found for blend"));
        return;
    }

    CurrentState = Name;

    // If we have a montage, play it with blend
    if (DefaultBlendMontage)
    {
        float MontageLength = AnimInstance->Montage_Play(DefaultBlendMontage, 1.0f);
        if (MontageLength > 0.0f)
        {
            UE_LOG(LogTemp, Log, TEXT("AnimState: Blending to '%s' via montage (%.2fs)"), *Name, BlendTime);
        }
    }
    else
    {
        // Use blend time as interpolation factor — set a float parameter for BP blend graphs
        AnimInstance->SetFloatParameter(FName("BlendWeight"), 1.0f);
        AnimInstance->SetFloatParameter(FName("BlendTime"), BlendTime);
        UE_LOG(LogTemp, Log, TEXT("AnimState: Blend to '%s' (%.2fs)"), *Name, BlendTime);
    }

    OnStateChanged.Broadcast(Name);
}

void UAnimStateComponent::SetFloatParameter(const FString& ParamName, float Value)
{
    UAnimInstance* AnimInstance = FindAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->SetFloatParameter(FName(*ParamName), Value);
    }
}

void UAnimStateComponent::SetBoolParameter(const FString& ParamName, bool Value)
{
    UAnimInstance* AnimInstance = FindAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->SetBoolParameter(FName(*ParamName), Value);
    }
}

void UAnimStateComponent::SetIntParameter(const FString& ParamName, int32 Value)
{
    UAnimInstance* AnimInstance = FindAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->SetIntParameter(FName(*ParamName), Value);
    }
}

void UAnimStateComponent::SetBlendSpaceInput(const FString& ParamName, float X, float Y)
{
    UAnimInstance* AnimInstance = FindAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->SetBlendSpaceInput(FName(*ParamName), FVector2D(X, Y));
    }
}

void UAnimStateComponent::AddState(const FString& Name)
{
    if (!AvailableStates.Contains(Name))
    {
        AvailableStates.Add(Name);
        UE_LOG(LogTemp, Log, TEXT("AnimState: Added state '%s'"), *Name);
    }
}

void UAnimStateComponent::RemoveState(const FString& Name)
{
    if (Name == CurrentState) return;
    AvailableStates.Remove(Name);
    UE_LOG(LogTemp, Log, TEXT("AnimState: Removed state '%s'"), *Name);
}
