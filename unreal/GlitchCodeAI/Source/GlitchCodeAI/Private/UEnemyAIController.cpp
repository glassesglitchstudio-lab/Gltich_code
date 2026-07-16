#include "UEnemyAIController.h"
#include "UAIPerceptionComponent.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"
#include "Kismet/KismetMathLibrary.h"

UEnemyAIController::UEnemyAIController()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.05f;
}

void UEnemyAIController::BeginPlay()
{
	Super::BeginPlay();

	// Try to find or create perception component
	AActor* Owner = GetOwner();
	if (Owner)
	{
		PerceptionComponent = Owner->FindComponentByClass<UAIPerceptionComponent>();
		if (PerceptionComponent)
		{
			PerceptionComponent->OnSightUpdated.AddDynamic(this, &UEnemyAIController::OnSightUpdated);
			PerceptionComponent->SetSightRange(DetectionRange);
		}
	}
}

void UEnemyAIController::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	switch (CurrentState)
	{
	case EEnemyAIState::Idle:
		TickIdle(DeltaTime);
		break;
	case EEnemyAIState::Patrol:
		TickPatrol(DeltaTime);
		break;
	case EEnemyAIState::Alert:
		TickAlert(DeltaTime);
		break;
	case EEnemyAIState::Chase:
		TickChase(DeltaTime);
		break;
	case EEnemyAIState::Attack:
		TickAttack(DeltaTime);
		break;
	case EEnemyAIState::Flee:
		TickFlee(DeltaTime);
		break;
	case EEnemyAIState::Dead:
		break;
	}
}

void UEnemyAIController::SetTargetActor(AActor* NewTarget)
{
	if (TargetActor == NewTarget)
	{
		return;
	}

	TargetActor = NewTarget;

	if (NewTarget)
	{
		OnTargetSet.Broadcast(NewTarget);
	}
	else
	{
		OnTargetCleared.Broadcast();
	}
}

void UEnemyAIController::ClearTarget()
{
	TargetActor = nullptr;
	OnTargetCleared.Broadcast();
}

void UEnemyAIController::SetState(EEnemyAIState NewState)
{
	if (CurrentState == NewState)
	{
		return;
	}

	PreviousState = CurrentState;
	CurrentState = NewState;

	// Reset timers on state change
	AttackTimer = 0.0f;
	AlertTimer = 0.0f;

	OnStateChanged.Broadcast(NewState);
}

FString UEnemyAIController::GetStateName() const
{
	switch (CurrentState)
	{
	case EEnemyAIState::Idle:   return TEXT("Idle");
	case EEnemyAIState::Patrol: return TEXT("Patrol");
	case EEnemyAIState::Alert:  return TEXT("Alert");
	case EEnemyAIState::Chase:  return TEXT("Chase");
	case EEnemyAIState::Attack: return TEXT("Attack");
	case EEnemyAIState::Flee:   return TEXT("Flee");
	case EEnemyAIState::Dead:   return TEXT("Dead");
	default:                    return TEXT("Unknown");
	}
}

void UEnemyAIController::SetAttackRange(float NewRange)
{
	AttackRange = FMath::Max(0.0f, NewRange);
}

void UEnemyAIController::SetDetectionRange(float NewRange)
{
	DetectionRange = FMath::Max(0.0f, NewRange);
	if (PerceptionComponent)
	{
		PerceptionComponent->SetSightRange(DetectionRange);
	}
}

void UEnemyAIController::SetChaseSpeed(float NewSpeed)
{
	ChaseSpeed = FMath::Max(0.0f, NewSpeed);
}

void UEnemyAIController::SetFleeHealthThreshold(float NewThreshold)
{
	FleeHealthThreshold = FMath::Clamp(NewThreshold, 0.0f, 1.0f);
}

// --- State Tick Functions ---

void UEnemyAIController::TickIdle(float DeltaTime)
{
	// Transition to patrol if no target
	if (!HasTarget())
	{
		// Idle for a moment then patrol
		SetState(EEnemyAIState::Patrol);
	}
}

void UEnemyAIController::TickPatrol(float DeltaTime)
{
	// If target detected, chase
	if (HasTarget() && IsTargetInRange(DetectionRange))
	{
		SetState(EEnemyAIState::Chase);
		return;
	}

	// Patrol movement handled by UPatrolRouteComponent
}

