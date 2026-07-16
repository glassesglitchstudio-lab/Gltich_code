#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UPatrolRouteComponent.generated.h"

UENUM(BlueprintType)
enum class EPatrolType : uint8
{
	Loop      UMETA(DisplayName = "Loop"),
	PingPong  UMETA(DisplayName = "Ping-Pong"),
	Random    UMETA(DisplayName = "Random"),
	Once      UMETA(DisplayName = "Once"),
};

USTRUCT(BlueprintType)
struct FPatrolPoint
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	FVector Location = FVector::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	float WaitTime = 0.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	FString Label;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	bool bIsEnabled = true;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPatrolPointReached, int32, PointIndex);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPatrolCompleted);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UPatrolRouteComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPatrolRouteComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Patrol Point Management
	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void AddPatrolPoint(FVector Location, float WaitTime = 0.0f, const FString& Label = TEXT(""));

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void AddPatrolPointStruct(const FPatrolPoint& Point);

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void RemovePatrolPoint(int32 Index);

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void ClearPatrolPoints();

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void SetPatrolPointEnabled(int32 Index, bool bEnabled);

	// Navigation
	UFUNCTION(BlueprintCallable, Category = "Patrol")
	FVector GetNextPoint();

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	FVector GetPreviousPoint();

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	FVector GetCurrentPoint() const;

	UFUNCTION(BlueprintPure, Category = "Patrol")
	int32 GetCurrentPointIndex() const { return CurrentPointIndex; }

	UFUNCTION(BlueprintPure, Category = "Patrol")
	int32 GetPatrolPointCount() const { return PatrolPoints.Num(); }

	UFUNCTION(BlueprintPure, Category = "Patrol")
	bool HasPatrolPoints() const { return PatrolPoints.Num() > 0; }

	// Configuration
	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void SetPatrolType(EPatrolType NewType);

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void SetMovementSpeed(float NewSpeed);

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void StartPatrol();

	UFUNCTION(BlueprintCallable, Category = "Patrol")
	void StopPatrol();

	UFUNCTION(BlueprintPure, Category = "Patrol")
	bool IsPatrolling() const { return bIsPatrolling; }

	// Events
	UPROPERTY(BlueprintAssignable, Category = "Patrol")
	FOnPatrolPointReached OnPatrolPointReached;

	UPROPERTY(BlueprintAssignable, Category = "Patrol")
	FOnPatrolCompleted OnPatrolCompleted;

	// Properties
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Patrol")
	EPatrolType PatrolType = EPatrolType::Loop;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Patrol")
	float MovementSpeed = 300.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Patrol")
	float AcceptanceRadius = 50.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Patrol")
	bool bDrawDebugPath = false;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Patrol")
	bool bIsPatrolling = false;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TArray<FPatrolPoint> PatrolPoints;

	int32 CurrentPointIndex = 0;
	int32 PingPongDirection = 1;
	bool bPatrolComplete = false;

	FVector CalculateMoveDirection(const FVector& Target, float DeltaTime) const;
	void AdvanceToNextPoint();
	void HandleWaitTimer(float DeltaTime);
	float WaitTimer = 0.0f;
	bool bIsWaiting = false;
};
