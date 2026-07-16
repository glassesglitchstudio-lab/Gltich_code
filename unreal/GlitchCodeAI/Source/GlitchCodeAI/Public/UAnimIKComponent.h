#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "UAnimIKComponent.generated.h"

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAnimIKComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAnimIKComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void SetIKTarget(const FString& Limb, const FVector& Location);

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void ClearIKTarget(const FString& Limb);

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void EnableLimb(const FString& Limb);

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void DisableLimb(const FString& Limb);

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void SetLookAtTarget(const FVector& Location);

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void SetIKWeight(const FString& Limb, float Weight);

    UFUNCTION(BlueprintCallable, Category = "Animation|IK")
    void ClearAllTargets();

    UFUNCTION(BlueprintPure, Category = "Animation|IK")
    FVector GetIKTarget(const FString& Limb) const;

    UFUNCTION(BlueprintPure, Category = "Animation|IK")
    bool IsLimbEnabled(const FString& Limb) const;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|IK")
    float IKStrength = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|IK")
    float LookAtInterpSpeed = 15.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|IK")
    bool bEnableIKSmoothing = true;

private:
    TMap<FString, FVector> IKTargets;
    TMap<FString, float> IKWeights;
    TSet<FString> EnabledLimbs;
    FVector LookAtTarget = FVector::ZeroVector;
    FVector CurrentLookAt = FVector::ZeroVector;

    UAnimInstance* FindAnimInstance() const;
};