void UEnemyAIController::TickAlert(float DeltaTime)
{
	AlertTimer += DeltaTime;

	if (AlertTimer >= AlertDuration)
	{
		if (HasTarget())
		{
			SetState(EEnemyAIState::Chase);
		}
		else
		{
			SetState(EEnemyAIState::Patrol);
		}
	}
}

void UEnemyAIController::TickChase(float DeltaTime)
{
	if (!HasTarget() || !TargetActor->IsValidLowLevel())
	{
		ClearTarget();
		SetState(EEnemyAIState::Patrol);
		return;
	}

	// Move towards target
	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	FVector CurrentLocation = Owner->GetActorLocation();
	FVector TargetLocation = TargetActor->GetActorLocation();
	FVector Direction = (TargetLocation - CurrentLocation).GetSafeNormal();

	FVector NewLocation = CurrentLocation + Direction * ChaseSpeed * DeltaTime;
	Owner->SetActorLocation(NewLocation);

	// Face target
	FRotator LookAtRotation = UKismetMathLibrary::FindLookAtRotation(CurrentLocation, TargetLocation);
	Owner->SetActorRotation(LookAtRotation);

	// Transition to attack if in range
	if (IsTargetInRange(AttackRange) && bCanAttack)
	{
		SetState(EEnemyAIState::Attack);
	}
}

void UEnemyAIController::TickAttack(float DeltaTime)
{
	if (!HasTarget() || !TargetActor->IsValidLowLevel())
	{
		ClearTarget();
		SetState(EEnemyAIState::Patrol);
		return;
	}

	// Move towards target if out of attack range
	if (!IsTargetInRange(AttackRange))
	{
		SetState(EEnemyAIState::Chase);
		return;
	}

	// Face target
	AActor* Owner = GetOwner();
	if (Owner)
	{
		FVector LookDirection = TargetActor->GetActorLocation() - Owner->GetActorLocation();
		FRotator LookRotation = LookDirection.Rotation();
		Owner->SetActorRotation(LookRotation);
	}

	// Attack cooldown
	AttackTimer += DeltaTime;
	if (AttackTimer >= AttackCooldown)
	{
		AttackTimer = 0.0f;
		// Attack logic triggered here — actual damage applied by game code
	}
}

void UEnemyAIController::TickFlee(float DeltaTime)
{
	if (!HasTarget() || !TargetActor->IsValidLowLevel())
	{
		SetState(EEnemyAIState::Patrol);
		return;
	}

	// Move away from target
	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	FVector CurrentLocation = Owner->GetActorLocation();
	FVector TargetLocation = TargetActor->GetActorLocation();
	FVector AwayDirection = (CurrentLocation - TargetLocation).GetSafeNormal();

	FVector NewLocation = CurrentLocation + AwayDirection * ChaseSpeed * DeltaTime;
	Owner->SetActorLocation(NewLocation);

	// Face away from target
	FRotator AwayRotation = AwayDirection.Rotation();
	Owner->SetActorRotation(AwayRotation);

	// If far enough, return to patrol
	if (!IsTargetInRange(DetectionRange * 1.5f))
	{
		ClearTarget();
		SetState(EEnemyAIState::Patrol);
	}
}

float UEnemyAIController::DistanceToTarget() const
{
	AActor* Owner = GetOwner();
	if (!Owner || !TargetActor)
	{
		return MAX_FLT;
	}

	return FVector::Dist(Owner->GetActorLocation(), TargetActor->GetActorLocation());
}

bool UEnemyAIController::IsTargetInRange(float Range) const
{
	return DistanceToTarget() <= Range;
}

void UEnemyAIController::OnSightUpdated(AActor* Actor, bool bCanSee)
{
	if (CurrentState == EEnemyAIState::Dead)
	{
		return;
	}

	if (bCanSee && Actor && Actor != GetOwner())
	{
		SetTargetActor(Actor);

		if (CurrentState == EEnemyAIState::Idle || CurrentState == EEnemyAIState::Patrol)
		{
			SetState(EEnemyAIState::Alert);
		}
	}
	else if (!bCanSee && Actor == TargetActor)
	{
		// Lost sight — keep chasing briefly then lose target
		if (CurrentState == EEnemyAIState::Chase)
		{
			// Continue chase for a bit
		}
		else
		{
			ClearTarget();
			SetState(EEnemyAIState::Patrol);
		}
	}
}
