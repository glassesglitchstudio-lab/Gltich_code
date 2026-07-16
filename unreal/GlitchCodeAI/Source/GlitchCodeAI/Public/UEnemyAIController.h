#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UEnemyAIController.generated.h"

UENUM(BlueprintType)
enum class EEnemyAIState : uint8
{
	Idle     UMETA(DisplayName = "Idle"),
	Patrol   UMETA(DisplayName = "Patrol"),
	Alert    UMETA(DisplayName = "Alert"),
	Chase    UMETA(DisplayName = "Chase"),
	Attack   UMETA(DisplayName = "Attack"),
	Flee     UMETA(DisplayName = "Flee"),
	Dead     UMETA(DisplayName = "Dead"),
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStateChanged, EEnemyAIState, NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTargetSet, AActor*, NewTarget);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnTargetCleared);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UEnemyAIController : public UActorComponent
{
	GENERATED_BODY()

public:
	UEnemyAIController();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Target Management
	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void SetTargetActor(AActor* NewTarget);

	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void ClearTarget();

	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	AActor* GetTarget() const { return TargetActor; }

	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	bool HasTarget() const { return TargetActor != nullptr; }

	// State Management
	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void SetState(EEnemyAIState NewState);

	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	EEnemyAIState GetCurrentState() const { return CurrentState; }

	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	FString GetStateName() const;

	// State Queries
	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	bool IsAlive() const { return CurrentState != EEnemyAIState::Dead; }

	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	bool IsChasing() const { return CurrentState == EEnemyAIState::Chase; }

	UFUNCTION(BlueprintPure, Category = "Enemy AI")
	bool IsAttacking() const { return CurrentState == EEnemyAIState::Attack; }

	// Combat Parameters
	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void SetAttackRange(float NewRange);

	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void SetDetectionRange(float NewRange);

	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void SetChaseSpeed(float NewSpeed);

	UFUNCTION(BlueprintCallable, Category = "Enemy AI")
	void SetFleeHealthThreshold(float NewThreshold);

	// Events
	UPROPERTY(BlueprintAssignable, Category = "Enemy AI")
	FOnStateChanged OnStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "Enemy AI")
	FOnTargetSet OnTargetSet;

	UPROPERTY(BlueprintAssignable, Category = "Enemy AI")
	FOnTargetCleared OnTargetCleared;

	// Properties
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float AttackRange = 200.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float DetectionRange = 1500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float ChaseSpeed = 600.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float PatrolSpeed = 200.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float AttackCooldown = 1.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float FleeHealthThreshold = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	float AlertDuration = 2.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	bool bCanFlee = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy AI")
	bool bCanAttack = true;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	AActor* TargetActor = nullptr;

	EEnemyAIState CurrentState = EEnemyAIState::Idle;
	EEnemyAIState PreviousState = EEnemyAIState::Idle;

	float AttackTimer = 0.0f;
	float AlertTimer = 0.0f;

	void TickIdle(float DeltaTime);
	void TickPatrol(float DeltaTime);
	void TickAlert(float DeltaTime);
	void TickChase(float DeltaTime);
	void TickAttack(float DeltaTime);
	void TickFlee(float DeltaTime);

	void OnTargetPerceptionUpdated(AActor* Actor, bool bCanSee);
	float DistanceToTarget() const;
	bool IsTargetInRange(float Range) const;

	UFUNCTION()
	void OnSightUpdated(AActor* Actor, bool bCanSee);

	UPROPERTY()
	class UAIPerceptionComponent* PerceptionComponent;
};
