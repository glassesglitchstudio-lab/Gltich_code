#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UProceduralPropsComponent.generated.h"

class AStaticMeshActor;
class UStaticMesh;

USTRUCT(BlueprintType)
struct FPropInstance
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString PropCategory;

    UPROPERTY(BlueprintReadOnly)
    FString ParentRoom;

    UPROPERTY(BlueprintReadOnly)
    FVector Location;

    UPROPERTY(BlueprintReadOnly)
    FRotator Rotation;

    UPROPERTY(BlueprintReadOnly)
    AActor* SpawnedActor = nullptr;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UProceduralPropsComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UProceduralPropsComponent();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Props")
    int32 ScatterProps(const FString& Category, const FVector& RoomOrigin, float RoomWidth, float RoomDepth, int32 Seed);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Props")
    bool ClearProps(const FString& Room);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Props")
    TArray<FPropInstance> ListProps();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Props")
    void SetDensity(const FString& Category, float NewDensity);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Props")
    void SetSeed(int32 Seed);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Props")
    TArray<UStaticMesh*> PropMeshPool;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Procedural|Props")
    TArray<FPropInstance> Props;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Props")
    int32 CurrentSeed = 12345;

private:
    TMap<FString, float> CategoryDensity;
};
