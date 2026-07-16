#include "UInventoryWidget.h"
#include "Components/UniformGridPanel.h"
#include "Components/TextBlock.h"
#include "Components/WidgetSwitcher.h"

void UInventoryWidget::NativeConstruct()
{
    Super::NativeConstruct();

    if (SlotGrid)
    {
        SlotGrid->SetSlotPadding(FMargin(2.0f));
    }

    // Initialize empty slots
    SlotData.SetNum(MaxSlots);
    for (int32 i = 0; i < MaxSlots; ++i)
    {
        SlotData[i].SlotIndex = i;
        SlotData[i].bIsEmpty = true;
    }
}

void UInventoryWidget::RefreshSlots(const TArray<FInventorySlotData>& NewSlots)
{
    SlotData.SetNum(MaxSlots);

    for (int32 i = 0; i < MaxSlots; ++i)
    {
        if (i < NewSlots.Num())
        {
            SlotData[i] = NewSlots[i];
            SlotData[i].SlotIndex = i;
        }
        else
        {
            SlotData[i] = FInventorySlotData();
            SlotData[i].SlotIndex = i;
            SlotData[i].bIsEmpty = true;
        }

        UpdateSlotWidget(i);
    }
}

void UInventoryWidget::SelectSlot(int32 SlotIndex)
{
    if (SlotIndex < 0 || SlotIndex >= MaxSlots)
    {
        return;
    }

    SelectedSlotIndex = SlotIndex;

    // Update visuals for all slots
    for (int32 i = 0; i < MaxSlots; ++i)
    {
        UpdateSlotWidget(i);
    }

    if (SlotIndex >= 0 && SlotIndex < SlotData.Num())
    {
        OnSlotSelected.Broadcast(SlotIndex, SlotData[SlotIndex]);
    }
}

void UInventoryWidget::ShowTooltip(int32 SlotIndex)
{
    if (SlotIndex < 0 || SlotIndex >= SlotData.Num() || SlotData[SlotIndex].bIsEmpty)
    {
        if (TooltipSwitcher)
        {
            TooltipSwitcher->SetActiveWidgetIndex(0);
        }
        return;
    }

    if (TooltipSwitcher)
    {
        TooltipSwitcher->SetActiveWidgetIndex(1);
    }

    if (TooltipName)
    {
        TooltipName->SetText(FText::FromString(SlotData[SlotIndex].DisplayName));
    }

    if (TooltipDescription)
    {
        TooltipDescription->SetText(FText::AsNumber(SlotData[SlotIndex].Quantity));
    }
}

void UInventoryWidget::DragItem(int32 SlotIndex)
{
    if (SlotIndex < 0 || SlotIndex >= SlotData.Num() || SlotData[SlotIndex].bIsEmpty)
    {
        return;
    }

    DraggedSlotIndex = SlotIndex;
    OnItemDragged.Broadcast(SlotIndex, SlotData[SlotIndex]);
}

void UInventoryWidget::DropItem(int32 TargetSlot, FVector DropLocation)
{
    if (DraggedSlotIndex < 0 || TargetSlot < 0 || TargetSlot >= MaxSlots)
    {
        DraggedSlotIndex = -1;
        return;
    }

    OnItemDropped.Broadcast(TargetSlot, DropLocation);
    DraggedSlotIndex = -1;
}

void UInventoryWidget::UpdateSlotWidget(int32 Index)
{
    // Placeholder for actual slot widget update
    // In a real implementation, this would iterate over child widgets
    // in the SlotGrid and update their appearance based on SlotData[Index]
}
