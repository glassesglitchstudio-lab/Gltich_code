#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UProceduralDoorComponent.generated.h"

class AStaticMeshActor;
class UBoxComponent;
class USoundBase;

UENUM(BlueprintType)
enum class EProceduralDoorType : uint8
{
    Wooden,
    Metal,
    Glass
};

USTRUCT(BlueprintType)
struct FProceduralDoor
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString DoorName;

    UPROPERTY(BlueprintReadOnly)
    EProceduralDoorType DoorType = EProceduralDoorType::Wooden;

    UPROPERTY(BlueprintReadOnly)
    FVector Location;

    UPROPERTY(BlueprintReadOnly)
    bool bLocked = false;

    UPROPERTY(BlueprintReadOnly)
    AActor* DoorFrameActor = nullptr;

    UPROPERTY(BlueprintReadOnly)
    AActor* DoorMeshActor = nullptr;

    UPROPERTY(BlueprintReadOnly)
    AActor* InteractionTrigger = nullptr;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UProceduralDoorComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UProceduralDoorComponent();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Door")
    FString PlaceDoor(EProceduralDoorType DoorType, const FVector& Location);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Door")
    bool RemoveDoor(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Door")
    TArray<FString> ListDoors();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Door")
    bool LockDoor(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Door")
    bool UnlockDoor(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Door")
    bool SetType(const FString& Name, EProceduralDoorType NewType);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Door|Sound")
    USoundBase* LockSound = nullptr;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Door|Sound")
    USoundBase* UnlockSound = nullptr;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Procedural|Door")
    TArray<FProceduralDoor> Doors;

private:
    int32 FindDoorIndex(const FString& Name) const;
    void ApplyDoorType(AStaticMeshActor* DoorMesh, EProceduralDoorType Type);
};
