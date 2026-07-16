#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UProceduralSpawnComponent.generated.h"

class AStaticMeshActor;
class USphereComponent;
class UBillboardComponent;

UCLASS(BlueprintType, Blueprintable)
class GLITCHCODEAI_API ASpawnPointMarker : public AActor
{
    GENERATED_BODY()

public:
    ASpawnPointMarker();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Spawn")
    USphereComponent* TriggerVolume;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Spawn")
    UStaticMeshComponent* MarkerMesh;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Spawn")
    UBillboardComponent* Billboard;

    UFUNCTION()
    void OnOverlapBegin(UPrimitiveComponent* OverlappedComp, AActor* OtherActor,
        UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);
};

USTRUCT(BlueprintType)
struct FSpawnPoint
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString SpawnName;

    UPROPERTY(BlueprintReadOnly)
    FString SpawnType;

    UPROPERTY(BlueprintReadOnly)
    FVector Location;

    UPROPERTY(BlueprintReadOnly)
    AActor* SpawnMarker = nullptr;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnSpawnPointActivated, const FString&, SpawnName, AActor*, OverlappedActor);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UProceduralSpawnComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UProceduralSpawnComponent();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Spawn")
    FString CreateSpawnPoint(const FString& Type, const FVector& Location);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Spawn")
    bool RemoveSpawnPoint(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Spawn")
    TArray<FString> ListSpawnPoints();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Spawn")
    bool SetSpawnPoint(const FString& Name, const FVector& Location);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Spawn")
    void ClearAllSpawnPoints();

    UPROPERTY(BlueprintAssignable, Category = "Procedural|Spawn|Events")
    FOnSpawnPointActivated OnSpawnPointActivated;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Procedural|Spawn")
    TArray<FSpawnPoint> SpawnPoints;

private:
    int32 FindSpawnIndex(const FString& Name) const;
};
