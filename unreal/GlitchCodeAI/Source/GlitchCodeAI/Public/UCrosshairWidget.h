#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UCrosshairWidget.generated.h"

UENUM(BlueprintType)
enum class ECrosshairType : uint8
{
    Dot,
    Cross,
    Circle,
    Diamond,
    Custom
};

UCLASS()
class GLITCHCODEAI_API UCrosshairWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "HUD|Crosshair")
    void SetCrosshairType(const FString& TypeName);

    UFUNCTION(BlueprintCallable, Category = "HUD|Crosshair")
    void SetSpread(float NewSpread);

    UFUNCTION(BlueprintCallable, Category = "HUD|Crosshair")
    void SetColor(FLinearColor NewColor);

    UFUNCTION(BlueprintCallable, Category = "HUD|Crosshair")
    void ShowHitMarker(float Duration);

    UFUNCTION(BlueprintCallable, Category = "HUD|Crosshair")
    void ShowKillMarker(float Duration);

protected:
    UPROPERTY(meta = (BindWidget))
    class UImage* CrosshairImage;

    UPROPERTY(meta = (BindWidgetOptional))
    class UImage* HitMarkerImage;

    UPROPERTY(meta = (BindWidgetOptional))
    class UImage* KillMarkerImage;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Crosshair")
    ECrosshairType CrosshairType = ECrosshairType::Cross;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Crosshair")
    FLinearColor CrosshairColor = FLinearColor::White;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Crosshair")
    float BaseSpread = 10.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Crosshair")
    float SpreadMultiplier = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Crosshair")
    float MarkerFadeSpeed = 3.0f;

    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

private:
    float CurrentSpread = 10.0f;
    float CurrentSpreadMultiplier = 1.0f;

    bool bShowHitMarker = false;
    float HitMarkerElapsed = 0.0f;
    float HitMarkerDuration = 0.0f;

    bool bShowKillMarker = false;
    float KillMarkerElapsed = 0.0f;
    float KillMarkerDuration = 0.0f;

    void UpdateCrosshair();
    void UpdateHitMarker(float InDeltaTime);
    void UpdateKillMarker(float InDeltaTime);
};
