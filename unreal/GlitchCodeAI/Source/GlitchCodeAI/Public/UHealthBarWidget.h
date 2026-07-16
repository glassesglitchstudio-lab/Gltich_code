#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UHealthBarWidget.generated.h"

UCLASS()
class GLITCHCODEAI_API UHealthBarWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "HUD|Health")
    void SetHealth(float Current, float Max);

    UFUNCTION(BlueprintCallable, Category = "HUD|Health")
    void SetStamina(float Current, float Max);

    UFUNCTION(BlueprintCallable, Category = "HUD|Health")
    void SetColor(FLinearColor NewColor);

    UFUNCTION(BlueprintCallable, Category = "HUD|Health")
    void AnimateDamage(float Duration);

    UFUNCTION(BlueprintCallable, Category = "HUD|Health")
    void ShowDamageNumber(float Amount, FVector WorldPos);

protected:
    UPROPERTY(meta = (BindWidget))
    class UProgressBar* HealthBar;

    UPROPERTY(meta = (BindWidget))
    class UProgressBar* StaminaBar;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* HealthText;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* StaminaText;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Health")
    FLinearColor HealthColor = FLinearColor(0.0f, 0.8f, 0.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Health")
    FLinearColor DamageColor = FLinearColor(1.0f, 0.0f, 0.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Health")
    float DamageFlashSpeed = 2.0f;

    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

private:
    float CurrentHealth = 1.0f;
    float MaxHealth = 1.0f;
    float CurrentStamina = 1.0f;
    float MaxStamina = 1.0f;

    bool bIsAnimatingDamage = false;
    float DamageAnimElapsed = 0.0f;
    float DamageAnimDuration = 0.0f;

    void UpdateHealthBar();
    void UpdateStaminaBar();
};
