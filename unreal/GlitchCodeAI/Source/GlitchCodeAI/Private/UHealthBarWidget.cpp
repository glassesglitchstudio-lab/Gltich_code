#include "UHealthBarWidget.h"
#include "Components/ProgressBar.h"
#include "Components/TextBlock.h"

void UHealthBarWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);

    if (bIsAnimatingDamage)
    {
        DamageAnimElapsed += InDeltaTime;
        float Progress = FMath::Clamp(DamageAnimElapsed / DamageAnimDuration, 0.0f, 1.0f);
        float Flash = FMath::Abs(FMath::Sin(Progress * PI * DamageFlashSpeed));

        if (HealthBar)
        {
            FLinearColor AnimColor = FMath::Lerp(HealthColor, DamageColor, Flash);
            HealthBar->SetFillColorAndOpacity(AnimColor);
        }

        if (Progress >= 1.0f)
        {
            bIsAnimatingDamage = false;
            UpdateHealthBar();
        }
    }
}

void UHealthBarWidget::SetHealth(float Current, float Max)
{
    CurrentHealth = FMath::Max(0.0f, Current);
    MaxHealth = FMath::Max(1.0f, Max);
    UpdateHealthBar();
}

void UHealthBarWidget::SetStamina(float Current, float Max)
{
    CurrentStamina = FMath::Max(0.0f, Current);
    MaxStamina = FMath::Max(1.0f, Max);
    UpdateStaminaBar();
}

void UHealthBarWidget::SetColor(FLinearColor NewColor)
{
    HealthColor = NewColor;
    UpdateHealthBar();
}

void UHealthBarWidget::AnimateDamage(float Duration)
{
    bIsAnimatingDamage = true;
    DamageAnimElapsed = 0.0f;
    DamageAnimDuration = FMath::Max(0.1f, Duration);
}

void UHealthBarWidget::ShowDamageNumber(float Amount, FVector WorldPos)
{
    // Damage numbers are typically spawned as separate floating widgets
    // This is a placeholder — actual implementation depends on the HUD manager
    // spawning a world-space widget at WorldPos with the Amount text
}

void UHealthBarWidget::UpdateHealthBar()
{
    if (HealthBar)
    {
        float Pct = MaxHealth > 0.0f ? CurrentHealth / MaxHealth : 0.0f;
        HealthBar->SetPercent(FMath::Clamp(Pct, 0.0f, 1.0f));
        HealthBar->SetFillColorAndOpacity(HealthColor);
    }

    if (HealthText)
    {
        HealthText->SetText(FText::AsNumber(FMath::CeilToInt(CurrentHealth)));
    }
}

void UHealthBarWidget::UpdateStaminaBar()
{
    if (StaminaBar)
    {
        float Pct = MaxStamina > 0.0f ? CurrentStamina / MaxStamina : 0.0f;
        StaminaBar->SetPercent(FMath::Clamp(Pct, 0.0f, 1.0f));
    }

    if (StaminaText)
    {
        StaminaText->SetText(FText::AsNumber(FMath::CeilToInt(CurrentStamina)));
    }
}
