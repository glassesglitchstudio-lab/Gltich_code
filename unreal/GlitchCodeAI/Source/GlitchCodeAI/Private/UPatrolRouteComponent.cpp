#include "UPatrolRouteComponent.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"
#include "DrawDebugHelpers.h"

UPatrolRouteComponent::UPatrolRouteComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.02f;
}

void UPatrolRouteComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UPatrolRouteComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!bIsPatrolling || PatrolPoints.Num() == 0 || bPatrolComplete)
	{
		return;
	}

	// Handle wait timer
	if (bIsWaiting)
	{
		HandleWaitTimer(DeltaTime);
		return;
	}

	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	FVector CurrentLocation = Owner->GetActorLocation();
	const FPatrolPoint& TargetPoint = PatrolPoints[CurrentPointIndex];
	FVector TargetLocation = TargetPoint.Location;

	// Check if reached
	float Distance = FVector::Dist(CurrentLocation, TargetLocation);
	if (Distance <= AcceptanceRadius)
	{
		OnPatrolPointReached.Broadcast(CurrentPointIndex);

		// Start wait if configured
		if (TargetPoint.WaitTime > 0.0f)
		{
			bIsWaiting = true;
			WaitTimer = TargetPoint.WaitTime;
			return;
		}

		AdvanceToNextPoint();
		return;
	}

	// Move towards target
	FVector Direction = (TargetLocation - CurrentLocation).GetSafeNormal();
	FVector NewLocation = CurrentLocation + Direction * MovementSpeed * DeltaTime;
	Owner->SetActorLocation(NewLocation);

	// Face movement direction
	FRotator TargetRotation = Direction.Rotation();
	Owner->SetActorRotation(TargetRotation);

	// Debug path
	if (bDrawDebugPath)
	{
		DrawDebugLine(GetWorld(), CurrentLocation, TargetLocation, FColor::Green, false, -1.0f, 0, 2.0f);
		DrawDebugSphere(GetWorld(), TargetLocation, 30.0f, 8, FColor::Yellow, false, -1.0f);
	}
}

void UPatrolRouteComponent::AddPatrolPoint(FVector Location, float WaitTime, const FString& Label)
{
	FPatrolPoint Point;
	Point.Location = Location;
	Point.WaitTime = WaitTime;
	Point.Label = Label;
	Point.bIsEnabled = true;
	PatrolPoints.Add(Point);
}

void UPatrolRouteComponent::AddPatrolPointStruct(const FPatrolPoint& Point)
{
	PatrolPoints.Add(Point);
}

void UPatrolRouteComponent::RemovePatrolPoint(int32 Index)
{
	if (PatrolPoints.IsValidIndex(Index))
	{
		PatrolPoints.RemoveAt(Index);

		if (CurrentPointIndex >= PatrolPoints.Num())
		{
			CurrentPointIndex = FMath::Max(0, PatrolPoints.Num() - 1);
		}
	}
}

void UPatrolRouteComponent::ClearPatrolPoints()
{
	PatrolPoints.Empty();
	CurrentPointIndex = 0;
	bIsPatrolling = false;
	bPatrolComplete = false;
}

void UPatrolRouteComponent::SetPatrolPointEnabled(int32 Index, bool bEnabled)
{
	if (PatrolPoints.IsValidIndex(Index))
	{
		PatrolPoints[Index].bIsEnabled = bEnabled;
	}
}

FVector UPatrolRouteComponent::GetNextPoint()
{
	if (PatrolPoints.Num() == 0)
	{
		return FVector::ZeroVector;
	}

	int32 NextIndex = CurrentPointIndex;

	switch (PatrolType)
	{
	case EPatrolType::Loop:
		NextIndex = (CurrentPointIndex + 1) % PatrolPoints.Num();
		break;
	case EPatrolType::PingPong:
		NextIndex = CurrentPointIndex + PingPongDirection;
		if (NextIndex >= PatrolPoints.Num() || NextIndex < 0)
		{
			PingPongDirection *= -1;
			NextIndex = CurrentPointIndex + PingPongDirection;
		}
		break;
	case EPatrolType::Random:
		if (PatrolPoints.Num() > 1)
		{
			do
			{
				NextIndex = FMath::RandRange(0, PatrolPoints.Num() - 1);
			} while (NextIndex == CurrentPointIndex);
		}
		break;
	case EPatrolType::Once:
		NextIndex = CurrentPointIndex + 1;
		if (NextIndex >= PatrolPoints.Num())
		{
			return PatrolPoints[CurrentPointIndex].Location;
		}
		break;
	}

	return PatrolPoints.IsValidIndex(NextIndex) ? PatrolPoints[NextIndex].Location : FVector::ZeroVector;
}

FVector UPatrolRouteComponent::GetPreviousPoint()
{
	if (PatrolPoints.Num() == 0)
	{
		return FVector::ZeroVector;
	}

	int32 PrevIndex = (CurrentPointIndex - 1 + PatrolPoints.Num()) % PatrolPoints.Num();
	return PatrolPoints[PrevIndex].Location;
}

FVector UPatrolRouteComponent::GetCurrentPoint() const
{
	if (PatrolPoints.IsValidIndex(CurrentPointIndex))
	{
		return PatrolPoints[CurrentPointIndex].Location;
	}
	return FVector::ZeroVector;
}

void UPatrolRouteComponent::SetPatrolType(EPatrolType NewType)
{
	PatrolType = NewType;
	PingPongDirection = 1;
}

void UPatrolRouteComponent::SetMovementSpeed(float NewSpeed)
{
	MovementSpeed = FMath::Max(0.0f, NewSpeed);
}

void UPatrolRouteComponent::StartPatrol()
{
	if (PatrolPoints.Num() == 0)
	{
		return;
	}

	bIsPatrolling = true;
	bPatrolComplete = false;
	CurrentPointIndex = 0;
	PingPongDirection = 1;
	bIsWaiting = false;
}

void UPatrolRouteComponent::StopPatrol()
{
	bIsPatrolling = false;
	bIsWaiting = false;
}

void UPatrolRouteComponent::AdvanceToNextPoint()
{
	switch (PatrolType)
	{
	case EPatrolType::Loop:
		CurrentPointIndex = (CurrentPointIndex + 1) % PatrolPoints.Num();
		break;
	case EPatrolType::PingPong:
		CurrentPointIndex += PingPongDirection;
		if (CurrentPointIndex >= PatrolPoints.Num() - 1 || CurrentPointIndex <= 0)
		{
			PingPongDirection *= -1;
		}
		CurrentPointIndex = FMath::Clamp(CurrentPointIndex, 0, PatrolPoints.Num() - 1);
		break;
	case EPatrolType::Random:
		if (PatrolPoints.Num() > 1)
		{
			int32 NewIndex;
			do
			{
				NewIndex = FMath::RandRange(0, PatrolPoints.Num() - 1);
			} while (NewIndex == CurrentPointIndex);
			CurrentPointIndex = NewIndex;
		}
		break;
	case EPatrolType::Once:
		CurrentPointIndex++;
		if (CurrentPointIndex >= PatrolPoints.Num())
		{
			CurrentPointIndex = PatrolPoints.Num() - 1;
			bPatrolComplete = true;
			bIsPatrolling = false;
			OnPatrolCompleted.Broadcast();
			return;
		}
		break;
	}
}

void UPatrolRouteComponent::HandleWaitTimer(float DeltaTime)
{
	WaitTimer -= DeltaTime;
	if (WaitTimer <= 0.0f)
	{
		bIsWaiting = false;
		AdvanceToNextPoint();
	}
}
