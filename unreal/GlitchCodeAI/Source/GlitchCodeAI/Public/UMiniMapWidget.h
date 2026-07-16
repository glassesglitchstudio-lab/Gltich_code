#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UMiniMapWidget.generated.h"

USTRUCT(BlueprintType)
struct FMiniMapMarker
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString MarkerID;

    UPROPERTY(BlueprintReadOnly)
    FVector WorldPosition = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FString Label;

    UPROPERTY(BlueprintReadOnly)
    FLinearColor Color = FLinearColor::White;

    UPROPERTY(BlueprintReadOnly)
    float Radius = 10.0f;
};

UCLASS()
class GLITCHCODEAI_API UMiniMapWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "HUD|MiniMap")
    void UpdatePlayerPosition(FVector NewPosition);

    UFUNCTION(BlueprintCallable, Category = "HUD|MiniMap")
    void AddMarker(FVector Position, const FString& MarkerID, FLinearColor Color);

    UFUNCTION(BlueprintCallable, Category = "HUD|MiniMap")
    void RemoveMarker(const FString& MarkerID);

    UFUNCTION(BlueprintCallable, Category = "HUD|MiniMap")
    void SetRotation(float NewRotation);

    UFUNCTION(BlueprintCallable, Category = "HUD|MiniMap")
    void SetZoom(float NewZoom);

protected:
    UPROPERTY(meta = (BindWidget))
    class UImage* MiniMapImage;

    UPROPERTY(meta = (BindWidgetOptional))
    class UImage* PlayerArrow;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|MiniMap")
    float MapSize = 200.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|MiniMap")
    float WorldUnitsPerPixel = 50.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|MiniMap")
    float ZoomLevel = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|MiniMap")
    float Rotation = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|MiniMap")
    FLinearColor PlayerColor = FLinearColor::Green;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|MiniMap")
    FLinearColor MarkerDefaultColor = FLinearColor::Red;

    virtual void NativeConstruct() override;

private:
    FVector PlayerPosition = FVector::ZeroVector;
    TArray<FMiniMapMarker> Markers;

    FVector WorldToMapPosition(FVector WorldPos) const;
};
