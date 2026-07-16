#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UInventoryComponent.generated.h"

USTRUCT(BlueprintType)
struct FInventoryItem
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString ItemID;

    UPROPERTY(BlueprintReadOnly)
    FString DisplayName;

    UPROPERTY(BlueprintReadOnly)
    FString Description;

    UPROPERTY(BlueprintReadOnly)
    int32 Quantity = 1;

    UPROPERTY(BlueprintReadOnly)
    int32 MaxStack = 99;

    UPROPERTY(BlueprintReadOnly)
    UTexture2D* Icon = nullptr;

    UPROPERTY(BlueprintReadOnly)
    float Weight = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    int32 Rarity = 0; // 0=Common, 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary

    UPROPERTY(BlueprintReadOnly)
    bool bCanBeDropped = true;

    UPROPERTY(BlueprintReadOnly)
    bool bCanBeUsed = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnInventoryUpdated);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnItemAdded, const FInventoryItem&, Item);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnItemRemoved, const FInventoryItem&, Item);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UInventoryComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UInventoryComponent();

    // Inventory Operations
    UFUNCTION(BlueprintCallable, Category = "Inventory")
    bool AddItem(const FString& ItemID, const FString& DisplayName, int32 Quantity = 1);

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    bool RemoveItem(const FString& ItemID, int32 Quantity = 1);

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    bool HasItem(const FString& ItemID, int32 Quantity = 1) const;

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    int32 GetItemCount(const FString& ItemID) const;

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    void SortInventory(int32 SortBy = 0); // 0=Name, 1=Quantity, 2=Rarity, 3=Weight

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    void ClearInventory();

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    TArray<FInventoryItem> GetAllItems() const;

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    FInventoryItem GetItem(const FString& ItemID) const;

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    bool UseItem(const FString& ItemID);

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    bool DropItem(const FString& ItemID, int32 Quantity = 1);

    // Weight System
    UFUNCTION(BlueprintPure, Category = "Inventory")
    float GetCurrentWeight() const;

    UFUNCTION(BlueprintPure, Category = "Inventory")
    float GetMaxWeight() const { return MaxWeight; }

    UFUNCTION(BlueprintPure, Category = "Inventory")
    bool IsOverWeight() const;

    // Capacity
    UFUNCTION(BlueprintPure, Category = "Inventory")
    int32 GetSlotCount() const { return MaxSlots; }

    UFUNCTION(BlueprintPure, Category = "Inventory")
    int32 GetUsedSlots() const;

    UFUNCTION(BlueprintPure, Category = "Inventory")
    int32 GetFreeSlots() const;

    // Events
    UPROPERTY(BlueprintAssignable)
    FOnInventoryUpdated OnInventoryUpdated;

    UPROPERTY(BlueprintAssignable)
    FOnItemAdded OnItemAdded;

    UPROPERTY(BlueprintAssignable)
    FOnItemRemoved OnItemRemoved;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Inventory")
    int32 MaxSlots = 20;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Inventory")
    float MaxWeight = 100.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Inventory")
    TArray<FInventoryItem> Items;

private:
    int32 FindItemIndex(const FString& ItemID) const;
};
