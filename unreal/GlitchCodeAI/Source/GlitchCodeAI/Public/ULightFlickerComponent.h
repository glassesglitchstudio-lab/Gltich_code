#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ULightFlickerComponent.generated.h"

UENUM(BlueprintType)
enum class EFlickerPattern : uint8
{
    Constant  UMETA(DisplayName = "Constant"),
    Random    UMETA(DisplayName = "Random"),
    Rhythm    UMETA(DisplayName = "Rhythm"),
    Broken    UMETA(DisplayName = "Broken"),
    Ghostly   UMETA(DisplayName = "Ghostly")
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFlickerStateChanged, bool, bIsFlickering);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API ULightFlickerComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    ULightFlickerComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "LightFlicker")
    void SetFlickerPattern(const FString& PatternName);

    UFUNCTION(BlueprintCallable, Category = "LightFlicker")
    void SetIntensity(float NewIntensity);

    UFUNCTION(BlueprintCallable, Category = "LightFlicker")
    void SetFrequency(float NewFrequency);

    UFUNCTION(BlueprintCallable, Category = "LightFlicker")
    void SetRandomness(float NewRandomness);

    UFUNCTION(BlueprintCallable, Category = "LightFlicker")
    void StartFlicker();

    UFUNCTION(BlueprintCallable, Category = "LightFlicker")
    void StopFlicker();

    UFUNCTION(BlueprintPure, Category = "LightFlicker")
    bool IsFlickering() const { return bIsFlickering; }

    UFUNCTION(BlueprintPure, Category = "LightFlicker")
    FString GetCurrentPattern() const;

    UPROPERTY(BlueprintAssignable, Category = "LightFlicker")
    FOnFlickerStateChanged OnFlickerStateChanged;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LightFlicker")
    EFlickerPattern CurrentPattern = EFlickerPattern::Constant;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LightFlicker")
    float BaseIntensity = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LightFlicker")
    float Frequency = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LightFlicker")
    float Randomness = 0.3f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "LightFlicker")
    bool bIsFlickering = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LightFlicker")
    float MinIntensity = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LightFlicker")
    float MaxIntensity = 1.0f;

private:
    float FlickerTimer = 0.0f;
    float NextFlickerTime = 0.0f;
    float CurrentFlickerIntensity = 1.0f;
    float RhythmPhase = 0.0f;

    float CalculateFlickerIntensity(float DeltaTime);
    float GetConstantFlicker() const;
    float GetRandomFlicker() const;
    float GetRhythmFlicker() const;
    float GetBrokenFlicker() const;
    float GetGhostlyFlicker() const;

    class ULightComponent* FindLightComponent() const;
    void ApplyFlickerIntensity(float Intensity);
};
