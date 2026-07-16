#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UStealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDetected, float, DetectionRate);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnHidden);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UStealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UStealthComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    // Visibility
    UFUNCTION(BlueprintCallable, Category = "Stealth")
    float GetVisibilityLevel() const;

    UFUNCTION(BlueprintCallable, Category = "Stealth")
    void SetVisibilityLevel(float NewLevel);

    UFUNCTION(BlueprintPure, Category = "Stealth")
    bool IsInShadow() const;

    UFUNCTION(BlueprintPure, Category = "Stealth")
    bool IsInLight() const;

    // Noise
    UFUNCTION(BlueprintCallable, Category = "Stealth")
    float GetNoiseLevel() const;

    UFUNCTION(BlueprintCallable, Category = "Stealth")
    void SetNoiseLevel(float NewLevel);

    // Detection
    UFUNCTION(BlueprintPure, Category = "Stealth")
    bool CanBeDetected() const;

    UFUNCTION(BlueprintPure, Category = "Stealth")
    float GetDetectionRate() const;

    // Events
    UPROPERTY(BlueprintAssignable, Category = "Stealth")
    FOnDetected OnDetected;

    UPROPERTY(BlueprintAssignable, Category = "Stealth")
    FOnHidden OnHidden;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stealth|Visibility")
    float BaseVisibility = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stealth|Visibility")
    float ShadowMultiplier = 0.3f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stealth|Visibility")
    float LightMultiplier = 1.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stealth|Noise")
    float MovementNoiseMultiplier = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stealth|Detection")
    float CoverBonus = 0.4f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stealth|Detection")
    float DetectionThreshold = 0.5f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stealth|State")
    float CurrentVisibility = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stealth|State")
    float CurrentNoise = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stealth|State")
    bool bIsInShadow = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stealth|State")
    bool bIsInLight = true;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stealth|State")
    bool bInCover = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stealth|State")
    bool bCurrentlyDetected = false;

private:
    void UpdateLightState();
    float CalculateDetectionRate() const;
};
