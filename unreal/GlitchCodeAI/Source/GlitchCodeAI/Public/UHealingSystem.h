#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UHealingSystem.generated.h"

class UHealthComponent;
class ACharacter;
class USoundBase;
class UParticleSystem;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealingApplied, float, Amount, AActor*, Target);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnRevived, AActor*, RevivedActor);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UHealingSystem : public UActorComponent
{
    GENERATED_BODY()

public:
    UHealingSystem();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    // Direct heal
    UFUNCTION(BlueprintCallable, Category = "Combat|Healing")
    bool Apply(AActor* Target, float HealAmount);

    // Heal over time (bandage)
    UFUNCTION(BlueprintCallable, Category = "Combat|Healing|HoT")
    void Bandage(AActor* Target, float HealPerTick, float TickInterval, float Duration);

    UFUNCTION(BlueprintCallable, Category = "Combat|Healing|HoT")
    void CancelBandage();

    UFUNCTION(BlueprintPure, Category = "Combat|Healing|HoT")
    bool IsBandaging() const { return bBandageActive; }

    // Instant large heal (potion)
    UFUNCTION(BlueprintCallable, Category = "Combat|Healing")
    bool Potion(AActor* Target, float HealAmount);

    // Revive a dead target
    UFUNCTION(BlueprintCallable, Category = "Combat|Healing")
    bool Revive(AActor* Target, float ReviveHealthPercent = 0.25f);

    // Remove all DoT effects from target
    UFUNCTION(BlueprintCallable, Category = "Combat|Healing")
    bool Cleanse(AActor* Target);

    // Set passive heal rate
    UFUNCTION(BlueprintCallable, Category = "Combat|Healing")
    void SetRate(float NewRate);

    UFUNCTION(BlueprintPure, Category = "Combat|Healing")
    float GetRate() const { return PassiveHealRate; }

    UPROPERTY(BlueprintAssignable, Category = "Combat|Healing")
    FOnHealingApplied OnHealingApplied;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Healing")
    FOnRevived OnRevived;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Healing|Effects")
    UParticleSystem* HealParticle;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Healing|Effects")
    USoundBase* HealSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Healing|Effects")
    float PotionVisualIntensity = 2.0f;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Healing")
    float PassiveHealRate = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Healing")
    float MaxBandageHealPerTick = 5.0f;

private:
    // Bandage HoT state
    bool bBandageActive = false;
    float BandageHealPerTick = 0.0f;
    float BandageTickInterval = 1.0f;
    float BandageTimeRemaining = 0.0f;
    float BandageTickTimer = 0.0f;
    AActor* BandageTarget = nullptr;

    void TickBandage(float DeltaTime);
    void SpawnHealEffects(AActor* Target);
    void ApplyPotionVisualEffect(ACharacter* TargetChar);
};
