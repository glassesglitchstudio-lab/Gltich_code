#include "UPuzzleComponent.h"
#include "Engine/World.h"
#include "Kismet/KismetSystemLibrary.h"
#include "TimerManager.h"

UPuzzleComponent::UPuzzleComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.1f;
}

void UPuzzleComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UPuzzleComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	for (FPuzzleData& Puzzle : Puzzles)
	{
		if (Puzzle.bSolved) continue;

		for (FPuzzlePiece& Piece : Puzzle.Pieces)
		{
			if (Piece.bIsInPosition || !Piece.PieceActor) continue;

			Piece.bIsInPosition = CheckPiecePosition(Piece, Puzzle.PositionTolerance, Puzzle.RotationTolerance);
		}

		bool bAllInPosition = true;
		for (const FPuzzlePiece& Piece : Puzzle.Pieces)
		{
			if (!Piece.bIsInPosition)
			{
				bAllInPosition = false;
				break;
			}
		}

		if (bAllInPosition && Puzzle.Pieces.Num() > 0)
		{
			Puzzle.bSolved = true;
			UE_LOG(LogTemp, Log, TEXT("Puzzle: '%s' auto-solved!"), *Puzzle.PuzzleName);
		}
	}
}

int32 UPuzzleComponent::FindPuzzleIndex(const FString& Name) const
{
	for (int32 i = 0; i < Puzzles.Num(); ++i)
	{
		if (Puzzles[i].PuzzleName == Name) return i;
	}
	return INDEX_NONE;
}

bool UPuzzleComponent::CheckPiecePosition(const FPuzzlePiece& Piece, float Tolerance, const FRotator& RotTolerance) const
{
	if (!Piece.PieceActor) return false;

	const FVector CurrentLocation = Piece.PieceActor->GetActorLocation();
	const FVector TargetLocation = Piece.CorrectTransform.GetLocation();
	const float Distance = FVector::Dist(CurrentLocation, TargetLocation);

	if (Distance > Tolerance) return false;

	const FRotator CurrentRotation = Piece.PieceActor->GetActorRotation();
	const FRotator TargetRotation = Piece.CorrectTransform.GetRotation().Rotator();

	const float RollDiff = FMath::Abs(FMath::FindDeltaAngleDegrees(CurrentRotation.Roll, TargetRotation.Roll));
	const float PitchDiff = FMath::Abs(FMath::FindDeltaAngleDegrees(CurrentRotation.Pitch, TargetRotation.Pitch));
	const float YawDiff = FMath::Abs(FMath::FindDeltaAngleDegrees(CurrentRotation.Yaw, TargetRotation.Yaw));

	if (RollDiff > RotTolerance.Roll || PitchDiff > RotTolerance.Pitch || YawDiff > RotTolerance.Yaw)
	{
		return false;
	}

	return true;
}

FString UPuzzleComponent::CreatePuzzle(const FString& Type, int32 Difficulty)
{
	FString NewName = FString::Printf(TEXT("Puzzle_%s_%d"), *Type, Puzzles.Num());

	FPuzzleData NewPuzzle;
	NewPuzzle.PuzzleName = NewName;
	NewPuzzle.PuzzleType = Type;
	NewPuzzle.Difficulty = FMath::Clamp(Difficulty, 1, 10);
	NewPuzzle.PositionTolerance = PositionTolerance;
	NewPuzzle.RotationTolerance = RotationTolerance;

	Puzzles.Add(NewPuzzle);

	UE_LOG(LogTemp, Log, TEXT("Puzzle: Created '%s' type='%s' difficulty=%d"), *NewName, *Type, Difficulty);
	return NewName;
}

AStaticMeshActor* UPuzzleComponent::SpawnPuzzlePiece(const FString& PuzzleName, UStaticMesh* Mesh, const FTransform& SpawnTransform, const FTransform& CorrectTransform)
{
	int32 Index = FindPuzzleIndex(PuzzleName);
	if (Index == INDEX_NONE || !Mesh)
	{
		UE_LOG(LogTemp, Warning, TEXT("Puzzle: Cannot spawn piece for '%s'"), *PuzzleName);
		return nullptr;
	}

	UWorld* World = GetWorld();
	if (!World) return nullptr;

	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

	AStaticMeshActor* PieceActor = World->SpawnActor<AStaticMeshActor>(
		AStaticMeshActor::StaticClass(),
		SpawnTransform,
		SpawnParams
	);

	if (PieceActor)
	{
		PieceActor->GetStaticMeshComponent()->SetStaticMesh(Mesh);
		PieceActor->GetStaticMeshComponent()->SetSimulatePhysics(true);
		PieceActor->GetStaticMeshComponent()->SetCollisionProfileName(TEXT("PhysicsActor"));
		PieceActor->SetMobility(EComponentMobility::Movable);

		FPuzzlePiece NewPiece;
		NewPiece.PieceActor = PieceActor;
		NewPiece.CorrectTransform = CorrectTransform;
		NewPiece.bIsInPosition = false;

		Puzzles[Index].Pieces.Add(NewPiece);

		UE_LOG(LogTemp, Log, TEXT("Puzzle: Spawned piece for '%s' at %s"),
			*PuzzleName, *SpawnTransform.GetLocation().ToString());
	}

	return PieceActor;
}

