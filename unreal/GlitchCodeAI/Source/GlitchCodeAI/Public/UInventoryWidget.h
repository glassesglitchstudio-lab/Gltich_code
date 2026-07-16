#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UInventoryWidget.generated.h"

USTRUCT(BlueprintType)
struct FInventorySlotData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    int32 SlotIndex = -1;

    UPROPERTY(BlueprintReadOnly)
    bool bIsEmpty = true;

    UPROPERTY(BlueprintReadOnly)
    FString ItemID;

    UPROPERTY(BlueprintReadOnly)
    FString DisplayName;

    UPROPERTY(BlueprintReadOnly)
    int32 Quantity = 0;

    UPROPERTY(BlueprintReadOnly)
    UTexture2D* Icon = nullptr;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnSlotSelected, int32, SlotIndex, const FInventorySlotData&, SlotData);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnItemDragged, int32, SlotIndex, const FInventorySlotData&, SlotData);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnItemDropped, int32, TargetSlot, FVector, DropLocation);

UCLASS()
class GLITCHCODEAI_API UInventoryWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "HUD|Inventory")
    void RefreshSlots(const TArray<FInventorySlotData>& Slots);

    UFUNCTION(BlueprintCallable, Category = "HUD|Inventory")
    void SelectSlot(int32 SlotIndex);

    UFUNCTION(BlueprintCallable, Category = "HUD|Inventory")
    void ShowTooltip(int32 SlotIndex);

    UFUNCTION(BlueprintCallable, Category = "HUD|Inventory")
    void DragItem(int32 SlotIndex);

    UFUNCTION(BlueprintCallable, Category = "HUD|Inventory")
    void DropItem(int32 TargetSlot, FVector DropLocation);

    UPROPERTY(BlueprintAssignable, Category = "HUD|Inventory|Events")
    FOnSlotSelected OnSlotSelected;

    UPROPERTY(BlueprintAssignable, Category = "HUD|Inventory|Events")
    FOnItemDragged OnItemDragged;

    UPROPERTY(BlueprintAssignable, Category = "HUD|Inventory|Events")
    FOnItemDropped OnItemDropped;

protected:
    UPROPERTY(meta = (BindWidget))
    class UUniformGridPanel* SlotGrid;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* TitleText;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* WeightText;

    UPROPERTY(meta = (BindWidgetOptional))
    class UWidgetSwitcher* TooltipSwitcher;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* TooltipName;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* TooltipDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Inventory")
    int32 Columns = 5;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Inventory")
    int32 MaxSlots = 20;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Inventory")
    FLinearColor SelectedColor = FLinearColor(1.0f, 0.8f, 0.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Inventory")
    FLinearColor EmptySlotColor = FLinearColor(0.2f, 0.2f, 0.2f, 0.5f);

    virtual void NativeConstruct() override;

private:
    TArray<FInventorySlotData> SlotData;
    int32 SelectedSlotIndex = -1;
    int32 DraggedSlotIndex = -1;

    void UpdateSlotWidget(int32 Index);
};
