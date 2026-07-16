#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "ULocomotionComponent.generated.h"

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API ULocomotionComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    ULocomotionComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void SetSpeed(float Speed);

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void SetDirection(float Angle);

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void SetStrafe(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void SetCrouchState(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void SetProneState(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void SetMaxWalkSpeed(float Speed);

    UFUNCTION(BlueprintCallable, Category = "Locomotion")
    void LaunchCharacter(const FVector& LaunchVelocity, bool bXYOverride, bool bZOverride);

    UFUNCTION(BlueprintPure, Category = "Locomotion")
    float GetCurrentSpeed() const;

    UFUNCTION(BlueprintPure, Category = "Locomotion")
    bool IsCrouching() const;

    UFUNCTION(BlueprintPure, Category = "Locomotion")
    bool IsProne() const;

    UFUNCTION(BlueprintPure, Category = "Locomotion")
    FVector GetVelocity() const;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Locomotion")
    float MaxWalkSpeed = 600.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Locomotion")
    float CrouchSpeed = 300.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Locomotion")
    float ProneSpeed = 150.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Locomotion")
    float ProneCapsuleHalfHeight = 30.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Locomotion")
    FVector ProneMeshOffset = FVector(0.0f, 0.0f, -40.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Locomotion")
    float DirectionSmoothingSpeed = 10.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotion")
    float CurrentDirection = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotion")
    bool bIsStrafing = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotion")
    bool bIsCrouching = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotion")
    bool bIsProne = false;

private:
    ACharacter* GetOwnerCharacter() const;
    UCharacterMovementComponent* GetMovementComponent() const;
    float OriginalCapsuleHalfHeight = 0.0f;
};
