#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UDarknessComponent.generated.h"

class UNiagaraSystem;
class UNiagaraComponent;
class USoundBase;
class UPointLightComponent;
class UPostProcessComponent;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class USpotLightComponent;

USTRUCT(BlueprintType)
struct FDarknessArea
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString AreaName;

    UPROPERTY(BlueprintReadOnly)
    FVector Center;

    UPROPERTY(BlueprintReadOnly)
    float Radius = 500.0f;

    UPROPERTY(BlueprintReadOnly)
    float DarknessLevel = 1.0f;

    UPROPERTY()
    UPostProcessComponent* PostProcessVolume = nullptr;

    UPROPERTY()
    UExponentialHeightFogComponent* LocalFog = nullptr;
};

USTRUCT(BlueprintType)
struct FFlickerState
{
    GENERATED_BODY()

    UPROPERTY()
    UPointLightComponent* TargetLight = nullptr;

    UPROPERTY()
    float OriginalIntensity = 0.0f;

    UPROPERTY()
    float ElapsedTime = 0.0f;

    UPROPERTY()
    float FlickerDuration = 0.0f;

    UPROPERTY()
    bool bActive = false;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UDarknessComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UDarknessComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "VFX|Darkness")
    void BreakLight(const FString& LightName);

    UFUNCTION(BlueprintCallable, Category = "VFX|Darkness")
    void FlickerLight(const FString& LightName, const FString& Pattern);

    UFUNCTION(BlueprintCallable, Category = "VFX|Darkness")
    void SpawnDarknessArea(const FString& Area, FVector Center, float Radius);

    UFUNCTION(BlueprintCallable, Category = "VFX|Darkness")
    void FlashlightToggle();

    UFUNCTION(BlueprintCallable, Category = "VFX|Darkness")
    void SetDarknessLevel(const FString& Area, float Level);

    UFUNCTION(BlueprintCallable, Category = "VFX|Darkness")
    void RestoreLight(const FString& LightName);

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Darkness|Assets")
    UNiagaraSystem* SparkSystem;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Darkness|Assets")
    USoundBase* BreakSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Darkness|Assets")
    TArray<USoundBase*> FlickerSounds;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Darkness|Assets")
    UMaterialInterface* DarknessPostProcessMaterial;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Darkness|State")
    bool bFlashlightOn = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Darkness|State")
    TMap<FString, float> AreaLevels;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Darkness|State")
    TArray<FDarknessArea> DarknessAreas;

private:
    TArray<FFlickerState> ActiveFlickers;

    void ApplyFlickerPattern(const FString& Pattern, FFlickerState& State, float DeltaTime);
    APointLight* FindLightByName(const FString& LightName) const;
    USpotLightComponent* FindPlayerFlashlight() const;
};
