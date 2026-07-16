#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Components/BoxComponent.h"
#include "USaveTrigger.generated.h"

class USaveManager;

UCLASS(BlueprintType, Blueprintable)
class GLITCHCODEAI_API AUSaveTrigger : public AActor
{
    GENERATED_BODY()

public:
    AUSaveTrigger();

    virtual void BeginPlay() override;

    // Checkpoint settings
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save Trigger")
    FString CheckpointName = TEXT("Checkpoint");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save Trigger")
    int32 CheckpointIndex = 50;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save Trigger")
    bool bAutoSaveOnOverlap = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save Trigger")
    bool bShowNotification = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Save Trigger")
    float NotificationDuration = 3.0f;

    // Visual feedback
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Save Trigger")
    UBoxComponent* TriggerVolume;

    UFUNCTION(BlueprintImplementableEvent, Category = "Save Trigger")
    void OnCheckpointReached(const FString& SlotName, int32 SlotIndex);

    UFUNCTION(BlueprintImplementableEvent, Category = "Save Trigger")
    void OnSaveNotification(const FString& Message);

protected:
    UFUNCTION()
    void OnOverlapBegin(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex,
        bool bFromSweep,
        const FHitResult& SweepResult
    );

    UFUNCTION()
    void OnOverlapEnd(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex
    );

private:
    UPROPERTY()
    bool bHasTriggeredThisSession = false;

    UPROPERTY()
    USaveManager* CachedSaveManager;
};