void UPuzzleComponent::AddPhysicsConstraint(const FString& PuzzleName, AActor* Actor1, AActor* Actor2)
{
	int32 Index = FindPuzzleIndex(PuzzleName);
	if (Index == INDEX_NONE) return;

	if (!Actor1 || !Actor2) return;

	UWorld* World = GetWorld();
	if (!World) return;

	UPhysicsConstraintComponent* Constraint = NewObject<UPhysicsConstraintComponent>(this);
	Constraint->RegisterComponent();
	Constraint->AttachToComponent(Actor1->GetRootComponent(), FAttachmentTransformRules::KeepWorldTransform);

	Constraint->SetConstrainedComponents(
		Cast<UPrimitiveComponent>(Actor1->GetRootComponent()),
		NAME_None,
		Cast<UPrimitiveComponent>(Actor2->GetRootComponent()),
		NAME_None
	);

	Constraint->SetLinearXLimit(ELinearConstraintMotion::LCM_Free, 0.0f);
	Constraint->SetLinearYLimit(ELinearConstraintMotion::LCM_Free, 0.0f);
	Constraint->SetLinearZLimit(ELinearConstraintMotion::LCM_Free, 0.0f);

	Constraint->SetAngularSwing1Limit(EAngularConstraintMotion::ACM_Free, 0.0f);
	Constraint->SetAngularSwing2Limit(EAngularConstraintMotion::ACM_Free, 0.0f);
	Constraint->SetAngularTwistLimit(EAngularConstraintMotion::ACM_Free, 0.0f);

	Puzzles[Index].Constraints.Add(Constraint);

	UE_LOG(LogTemp, Log, TEXT("Puzzle: Added constraint to '%s' between '%s' and '%s'"),
		*PuzzleName, *Actor1->GetName(), *Actor2->GetName());
}

bool UPuzzleComponent::SolvePuzzle(const FString& Name)
{
	int32 Index = FindPuzzleIndex(Name);
	if (Index == INDEX_NONE) return false;

	Puzzles[Index].bSolved = true;

	for (FPuzzlePiece& Piece : Puzzles[Index].Pieces)
	{
		if (Piece.PieceActor)
		{
			Piece.PieceActor->GetStaticMeshComponent()->SetSimulatePhysics(false);
			Piece.PieceActor->SetActorTransform(Piece.CorrectTransform);
			Piece.bIsInPosition = true;
		}
	}

	for (UPhysicsConstraintComponent* Constraint : Puzzles[Index].Constraints)
	{
		if (Constraint)
		{
			Constraint->DestroyComponent();
		}
	}
	Puzzles[Index].Constraints.Empty();

	UE_LOG(LogTemp, Log, TEXT("Puzzle: Solved '%s'"), *Name);
	return true;
}

bool UPuzzleComponent::ResetPuzzle(const FString& Name)
{
	int32 Index = FindPuzzleIndex(Name);
	if (Index == INDEX_NONE) return false;

	Puzzles[Index].bSolved = false;

	for (FPuzzlePiece& Piece : Puzzles[Index].Pieces)
	{
		if (Piece.PieceActor)
		{
			Piece.PieceActor->SetActorTransform(Piece.CorrectTransform);
			Piece.PieceActor->GetStaticMeshComponent()->SetSimulatePhysics(true);
			Piece.PieceActor->GetStaticMeshComponent()->SetPhysicsLinearVelocity(FVector::ZeroVector);
			Piece.PieceActor->GetStaticMeshComponent()->SetPhysicsAngularVelocityInDegrees(FVector::ZeroVector);
			Piece.bIsInPosition = false;
		}
	}

	UE_LOG(LogTemp, Log, TEXT("Puzzle: Reset '%s'"), *Name);
	return true;
}

bool UPuzzleComponent::IsSolved(const FString& Name) const
{
	int32 Index = FindPuzzleIndex(Name);
	if (Index == INDEX_NONE) return false;
	return Puzzles[Index].bSolved;
}

float UPuzzleComponent::GetCompletionPercentage(const FString& Name) const
{
	int32 Index = FindPuzzleIndex(Name);
	if (Index == INDEX_NONE) return 0.0f;

	const FPuzzleData& Puzzle = Puzzles[Index];
	if (Puzzle.Pieces.Num() == 0) return 0.0f;

	int32 InPositionCount = 0;
	for (const FPuzzlePiece& Piece : Puzzle.Pieces)
	{
		if (Piece.bIsInPosition) InPositionCount++;
	}

	return (static_cast<float>(InPositionCount) / static_cast<float>(Puzzle.Pieces.Num())) * 100.0f;
}
