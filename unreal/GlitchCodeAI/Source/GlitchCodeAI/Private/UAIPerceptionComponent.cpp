#include "UAIPerceptionComponent.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"
#include "DrawDebugHelpers.h"
#include "Kismet/KismetMathLibrary.h"

UAIPerceptionComponent::UAIPerceptionComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.1f;
}

void UAIPerceptionComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UAIPerceptionComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	// Scan for all actors in range and update perception
	TArray<AActor*> NearbyActors;
	UGameplayStatics::GetAllActorsOfClass(GetWorld(), AActor::StaticClass(), NearbyActors);

	for (AActor* Actor : NearbyActors)
	{
		if (Actor == Owner)
		{
			continue;
		}
		UpdatePerceptionForActor(Actor, DeltaTime);
	}

	CleanupExpiredEntries(DeltaTime);
}

void UAIPerceptionComponent::SetSightRange(float NewRange)
{
	SightRange = FMath::Max(0.0f, NewRange);
}

void UAIPerceptionComponent::SetHearingRange(float NewRange)
{
	HearingRange = FMath::Max(0.0f, NewRange);
}

void UAIPerceptionComponent::SetSenseType(EAISenseType NewType)
{
	ActiveSenseType = NewType;
}

void UAIPerceptionComponent::SetSightAngle(float NewAngle)
{
	SightAngle = FMath::Clamp(NewAngle, 0.0f, 360.0f);
}

void UAIPerceptionComponent::SetMemoryDuration(float NewDuration)
{
	MemoryDuration = FMath::Max(0.0f, NewDuration);
}

bool UAIPerceptionComponent::CanSeeActor(AActor* Target) const
{
	if (!Target)
	{
		return false;
	}

	const FActorPerceptionData* Data = PerceptionMap.Find(Target);
	return Data && Data->bCanSee;
}

bool UAIPerceptionComponent::CanHearActor(AActor* Target) const
{
	if (!Target)
	{
		return false;
	}

	const FActorPerceptionData* Data = PerceptionMap.Find(Target);
	return Data && Data->bCanHear;
}

AActor* UAIPerceptionComponent::GetClosestVisibleActor(const TArray<AActor*>& Candidates) const
{
	AActor* Closest = nullptr;
	float ClosestDist = MAX_FLT;

	for (AActor* Candidate : Candidates)
	{
		if (!Candidate || !CanSeeActor(Candidate))
		{
			continue;
		}

		float Dist = CalculateDistance(Candidate);
		if (Dist < ClosestDist)
		{
			ClosestDist = Dist;
			Closest = Candidate;
		}
	}

	return Closest;
}

TArray<AActor*> UAIPerceptionComponent::GetAllVisibleActors() const
{
	TArray<AActor*> Result;
	for (const auto& Pair : PerceptionMap)
	{
		if (Pair.Value.bCanSee)
		{
			Result.Add(Pair.Key);
		}
	}
	return Result;
}

TArray<AActor*> UAIPerceptionComponent::GetAllHeardActors() const
{
	TArray<AActor*> Result;
	for (const auto& Pair : PerceptionMap)
	{
		if (Pair.Value.bCanHear)
		{
			Result.Add(Pair.Key);
		}
	}
	return Result;
}

FActorPerceptionData UAIPerceptionComponent::GetPerceptionData(AActor* Actor) const
{
	const FActorPerceptionData* Data = PerceptionMap.Find(Actor);
	if (Data)
	{
		return *Data;
	}

	FActorPerceptionData Empty;
	Empty.Actor = Actor;
	return Empty;
}

