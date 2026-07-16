#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UProceduralCorridorComponent.generated.h"

class AStaticMeshActor;
class UBoxComponent;

USTRUCT(BlueprintType)
struct FProceduralCorridor
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString CorridorName;

    UPROPERTY(BlueprintReadOnly)
    FString FromRoom;

    UPROPERTY(BlueprintReadOnly)
    FString ToRoom;

    UPROPERTY(BlueprintReadOnly)
    float Width = 300.0f;

    UPROPERTY(BlueprintReadOnly)
    FString CorridorType;

    UPROPERTY(BlueprintReadOnly)
    FString Style;

    UPROPERTY(BlueprintReadOnly)
    AActor* CorridorMeshActor = nullptr;

    UPROPERTY(BlueprintReadOnly)
    TArray<AActor*> TriggerVolumes;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UProceduralCorridorComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UProceduralCorridorComponent();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Corridor")
    FString CreateCorridor(const FString& From, const FString& To, float Width, const FString& Type);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Corridor")
    bool DeleteCorridor(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Corridor")
    TArray<FString> ListCorridors();

    UFUNCTION(BlueprintCallable, Category = "Procedural|Corridor")
    bool ResizeCorridor(const FString& Name, float Width);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Corridor")
    bool SetStyle(const FString& Name, const FString& Style);

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Procedural|Corridor")
    TArray<FProceduralCorridor> Corridors;

private:
    int32 FindCorridorIndex(const FString& Name) const;
};
