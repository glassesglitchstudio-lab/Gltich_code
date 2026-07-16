#include "UAnimIKComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"

UAnimIKComponent::UAnimIKComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

UAnimInstance* UAnimIKComponent::FindAnimInstance() const
{
    AActor* Owner = GetOwner();
    if (!Owner) return nullptr;

    USkeletalMeshComponent* Mesh = Owner->FindComponentByClass<USkeletalMeshComponent>();
    if (!Mesh) return nullptr;

    return Mesh->GetAnimInstance();
}

void UAnimIKComponent::SetIKTarget(const FString& Limb, const FVector& Location)
{
    IKTargets.Add(Limb, Location);
    EnabledLimbs.Add(Limb);

    // Set default weight if not already set
    if (!IKWeights.Contains(Limb))
    {
        IKWeights.Add(Limb, IKStrength);
    }

    UE_LOG(LogTemp, Log, TEXT("AnimIK: '%s' target -> %s"), *Limb, *Location.ToString());
}

void UAnimIKComponent::ClearIKTarget(const FString& Limb)
{
    IKTargets.Remove(Limb);
    EnabledLimbs.Remove(Limb);
    IKWeights.Remove(Limb);
    UE_LOG(LogTemp, Log, TEXT("AnimIK: Cleared '%s'"), *Limb);
}

void UAnimIKComponent::EnableLimb(const FString& Limb)
{
    EnabledLimbs.Add(Limb);
    if (!IKWeights.Contains(Limb))
    {
        IKWeights.Add(Limb, IKStrength);
    }
    UE_LOG(LogTemp, Log, TEXT("AnimIK: Enabled limb '%s'"), *Limb);
}

void UAnimIKComponent::DisableLimb(const FString& Limb)
{
    EnabledLimbs.Remove(Limb);
    if (IKWeights.Contains(Limb))
    {
        IKWeights[Limb] = 0.0f;
    }
    UE_LOG(LogTemp, Log, TEXT("AnimIK: Disabled limb '%s'"), *Limb);
}

void UAnimIKComponent::SetLookAtTarget(const FVector& Location)
{
    LookAtTarget = Location;
}

void UAnimIKComponent::SetIKWeight(const FString& Limb, float Weight)
{
    IKWeights.Add(Limb, FMath::Clamp(Weight, 0.0f, 1.0f));
    if (Weight > 0.0f)
    {
        EnabledLimbs.Add(Limb);
    }
    else
    {
        EnabledLimbs.Remove(Limb);
    }
}

void UAnimIKComponent::ClearAllTargets()
{
    IKTargets.Empty();
    EnabledLimbs.Empty();
    IKWeights.Empty();
    LookAtTarget = FVector::ZeroVector;
    CurrentLookAt = FVector::ZeroVector;
}

FVector UAnimIKComponent::GetIKTarget(const FString& Limb) const
{
    const FVector* Target = IKTargets.Find(Limb);
    return Target ? *Target : FVector::ZeroVector;
}

bool UAnimIKComponent::IsLimbEnabled(const FString& Limb) const
{
    return EnabledLimbs.Contains(Limb);
}

void UAnimIKComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    UAnimInstance* AnimInstance = FindAnimInstance();
    if (!AnimInstance) return;

    // Update IK targets for each enabled limb
    for (const FString& Limb : EnabledLimbs)
    {
        const FVector* Target = IKTargets.Find(Limb);
        const float* Weight = IKWeights.Find(Limb);

        if (Target)
        {
            FVector FinalTarget = *Target;
            float FinalWeight = Weight ? *Weight : IKStrength;

            // Apply smoothing if enabled
            if (bEnableIKSmoothing)
            {
                FString ParamName = Limb + TEXT("IKTarget");
                AnimInstance->SetVectorParameter(FName(*ParamName), FinalTarget);
            }
            else
            {
                AnimInstance->SetVectorParameter(FName(*(Limb + TEXT("IKTarget"))), FinalTarget);
            }

            // Set IK weight parameter
            FString WeightParam = Limb + TEXT("IKWeight");
            AnimInstance->SetFloatParameter(FName(*WeightParam), FinalWeight);
        }
    }

    // Update look-at with smoothing
    if (LookAtTarget != FVector::ZeroVector)
    {
        if (bEnableIKSmoothing)
        {
            CurrentLookAt = FMath::VInterpTo(CurrentLookAt, LookAtTarget, DeltaTime, LookAtInterpSpeed);
        }
        else
        {
            CurrentLookAt = LookAtTarget;
        }
        AnimInstance->SetVectorParameter(FName("LookAtTarget"), CurrentLookAt);
        AnimInstance->SetFloatParameter(FName("LookAtWeight"), IKStrength);
    }
    else
    {
        // Blend out look-at
        CurrentLookAt = FMath::VInterpTo(CurrentLookAt, FVector::ZeroVector, DeltaTime, LookAtInterpSpeed);
        AnimInstance->SetVectorParameter(FName("LookAtTarget"), CurrentLookAt);
        AnimInstance->SetFloatParameter(FName("LookAtWeight"), 0.0f);
    }
}
