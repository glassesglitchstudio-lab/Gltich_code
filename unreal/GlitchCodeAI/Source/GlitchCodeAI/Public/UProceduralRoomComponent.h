#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UProceduralRoomComponent.generated.h"

class AStaticMeshActor;
class UBoxComponent;
class UPointLightComponent;
class UStaticMesh;
class UMaterialInterface;

USTRUCT(BlueprintType)
struct FProceduralRoom
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString RoomName;

    UPROPERTY(BlueprintReadOnly)
    FString RoomType;

    UPROPERTY(BlueprintReadOnly)
    FVector Origin;

    UPROPERTY(BlueprintReadOnly)
    float Width = 500.0f;

    UPROPERTY(BlueprintReadOnly)
    float Height = 400.0f;

    UPROPERTY(BlueprintReadOnly)
    float Depth = 500.0f;

    UPROPERTY(BlueprintReadOnly)
    FString Style;

    UPROPERTY(BlueprintReadOnly)
    TArray<AActor*> SpawnedActors;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UProceduralRoomComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UProceduralRoomComponent();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Room")
    FString GenerateRoom(const FString& RoomType, float Width, float Height, float Depth);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Room")
    bool DeleteRoom(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Room")
    TArray<FString> ListRooms();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Room")
    bool ResizeRoom(const FString& Name, float Width, float Height, float Depth);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Room")
    bool DecorateRoom(const FString& Name, const FString& Style);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Room")
    bool ConnectRooms(const FString& Room1, const FString& Room2);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Room|Materials")
    UMaterialInterface* FloorMaterial = nullptr;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Room|Materials")
    UMaterialInterface* WallMaterial = nullptr;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Procedural|Room")
    TArray<FProceduralRoom> Rooms;

private:
    int32 FindRoomIndex(const FString& Name) const;
    AStaticMeshActor* SpawnMeshActor(UWorld* World, const FString& MeshPath, const FVector& Location, const FVector& Scale, const FRotator& Rotation, AActor* Owner);
    void AddBoxCollision(AStaticMeshActor* MeshActor, const FVector& BoxExtent);
};
