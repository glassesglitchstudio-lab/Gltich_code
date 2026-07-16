#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UAIPerceptionComponent.generated.h"

UENUM(BlueprintType)
enum class EAISenseType : uint8
{
	Sight       UMETA(DisplayName = "Sight"),
	Hearing     UMETA(DisplayName = "Hearing"),
	Damage      UMETA(DisplayName = "Damage"),
	Custom      UMETA(DisplayName = "Custom"),
};

USTRUCT(BlueprintType)
struct FActorPerceptionData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	AActor* Actor = nullptr;

	UPROPERTY(BlueprintReadOnly)
	bool bCanSee = false;

	UPROPERTY(BlueprintReadOnly)
	bool bCanHear = false;

	UPROPERTY(BlueprintReadOnly)
	float LastSightTime = 0.0f;

	UPROPERTY(BlueprintReadOnly)
	float LastHearingTime = 0.0f;

	UPROPERTY(BlueprintReadOnly)
	FVector LastSeenLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly)
	FVector LastHeardLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly)
	float Distance = 0.0f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnSightUpdated, AActor*, Actor, bool, bCanSee);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHearingUpdated, AActor*, Actor, bool, bCanHear);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAIPerceptionComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAIPerceptionComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Configuration
	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	void SetSightRange(float NewRange);

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	void SetHearingRange(float NewRange);

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	void SetSenseType(EAISenseType NewType);

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	void SetSightAngle(float NewAngle);

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	void SetMemoryDuration(float NewDuration);

	// Perception Queries
	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	bool CanSeeActor(AActor* Target) const;

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	bool CanHearActor(AActor* Target) const;

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	AActor* GetClosestVisibleActor(const TArray<AActor*>& Candidates) const;

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	TArray<AActor*> GetAllVisibleActors() const;

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	TArray<AActor*> GetAllHeardActors() const;

	UFUNCTION(BlueprintCallable, Category = "AI Perception")
	FActorPerceptionData GetPerceptionData(AActor* Actor) const;

	// Events
	UPROPERTY(BlueprintAssignable, Category = "AI Perception")
	FOnSightUpdated OnSightUpdated;

	UPROPERTY(BlueprintAssignable, Category = "AI Perception")
	FOnHearingUpdated OnHearingUpdated;

	// Properties
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AI Perception")
	float SightRange = 2000.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AI Perception")
	float HearingRange = 1500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AI Perception")
	float SightAngle = 90.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AI Perception")
	float MemoryDuration = 10.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AI Perception")
	EAISenseType ActiveSenseType = EAISenseType::Sight;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TMap<AActor*, FActorPerceptionData> PerceptionMap;

	bool IsWithinSightCone(AActor* Target, FVector& OutDirection) const;
	bool LineOfSightCheck(AActor* Target) const;
	float CalculateDistance(AActor* Target) const;
	void UpdatePerceptionForActor(AActor* Actor, float DeltaTime);
	void CleanupExpiredEntries(float DeltaTime);
};
