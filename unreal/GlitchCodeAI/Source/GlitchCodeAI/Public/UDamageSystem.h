#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UDamageSystem.generated.h"

class AActor;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnDamageDealt, float, FinalDamage, AActor*, Instigator, const FString&, DamageType);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDefenseChanged, float, NewDefenseValue);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UDamageSystem : public UActorComponent
{
    GENERATED_BODY()

public:
    UDamageSystem();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    // Core damage
    UFUNCTION(BlueprintCallable, Category = "Combat|Damage")
    float DealDamage(AActor* Target, float BaseDamage, const FString& DamageType = TEXT("generic"));

    UFUNCTION(BlueprintCallable, Category = "Combat|Damage")
    float DealDamageWithOrigin(AActor* Target, float BaseDamage, const FVector& HitLocation, const FVector& HitDirection, const FString& DamageType = TEXT("generic"));

    // Area of effect damage
    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|AoE")
    void ApplyAoE(const FVector& Origin, float InnerRadius, float OuterRadius, float MaxDamage, float MinDamage, AActor* Instigator);

    // Damage over time
    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|DoT")
    void ApplyDoT(AActor* Target, float DamagePerTick, float TickInterval, float TotalDuration, const FString& DamageType = TEXT("dot"));

    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|DoT")
    void CancelDoT();

    // Defense and resistance
    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|Defense")
    void SetDefense(float DefenseValue);

    UFUNCTION(BlueprintPure, Category = "Combat|Damage|Defense")
    float GetDefense() const { return DefenseValue; }

    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|Defense")
    void SetVulnerability(float Multiplier);

    UFUNCTION(BlueprintPure, Category = "Combat|Damage|Defense")
    float GetVulnerability() const { return VulnerabilityMultiplier; }

    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|Defense")
    void SetResistance(const FString& DamageType, float ResistanceValue);

    UFUNCTION(BlueprintPure, Category = "Combat|Damage|Defense")
    float GetResistance(const FString& DamageType) const;

    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|Defense")
    void ClearResistance(const FString& DamageType);

    UFUNCTION(BlueprintCallable, Category = "Combat|Damage|Defense")
    void ClearAllResistances();

    // Calculate final damage after all modifiers
    UFUNCTION(BlueprintPure, Category = "Combat|Damage")
    float CalculateFinalDamage(float BaseDamage, const FString& DamageType) const;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Damage")
    FOnDamageDealt OnDamageDealt;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Damage")
    FOnDefenseChanged OnDefenseChanged;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Damage|DoT")
    float DefaultDoTTickInterval = 0.5f;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Damage|Defense")
    float DefenseValue = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Damage|Defense")
    float VulnerabilityMultiplier = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Damage|Defense")
    TMap<FString, float> Resistances;

private:
    // DoT state
    bool bDoTActive = false;
    float DoTDamagePerTick = 0.0f;
    float DoTTimeRemaining = 0.0f;
    float DoTTickTimer = 0.0f;
    float DoTTickInterval = 0.5f;
    FString DoTDamageType;
    AActor* DoTTarget = nullptr;

    void TickDoT(float DeltaTime);
};
