#include "UInventoryComponent.h"

UInventoryComponent::UInventoryComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

int32 UInventoryComponent::FindItemIndex(const FString& ItemID) const
{
    for (int32 i = 0; i < Items.Num(); ++i)
    {
        if (Items[i].ItemID == ItemID)
        {
            return i;
        }
    }
    return INDEX_NONE;
}

bool UInventoryComponent::AddItem(const FString& ItemID, const FString& DisplayName, int32 Quantity)
{
    if (Quantity <= 0 || ItemID.IsEmpty())
    {
        return false;
    }

    // Try stacking on an existing item
    int32 ExistingIndex = FindItemIndex(ItemID);
    if (ExistingIndex != INDEX_NONE)
    {
        FInventoryItem& Existing = Items[ExistingIndex];
        int32 CanAdd = FMath::Min(Quantity, Existing.MaxStack - Existing.Quantity);
        if (CanAdd <= 0)
        {
            return false;
        }
        Existing.Quantity += CanAdd;

        OnItemAdded.Broadcast(Existing);
        OnInventoryUpdated.Broadcast();
        return true;
    }

    // Check slot capacity
    if (Items.Num() >= MaxSlots)
    {
        return false;
    }

    // Create new item entry
    FInventoryItem NewItem;
    NewItem.ItemID = ItemID;
    NewItem.DisplayName = DisplayName;
    NewItem.Quantity = FMath::Min(Quantity, 99); // Default max stack
    NewItem.MaxStack = 99;

    Items.Add(NewItem);

    OnItemAdded.Broadcast(NewItem);
    OnInventoryUpdated.Broadcast();
    return true;
}

bool UInventoryComponent::RemoveItem(const FString& ItemID, int32 Quantity)
{
    if (Quantity <= 0 || ItemID.IsEmpty())
    {
        return false;
    }

    int32 Index = FindItemIndex(ItemID);
    if (Index == INDEX_NONE)
    {
        return false;
    }

    FInventoryItem& Item = Items[Index];
    if (Item.Quantity < Quantity)
    {
        return false;
    }

    FInventoryItem RemovedCopy = Item;
    Item.Quantity -= Quantity;

    if (Item.Quantity <= 0)
    {
        Items.RemoveAt(Index);
    }

    OnItemRemoved.Broadcast(RemovedCopy);
    OnInventoryUpdated.Broadcast();
    return true;
}

bool UInventoryComponent::HasItem(const FString& ItemID, int32 Quantity) const
{
    return GetItemCount(ItemID) >= Quantity;
}

int32 UInventoryComponent::GetItemCount(const FString& ItemID) const
{
    int32 Index = FindItemIndex(ItemID);
    if (Index == INDEX_NONE)
    {
        return 0;
    }
    return Items[Index].Quantity;
}

void UInventoryComponent::SortInventory(int32 SortBy)
{
    if (Items.Num() <= 1)
    {
        return;
    }

    // Bubble sort for simplicity and determinism
    for (int32 i = 0; i < Items.Num() - 1; ++i)
    {
        for (int32 j = 0; j < Items.Num() - i - 1; ++j)
        {
            bool bSwap = false;

            switch (SortBy)
            {
            case 0: // Name
                bSwap = Items[j].DisplayName > Items[j + 1].DisplayName;
                break;
            case 1: // Quantity
                bSwap = Items[j].Quantity < Items[j + 1].Quantity;
                break;
            case 2: // Rarity
                bSwap = Items[j].Rarity < Items[j + 1].Rarity;
                break;
            case 3: // Weight
                bSwap = Items[j].Weight > Items[j + 1].Weight;
                break;
            default:
                bSwap = Items[j].DisplayName > Items[j + 1].DisplayName;
                break;
            }

            if (bSwap)
            {
                Items.Swap(j, j + 1);
            }
        }
    }

    OnInventoryUpdated.Broadcast();
}

void UInventoryComponent::ClearInventory()
{
    Items.Empty();
    OnInventoryUpdated.Broadcast();
}

TArray<FInventoryItem> UInventoryComponent::GetAllItems() const
{
    return Items;
}

FInventoryItem UInventoryComponent::GetItem(const FString& ItemID) const
{
    int32 Index = FindItemIndex(ItemID);
    if (Index != INDEX_NONE)
    {
        return Items[Index];
    }

    // Return empty item with defaults
    FInventoryItem Empty;
    Empty.ItemID = TEXT("");
    Empty.Quantity = 0;
    return Empty;
}

bool UInventoryComponent::UseItem(const FString& ItemID)
{
    int32 Index = FindItemIndex(ItemID);
    if (Index == INDEX_NONE)
    {
        return false;
    }

    FInventoryItem& Item = Items[Index];
    if (!Item.bCanBeUsed)
    {
        return false;
    }

    // Consume one unit
    Item.Quantity -= 1;
    if (Item.Quantity <= 0)
    {
        FInventoryItem RemovedCopy = Item;
        Items.RemoveAt(Index);
        OnItemRemoved.Broadcast(RemovedCopy);
    }

    OnInventoryUpdated.Broadcast();
    return true;
}

bool UInventoryComponent::DropItem(const FString& ItemID, int32 Quantity)
{
    int32 Index = FindItemIndex(ItemID);
    if (Index == INDEX_NONE)
    {
        return false;
    }

    FInventoryItem& Item = Items[Index];
    if (!Item.bCanBeDropped)
    {
        return false;
    }

    if (Item.Quantity < Quantity)
    {
        return false;
    }

    FInventoryItem DroppedCopy = Item;
    Item.Quantity -= Quantity;

    if (Item.Quantity <= 0)
    {
        Items.RemoveAt(Index);
    }

    OnItemRemoved.Broadcast(DroppedCopy);
    OnInventoryUpdated.Broadcast();
    return true;
}

float UInventoryComponent::GetCurrentWeight() const
{
    float TotalWeight = 0.0f;
    for (const FInventoryItem& Item : Items)
    {
        TotalWeight += Item.Weight * Item.Quantity;
    }
    return TotalWeight;
}

bool UInventoryComponent::IsOverWeight() const
{
    return GetCurrentWeight() > MaxWeight;
}

int32 UInventoryComponent::GetUsedSlots() const
{
    return Items.Num();
}

int32 UInventoryComponent::GetFreeSlots() const
{
    return FMath::Max(0, MaxSlots - Items.Num());
}
