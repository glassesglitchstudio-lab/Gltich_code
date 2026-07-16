#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Components/SphereComponent.h"
#include "USoundZoneTrigger.generated.h"

class UAmbientSoundManager;

UCLASS(BlueprintType, Blueprintable)
class GLITCHCODEAI_API AUSoundZoneTrigger : public AActor
{
    GENERATED_BODY()

public:
    AUSoundZoneTrigger();

    virtual void BeginPlay() override;

    // Zone Settings
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    FString ZoneName = TEXT("DefaultZone");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    FString AmbientSoundPath;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    FString ExitSoundPath;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    float FadeInDuration = 1.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    float FadeOutDuration = 2.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    float ZoneVolume = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    bool bRegisterAsSoundZone = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sound Zone")
    float SoundZoneRadius = 0.0f;

    // Visual
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Sound Zone")
    USphereComponent* TriggerVolume;

    // Events
    UFUNCTION(BlueprintImplementableEvent, Category = "Sound Zone")
    void OnPlayerEnteredZone(const FString& ZoneName);

    UFUNCTION(BlueprintImplementableEvent, Category = "Sound Zone")
    void OnPlayerExitedZone(const FString& ZoneName);

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
    int32 RegisteredZoneID = -1;

    UPROPERTY()
    int32 ActiveSoundID = -1;

    UPROPERTY()
    bool bPlayerInside = false;

    UPROPERTY()
    UAmbientSoundManager* CachedSoundManager;
};