bool UAIPerceptionComponent::IsWithinSightCone(AActor* Target, FVector& OutDirection) const
{
	AActor* Owner = GetOwner();
	if (!Owner || !Target)
	{
		return false;
	}

	FVector OwnerLocation = Owner->GetActorLocation();
	FVector TargetLocation = Target->GetActorLocation();
	OutDirection = (TargetLocation - OwnerLocation).GetSafeNormal();

	FVector Forward = Owner->GetActorForwardVector();
	float DotProduct = FVector::DotProduct(Forward, OutDirection);
	float ConeHalfAngle = FMath::Cos(FMath::DegreesToRadians(SightAngle * 0.5f));

	return DotProduct >= ConeHalfAngle;
}

bool UAIPerceptionComponent::LineOfSightCheck(AActor* Target) const
{
	AActor* Owner = GetOwner();
	if (!Owner || !Target)
	{
		return false;
	}

	FVector Start = Owner->GetActorLocation();
	FVector End = Target->GetActorLocation();

	FHitResult HitResult;
	FCollisionQueryParams QueryParams;
	QueryParams.AddIgnoredActor(Owner);

	return !GetWorld()->LineTraceSingleByChannel(HitResult, Start, End, ECC_Visibility, QueryParams);
}

float UAIPerceptionComponent::CalculateDistance(AActor* Target) const
{
	AActor* Owner = GetOwner();
	if (!Owner || !Target)
	{
		return MAX_FLT;
	}

	return FVector::Dist(Owner->GetActorLocation(), Target->GetActorLocation());
}

void UAIPerceptionComponent::UpdatePerceptionForActor(AActor* Actor, float DeltaTime)
{
	AActor* Owner = GetOwner();
	if (!Owner || !Actor)
	{
		return;
	}

	float CurrentTime = GetWorld()->GetTimeSeconds();
	float Distance = CalculateDistance(Actor);

	FActorPerceptionData& Data = PerceptionMap.FindOrAdd(Actor);
	FActorPerceptionData OldData = Data;
	Data.Actor = Actor;
	Data.Distance = Distance;

	// Sight check
	bool bWasWithinRange = Distance <= SightRange;
	bool bWithinCone = false;
	FVector DirectionToTarget;
	if (bWasWithinRange)
	{
		bWithinCone = IsWithinSightCone(Actor, DirectionToTarget);
	}
	bool bHasLOS = bWasWithinRange && bWithinCone && LineOfSightCheck(Actor);

	Data.bCanSee = bHasLOS;
	if (bHasLOS)
	{
		Data.LastSightTime = CurrentTime;
		Data.LastSeenLocation = Actor->GetActorLocation();
	}

	// Hearing check
	bool bWithinHearingRange = Distance <= HearingRange;
	Data.bCanHear = bWithinHearingRange;
	if (bWithinHearingRange)
	{
		Data.LastHearingTime = CurrentTime;
		Data.LastHeardLocation = Actor->GetActorLocation();
	}

	// Fire events on state change
	if (OldData.bCanSee != Data.bCanSee)
	{
		OnSightUpdated.Broadcast(Actor, Data.bCanSee);
	}
	if (OldData.bCanHear != Data.bCanHear)
	{
		OnHearingUpdated.Broadcast(Actor, Data.bCanHear);
	}
}

void UAIPerceptionComponent::CleanupExpiredEntries(float DeltaTime)
{
	float CurrentTime = GetWorld()->GetTimeSeconds();
	TArray<AActor*> ToRemove;

	for (auto& Pair : PerceptionMap)
	{
		bool bSightExpired = !Pair.Value.bCanSee && (CurrentTime - Pair.Value.LastSightTime) > MemoryDuration;
		bool bHearingExpired = !Pair.Value.bCanHear && (CurrentTime - Pair.Value.LastHearingTime) > MemoryDuration;

		if (bSightExpired && bHearingExpired)
		{
			ToRemove.Add(Pair.Key);
		}
		else
		{
			if (bSightExpired) Pair.Value.bCanSee = false;
			if (bHearingExpired) Pair.Value.bCanHear = false;
		}
	}

	for (AActor* Actor : ToRemove)
	{
		PerceptionMap.Remove(Actor);
	}
}
