#include "UCrosshairWidget.h"
#include "Components/Image.h"

void UCrosshairWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);

    UpdateHitMarker(InDeltaTime);
    UpdateKillMarker(InDeltaTime);
}

void UCrosshairWidget::SetCrosshairType(const FString& TypeName)
{
    if (TypeName.Equals("Dot", ESearchCase::IgnoreCase))
    {
        CrosshairType = ECrosshairType::Dot;
    }
    else if (TypeName.Equals("Cross", ESearchCase::IgnoreCase))
    {
        CrosshairType = ECrosshairType::Cross;
    }
    else if (TypeName.Equals("Circle", ESearchCase::IgnoreCase))
    {
        CrosshairType = ECrosshairType::Circle;
    }
    else if (TypeName.Equals("Diamond", ESearchCase::IgnoreCase))
    {
        CrosshairType = ECrosshairType::Diamond;
    }
    else
    {
        CrosshairType = ECrosshairType::Custom;
    }

    UpdateCrosshair();
}

void UCrosshairWidget::SetSpread(float NewSpread)
{
    CurrentSpread = FMath::Max(0.0f, NewSpread);
    UpdateCrosshair();
}

void UCrosshairWidget::SetColor(FLinearColor NewColor)
{
    CrosshairColor = NewColor;
    UpdateCrosshair();
}

void UCrosshairWidget::ShowHitMarker(float Duration)
{
    bShowHitMarker = true;
    HitMarkerElapsed = 0.0f;
    HitMarkerDuration = FMath::Max(0.1f, Duration);

    if (HitMarkerImage)
    {
        HitMarkerImage->SetVisibility(ESlateVisibility::HitTestInvisible);
        HitMarkerImage->SetColorAndOpacity(FLinearColor::White);
    }
}

void UCrosshairWidget::ShowKillMarker(float Duration)
{
    bShowKillMarker = true;
    KillMarkerElapsed = 0.0f;
    KillMarkerDuration = FMath::Max(0.1f, Duration);

    if (KillMarkerImage)
    {
        KillMarkerImage->SetVisibility(ESlateVisibility::HitTestInvisible);
        KillMarkerImage->SetColorAndOpacity(FLinearColor::Red);
    }
}

void UCrosshairWidget::UpdateCrosshair()
{
    if (CrosshairImage)
    {
        CrosshairImage->SetColorAndOpacity(CrosshairColor);
        float EffectiveSpread = CurrentSpread * CurrentSpreadMultiplier;
        FVector2D Size(EffectiveSpread * 2.0f, EffectiveSpread * 2.0f);
        CrosshairImage->SetDesiredSizeOverride(Size);
    }
}

void UCrosshairWidget::UpdateHitMarker(float InDeltaTime)
{
    if (!bShowHitMarker)
    {
        return;
    }

    HitMarkerElapsed += InDeltaTime;
    float Alpha = 1.0f - (HitMarkerElapsed / HitMarkerDuration);

    if (HitMarkerImage)
    {
        HitMarkerImage->SetRenderOpacity(Alpha);
    }

    if (HitMarkerElapsed >= HitMarkerDuration)
    {
        bShowHitMarker = false;
        if (HitMarkerImage)
        {
            HitMarkerImage->SetVisibility(ESlateVisibility::Collapsed);
        }
    }
}

void UCrosshairWidget::UpdateKillMarker(float InDeltaTime)
{
    if (!bShowKillMarker)
    {
        return;
    }

    KillMarkerElapsed += InDeltaTime;
    float Alpha = 1.0f - (KillMarkerElapsed / KillMarkerDuration);

    if (KillMarkerImage)
    {
        KillMarkerImage->SetRenderOpacity(Alpha);
    }

    if (KillMarkerElapsed >= KillMarkerDuration)
    {
        bShowKillMarker = false;
        if (KillMarkerImage)
        {
            KillMarkerImage->SetVisibility(ESlateVisibility::Collapsed);
        }
    }
}
