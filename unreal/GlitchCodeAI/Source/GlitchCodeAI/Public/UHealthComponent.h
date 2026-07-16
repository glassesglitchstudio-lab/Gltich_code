#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UHealthComponent.generated.h"

class ACharacter;
class APlayerController;
class USoundBase;
class UCameraShakeBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealthChanged, float, NewHealth, float, Delta);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDeath);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDamageReceived, float, DamageAmount);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UHealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHealthComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void Damage(float Amount, const FString& Type = TEXT("generic"));

    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void Heal(float Amount);

    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void SetHealth(float Value);

    UFUNCTION(BlueprintPure, Category = "Combat|Health")
    float GetHealth() const { return CurrentHealth; }

    UFUNCTION(BlueprintPure, Category = "Combat|Health")
    float GetMaxHealth() const { return MaxHealth; }

    UFUNCTION(BlueprintPure, Category = "Combat|Health")
    bool IsDead() const { return bIsDead; }

    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void SetMaxHealth(float Value);

    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void SetRegenRate(float Rate);

    UPROPERTY(BlueprintAssignable, Category = "Combat|Health")
    FOnHealthChanged OnHealthChanged;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Health")
    FOnDeath OnDeath;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Health")
    FOnDamageReceived OnDamageReceived;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Sounds")
    USoundBase* DamageSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Sounds")
    USoundBase* HealSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Sounds")
    USoundBase* DeathSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Camera")
    TSubclassOf<UCameraShakeBase> DamageCameraShake;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Effects")
    float CameraShakeScale = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Effects")
    float DamageImpulseForce = 500.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health|Effects")
    float DamageRadius = 300.0f;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health")
    float MaxHealth = 100.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Combat|Health")
    float CurrentHealth;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health")
    float RegenRate = 0.0f;

private:
    bool bIsDead = false;
    float RegenAccumulator = 0.0f;

    ACharacter* GetOwningCharacter() const;
    APlayerController* GetOwningPlayerController() const;
    void HandleDeath();
    void PlayDamageEffects(const FVector& HitLocation);
    void ApplyDamageImpulseToNearby(const FVector& Origin);
};
