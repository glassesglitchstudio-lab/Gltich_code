#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/Character.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/SceneComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundCue.h"
#include "Particles/ParticleSystemComponent.h"
#include "UCombatComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnEnemyKilled, AActor*, Enemy, float, DamageDealt);

USTRUCT(BlueprintType)
struct FWeaponData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
	FString WeaponName = TEXT("unarmed");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
	float BaseDamage = 20.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
	float AttackRange = 150.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
	float AttackSpeed = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
	UStaticMesh* WeaponMesh = nullptr;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UCombatComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "Combat")
	FOnEnemyKilled OnEnemyKilled;

	UCombatComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Combat")
	void Attack(AActor* Target, const FString& WeaponType = TEXT("unarmed"));

	UFUNCTION(BlueprintCallable, Category = "Combat")
	void Block();

	UFUNCTION(BlueprintCallable, Category = "Combat")
	void Dodge();

	UFUNCTION(BlueprintCallable, Category = "Combat")
	void Parry();

	UFUNCTION(BlueprintCallable, Category = "Combat")
	void ComboStep();

	UFUNCTION(BlueprintCallable, Category = "Combat")
	void SetWeapon(const FString& WeaponType);

	UFUNCTION(BlueprintPure, Category = "Combat")
	bool IsBlocking() const { return bIsBlocking; }

	UFUNCTION(BlueprintPure, Category = "Combat")
	bool IsInvincible() const { return bIsInvincible; }

	UFUNCTION(BlueprintPure, Category = "Combat")
	float GetCurrentDamage() const;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Weapon")
	TMap<FString, FWeaponData> WeaponDataTable;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Combat|State")
	FString CurrentWeapon = TEXT("unarmed");

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Combat|State")
	int32 ComboCount = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Combo")
	int32 MaxComboSteps = 3;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Combo")
	float ComboDamageMultiplier = 0.25f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Timing")
	float AttackCooldown = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Timing")
	float ParryWindow = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Timing")
	float InvincibilityDuration = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Block")
	float BlockDamageReduction = 0.8f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Block")
	float DodgeImpulseStrength = 800.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Animation")
	UAnimMontage* AttackMontage = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Animation")
	UAnimMontage* BlockMontage = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Animation")
	UAnimMontage* DodgeMontage = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
	USoundCue* HitSound = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
	UParticleSystem* HitParticle = nullptr;

private:
	bool bIsBlocking = false;
	bool bIsInvincible = false;
	float LastAttackTime = 0.0f;
	float ParryTimer = 0.0f;
	bool bParryActive = false;

	FTimerHandle InvincibilityTimerHandle;
	FTimerHandle BlockTimerHandle;
	FTimerHandle ParryTimerHandle;

	void HandleComboDamage(AActor* Target, float BaseDamage);
	void PlayHitEffects(AActor* Target, const FVector& HitLocation);
	void EndInvincibility();
	void EndBlock();
	void EndParryWindow();
	ACharacter* GetOwnerCharacter() const;
};
