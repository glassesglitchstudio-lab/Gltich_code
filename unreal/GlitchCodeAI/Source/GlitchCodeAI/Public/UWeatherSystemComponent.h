#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UWeatherSystemComponent.generated.h"

class UNiagaraSystem;
class UNiagaraComponent;
class UExponentialHeightFogComponent;
class USoundBase;
class UAudioComponent;

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UWeatherSystemComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UWeatherSystemComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "VFX|Weather")
    void SetRain(float Intensity);

    UFUNCTION(BlueprintCallable, Category = "VFX|Weather")
    void SetSnow(float Intensity);

    UFUNCTION(BlueprintCallable, Category = "VFX|Weather")
    void SetStorm(float Intensity);

    UFUNCTION(BlueprintCallable, Category = "VFX|Weather")
    void SetFog(float Density, const FLinearColor& Color);

    UFUNCTION(BlueprintCallable, Category = "VFX|Weather")
    void ClearWeather();

    UFUNCTION(BlueprintCallable, Category = "VFX|Weather")
    void SetWind(float Speed, const FVector& Direction);

protected:
    // Niagara particle systems to spawn
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Weather|Assets")
    UNiagaraSystem* RainSystem;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Weather|Assets")
    UNiagaraSystem* SnowSystem;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Weather|Assets")
    UNiagaraSystem* StormSystem;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Weather|Assets")
    USoundBase* ThunderSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFX|Weather|Assets")
    USoundBase* WindLoopSound;

    // Spawned component references
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    UNiagaraComponent* ActiveRainComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    UNiagaraComponent* ActiveSnowComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    UNiagaraComponent* ActiveStormComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    UAudioComponent* ActiveWindAudio;

    // Current state
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    float CurrentRainIntensity = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    float CurrentSnowIntensity = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    float CurrentStormIntensity = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    float CurrentFogDensity = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    float CurrentWindSpeed = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VFX|Weather|State")
    FVector CurrentWindDirection = FVector(1.0f, 0.0f, 0.0f);

    // Storm lightning timer
    FTimerHandle LightningTimerHandle;

    void OnLightningTimer();

private:
    void SpawnRainNiagara(float Intensity);
    void DestroyRainNiagara();
    void SpawnSnowNiagara(float Intensity);
    void DestroySnowNiagara();
    void SpawnStormNiagara(float Intensity);
    void DestroyStormNiagara();
    void UpdateFogDensity(float Density);
    void ResetFog();
    UExponentialHeightFogComponent* GetHeightFog() const;
    void PlayThunderSound();
};
