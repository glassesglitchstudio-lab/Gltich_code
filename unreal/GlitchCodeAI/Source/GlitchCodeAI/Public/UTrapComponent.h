#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/BoxComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundCue.h"
#include "Particles/ParticleSystemComponent.h"
#include "UTrapComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnTrapTriggered, AActor*, TrapActor, AActor*, TriggeredBy);

USTRUCT(BlueprintType)
struct FTrapData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap")
	FString TrapName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap")
	FString TrapType;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap")
	float Damage = 10.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Trap")
	bool bArmed = false;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Trap")
	bool bTriggered = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap")
	float RadialDamageRadius = 300.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Trap")
	AActor* TrapActor = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Trap")
	UBoxComponent* TriggerVolume = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Trap")
	UStaticMeshComponent* TrapVisualMesh = nullptr;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UTrapComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "Trap")
	FOnTrapTriggered OnTrapTriggered;

	UTrapComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Trap")
	FString PlaceTrap(const FString& Type, float Damage, const FVector& Location);

	UFUNCTION(BlueprintCallable, Category = "Trap")
	bool ArmTrap(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Trap")
	bool DisarmTrap(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Trap")
	bool TriggerTrap(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Trap")
	bool RemoveTrap(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Trap")
	TArray<FString> ListTraps() const;

	UFUNCTION(BlueprintPure, Category = "Trap")
	bool IsArmed(const FString& Name) const;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Config")
	float DefaultDamageRadius = 300.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Config")
	float TrapFallOff = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Effects")
	UStaticMesh* TrapMesh = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Effects")
	USoundCue* TriggerSound = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Effects")
	USoundCue* ActivateSound = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Effects")
	UParticleSystem* TrapParticle = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Trap|Config")
	TSubclassOf<UDamageType> DamageTypeClass;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Trap|State")
	TArray<FTrapData> Traps;

private:
	int32 FindTrapIndex(const FString& Name) const;
	AActor* SpawnTrapActor(const FVector& Location, const FString& Type);
	void OnTrapOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);
	void PlayTrapEffects(const FVector& Location);
};
