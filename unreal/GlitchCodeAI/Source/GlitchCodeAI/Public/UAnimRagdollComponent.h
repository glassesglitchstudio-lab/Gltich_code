#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "UAnimRagdollComponent.generated.h"

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAnimRagdollComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAnimRagdollComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void ActivateRagdoll();

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void DeactivateRagdoll();

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void SetWeight(float Weight);

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void BlendRagdoll(float BlendTime);

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void ApplyImpulse(float Force, const FVector& Direction, const FName& BoneName = NAME_None);

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void ApplyRadialImpulse(const FVector& Origin, float Force, float Radius);

    UFUNCTION(BlueprintCallable, Category = "Animation|Ragdoll")
    void SetAllBodiesBelowSimulatePhysics(const FName& BoneName, bool bNewSimulate, bool bIncludeSelf = true);

    UFUNCTION(BlueprintPure, Category = "Animation|Ragdoll")
    bool IsRagdollActive() const { return bIsRagdollActive; }

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Animation|Ragdoll")
    bool bIsRagdollActive = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Ragdoll")
    float RagdollWeight = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Ragdoll")
    float BlendDuration = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Ragdoll")
    float LinearDamping = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Ragdoll")
    float AngularDamping = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Ragdoll")
    bool bEnableGravity = true;

private:
    USkeletalMeshComponent* FindSkeletalMesh() const;
    float BlendAlpha = 0.0f;
    float BlendTimer = 0.0f;
    bool bBlending = false;
};
