#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UHorrorAtmosphereComponent.generated.h"

class UNiagaraSystem;
class USoundBase;
class UAudioComponent;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class ACharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSanityChanged, float, NewSanity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnHorrorEventTriggered);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHallucinationStarted, AActor*, FakeActor);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UHorrorAtmosphereComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHorrorAtmosphereComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "VFX|Horror")
    void SetAmbientFear(float Intensity);

    UFUNCTION(BlueprintCallable, Category = "VFX|Horror")
    void TriggerHorrorEvent();

    UFUNCTION(BlueprintCallable, Category = "VFX|Horror")
    void SetSanity(float Value);

    UFUNCTION(BlueprintCallable, Category = "VFX|Horror")
    void DrainSanity(float Rate);

    UFUNCTION(BlueprintCallable, Category = "VFX|Horror")
    void TriggerHallucination();

    UFUNCTION(BlueprintCallable, Category = "VFX|Horror")
    void StopDrainSanity();

    UPROPERTY(BlueprintAssignable, Category = "VFX|Horror")
    FOnSanityChanged OnSanityChanged;

    UPROPERTY(BlueprintAssignable, Category = "VFX|Horror")
    FOnHorrorEventTriggered OnHorrorEventTriggered;

    UPROPERTY(BlueprintAssignable, Category = "VFX|Horror")
    FOnHallucinationStarted OnHallucinationStarted;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|Assets")
    USoundBase* JumpScareSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|Assets")
    USoundBase* DistantScreamSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|Assets")
    USoundBase* AmbientHorrorLoop;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|Assets")
    UMaterialInterface* SanityPostProcessMaterial;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|Assets")
    TSubclassOf<ACharacter> HallucinationEnemyClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|Assets")
    UAnimMontage* HorrorIdleMontage;

    // State
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Horror|State")
    float SanityLevel = 100.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Horror|State")
    float MaxSanity = 100.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Horror|State")
    float SanityDrainRate = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Horror|State")
    float CurrentAmbientFear = 0.0f;

private:
    FTimerHandle SanityDrainTimer;
    FTimerHandle HallucinationTimer;

    UPROPERTY()
    UAudioComponent* ActiveAmbientAudio;

    UPROPERTY()
    UMaterialInstanceDynamic* ActiveSanityMaterial;

    UPROPERTY()
    TArray<AActor*> HallucinationActors;

    void OnSanityDrainTick();
    void ApplySanityEffects(float SanityRatio);
    void SpawnHallucinationEnemy();
    void ClearHallucinations();
};
