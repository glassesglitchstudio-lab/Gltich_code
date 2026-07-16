#include "UMiniMapWidget.h"
#include "Components/Image.h"

void UMiniMapWidget::NativeConstruct()
{
    Super::NativeConstruct();

    if (PlayerArrow)
    {
        PlayerArrow->SetColorAndOpacity(PlayerColor);
    }
}

void UMiniMapWidget::UpdatePlayerPosition(FVector NewPosition)
{
    PlayerPosition = NewPosition;
}

void UMiniMapWidget::AddMarker(FVector Position, const FString& MarkerID, FLinearColor Color)
{
    // Remove existing marker with same ID
    RemoveMarker(MarkerID);

    FMiniMapMarker NewMarker;
    NewMarker.MarkerID = MarkerID;
    NewMarker.WorldPosition = Position;
    NewMarker.Color = Color;
    Markers.Add(NewMarker);
}

void UMiniMapWidget::RemoveMarker(const FString& MarkerID)
{
    Markers.RemoveAll([&MarkerID](const FMiniMapMarker& M)
    {
        return M.MarkerID == MarkerID;
    });
}

void UMiniMapWidget::SetRotation(float NewRotation)
{
    Rotation = NewRotation;

    if (PlayerArrow)
    {
        FRotator Rot(0.0f, NewRotation, 0.0f);
        PlayerArrow->SetRenderTransformAngle(NewRotation);
    }
}

void UMiniMapWidget::SetZoom(float NewZoom)
{
    ZoomLevel = FMath::Max(0.1f, NewZoom);
    WorldUnitsPerPixel = 50.0f / ZoomLevel;
}

FVector UMiniMapWidget::WorldToMapPosition(FVector WorldPos) const
{
    FVector Delta = (WorldPos - PlayerPosition) / WorldUnitsPerPixel;

    // Apply rotation
    float Rad = FMath::DegreesToRadians(-Rotation);
    float CosA = FMath::Cos(Rad);
    float SinA = FMath::Sin(Rad);
    float RotatedX = Delta.X * CosA - Delta.Y * SinA;
    float RotatedY = Delta.X * SinA + Delta.Y * CosA;

    FVector2D MapCenter(MapSize * 0.5f, MapSize * 0.5f);
    return FVector(RotatedX + MapCenter.X, RotatedY + MapCenter.Y, 0.0f);
}
