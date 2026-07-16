#pragma once

#include "CoreMinimal.h"
#include "UInventoryComponent.h"

namespace GlitchInventoryDefaults
{
    inline FInventoryItem HealthPotion()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("HealthPotion");
        Item.DisplayName = TEXT("Health Potion");
        Item.Description = TEXT("Restores 50 HP when consumed.");
        Item.Quantity = 1;
        Item.MaxStack = 10;
        Item.Icon = nullptr;
        Item.Weight = 0.5f;
        Item.Rarity = 1; // Uncommon
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem StaminaPotion()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("StaminaPotion");
        Item.DisplayName = TEXT("Stamina Potion");
        Item.Description = TEXT("Restores 40 stamina when consumed.");
        Item.Quantity = 1;
        Item.MaxStack = 10;
        Item.Icon = nullptr;
        Item.Weight = 0.5f;
        Item.Rarity = 1; // Uncommon
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem Ammo()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Ammo");
        Item.DisplayName = TEXT("Ammo");
        Item.Description = TEXT("Standard ammunition. Used by most firearms.");
        Item.Quantity = 1;
        Item.MaxStack = 200;
        Item.Icon = nullptr;
        Item.Weight = 0.1f;
        Item.Rarity = 0; // Common
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = false;
        return Item;
    }

    inline FInventoryItem Key()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Key");
        Item.DisplayName = TEXT("Key");
        Item.Description = TEXT("Opens a locked door or chest.");
        Item.Quantity = 1;
        Item.MaxStack = 1;
        Item.Icon = nullptr;
        Item.Weight = 0.1f;
        Item.Rarity = 2; // Rare
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem FlashlightBattery()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("FlashlightBattery");
        Item.DisplayName = TEXT("Flashlight Battery");
        Item.Description = TEXT("Powers a flashlight for 60 seconds.");
        Item.Quantity = 1;
        Item.MaxStack = 5;
        Item.Icon = nullptr;
        Item.Weight = 0.2f;
        Item.Rarity = 0; // Common
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem Lockpick()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Lockpick");
        Item.DisplayName = TEXT("Lockpick");
        Item.Description = TEXT("Used to bypass mechanical locks.");
        Item.Quantity = 1;
        Item.MaxStack = 20;
        Item.Icon = nullptr;
        Item.Weight = 0.05f;
        Item.Rarity = 1; // Uncommon
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem Medkit()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Medkit");
        Item.DisplayName = TEXT("Medkit");
        Item.Description = TEXT("Fully restores health over 5 seconds.");
        Item.Quantity = 1;
        Item.MaxStack = 3;
        Item.Icon = nullptr;
        Item.Weight = 1.0f;
        Item.Rarity = 2; // Rare
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem Food()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Food");
        Item.DisplayName = TEXT("Canned Food");
        Item.Description = TEXT("Restores 25 hunger over 3 seconds.");
        Item.Quantity = 1;
        Item.MaxStack = 20;
        Item.Icon = nullptr;
        Item.Weight = 0.8f;
        Item.Rarity = 0; // Common
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem Water()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Water");
        Item.DisplayName = TEXT("Water Bottle");
        Item.Description = TEXT("Restores 30 thirst instantly.");
        Item.Quantity = 1;
        Item.MaxStack = 10;
        Item.Icon = nullptr;
        Item.Weight = 0.5f;
        Item.Rarity = 0; // Common
        Item.bCanBeDropped = true;
        Item.bCanBeUsed = true;
        return Item;
    }

    inline FInventoryItem Document()
    {
        FInventoryItem Item;
        Item.ItemID = TEXT("Document");
        Item.DisplayName = TEXT("Classified Document");
        Item.Description = TEXT("Contains classified intel. Required for mission completion.");
        Item.Quantity = 1;
        Item.MaxStack = 1;
        Item.Icon = nullptr;
        Item.Weight = 0.05f;
        Item.Rarity = 3; // Epic
        Item.bCanBeDropped = false;
        Item.bCanBeUsed = true;
        return Item;
    }
}
