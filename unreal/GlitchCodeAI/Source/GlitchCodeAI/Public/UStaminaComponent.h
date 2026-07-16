#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UStaminaComponent.generated.h"

class ACharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStaminaChanged, float, NewStamina);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnExhausted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnStaminaRecovered);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UStaminaComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UStaminaComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Combat|Stamina")
    void SetStamina(float Value);

    UFUNCTION(BlueprintPure, Category = "Combat|Stamina")
    float GetStamina() const { return CurrentStamina; }

    UFUNCTION(BlueprintCallable, Category = "Combat|Stamina")
    void Drain(float Amount);

    UFUNCTION(BlueprintCallable, Category = "Combat|Stamina")
    void Recover(float Amount);

    UFUNCTION(BlueprintCallable, Category = "Combat|Stamina")
    void SetMaxStamina(float Value);

    UFUNCTION(BlueprintCallable, Category = "Combat|Stamina")
    void SetSprintDrain(float Rate);

    UFUNCTION(BlueprintPure, Category = "Combat|Stamina")
    bool IsExhausted() const { return bIsExhausted; }

    UFUNCTION(BlueprintPure, Category = "Combat|Stamina")
    bool IsSprinting() const { return bIsSprinting; }

    UFUNCTION(BlueprintCallable, Category = "Combat|Stamina")
    void SetSprinting(bool bSprint);

    UPROPERTY(BlueprintAssignable, Category = "Combat|Stamina")
    FOnStaminaChanged OnStaminaChanged;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Stamina")
    FOnExhausted OnExhausted;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Stamina")
    FOnStaminaRecovered OnStaminaRecovered;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina|Movement")
    float SprintSpeed = 800.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina|Movement")
    float WalkSpeed = 400.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina|Movement")
    float ExhaustionSpeed = 200.0f;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina")
    float MaxStamina = 100.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Combat|Stamina")
    float CurrentStamina;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina")
    float SprintDrainRate = 15.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina")
    float PassiveRecoverRate = 10.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stamina")
    float ExhaustionRecoveryThreshold = 20.0f;

private:
    bool bIsExhausted = false;
    bool bIsSprinting = false;

    ACharacter* GetOwningCharacter() const;
    void ApplyWalkSpeed(float Speed);
};
