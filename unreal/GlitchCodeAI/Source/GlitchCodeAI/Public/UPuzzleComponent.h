#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/BoxComponent.h"
#include "Engine/StaticMeshActor.h"
#include "PhysicsEngine/PhysicsConstraintComponent.h"
#include "UPuzzleComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPuzzleSolved, const FString&, PuzzleName);

USTRUCT(BlueprintType)
struct FPuzzlePiece
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	AStaticMeshActor* PieceActor = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	FTransform CorrectTransform;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Puzzle")
	bool bIsInPosition = false;
};

USTRUCT(BlueprintType)
struct FPuzzleData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	FString PuzzleName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	FString PuzzleType;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	int32 Difficulty = 1;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Puzzle")
	bool bSolved = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	TArray<FPuzzlePiece> Pieces;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	TArray<UPhysicsConstraintComponent*> Constraints;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	float PositionTolerance = 50.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle")
	FRotator RotationTolerance = FRotator(10.0f, 10.0f, 10.0f);
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UPuzzleComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "Puzzle")
	FOnPuzzleSolved OnPuzzleSolved;

	UPuzzleComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Puzzle")
	FString CreatePuzzle(const FString& Type, int32 Difficulty);

	UFUNCTION(BlueprintCallable, Category = "Puzzle")
	bool SolvePuzzle(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Puzzle")
	bool ResetPuzzle(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Puzzle")
	AStaticMeshActor* SpawnPuzzlePiece(const FString& PuzzleName, UStaticMesh* Mesh, const FTransform& SpawnTransform, const FTransform& CorrectTransform);

	UFUNCTION(BlueprintCallable, Category = "Puzzle")
	void AddPhysicsConstraint(const FString& PuzzleName, AActor* Actor1, AActor* Actor2);

	UFUNCTION(BlueprintPure, Category = "Puzzle")
	bool IsSolved(const FString& Name) const;

	UFUNCTION(BlueprintPure, Category = "Puzzle")
	float GetCompletionPercentage(const FString& Name) const;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle|Config")
	float PositionTolerance = 50.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Puzzle|Config")
	FRotator RotationTolerance = FRotator(10.0f, 10.0f, 10.0f);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Puzzle|State")
	TArray<FPuzzleData> Puzzles;

private:
	int32 FindPuzzleIndex(const FString& Name) const;
	bool CheckPiecePosition(const FPuzzlePiece& Piece, float Tolerance, const FRotator& RotTolerance) const;
};
