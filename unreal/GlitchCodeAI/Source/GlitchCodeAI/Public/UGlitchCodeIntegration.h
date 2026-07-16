#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "UGlitchCodeIntegration.generated.h"

// Forward declarations
class UHealthComponent;
class UInventoryComponent;
class UQuestManager;
class UDialogueManager;
class UCombatComponent;
class UStaminaComponent;
class UDamageSystem;
class UHealingSystem;
class UKeyItemComponent;
class UTrapComponent;
class UPuzzleComponent;
class UCraftingComponent;

// --- Cross-system broadcast delegates ---

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLowHealthWarning, float, CurrentHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnQuestItemCollected, const FString&, ItemID, int32, Quantity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPuzzleCompleted, const FString&, PuzzleName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCraftingCompleted, const FString&, RecipeName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnEnemyDefeated, AActor*, Enemy, float, DamageDealt);

UCLASS()
class GLITCHCODEAI_API UGlitchCodeIntegration : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    // Called by GameMode after player spawns
    UFUNCTION(BlueprintCallable, Category = "GlitchCode|Integration")
    void InitializeForPlayer(ACharacter* PlayerCharacter);

    // Disconnect all bindings
    UFUNCTION(BlueprintCallable, Category = "GlitchCode|Integration")
    void Shutdown();

    // --- Broadcast events for external listeners ---

    UPROPERTY(BlueprintAssignable, Category = "GlitchCode|Integration")
    FOnLowHealthWarning OnLowHealthWarning;

    UPROPERTY(BlueprintAssignable, Category = "GlitchCode|Integration")
    FOnQuestItemCollected OnQuestItemCollected;

    UPROPERTY(BlueprintAssignable, Category = "GlitchCode|Integration")
    FOnPuzzleCompleted OnPuzzleCompleted;

    UPROPERTY(BlueprintAssignable, Category = "GlitchCode|Integration")
    FOnCraftingCompleted OnCraftingCompleted;

    UPROPERTY(BlueprintAssignable, Category = "GlitchCode|Integration")
    FOnEnemyDefeated OnEnemyDefeated;

protected:
    UPROPERTY()
    ACharacter* CachedPlayer = nullptr;

private:
    // Component handles (cached during InitializeForPlayer)
    UPROPERTY()
    UHealthComponent* CachedHealth = nullptr;

    UPROPERTY()
    UInventoryComponent* CachedInventory = nullptr;

    UPROPERTY()
    UQuestManager* CachedQuest = nullptr;

    UPROPERTY()
    UDialogueManager* CachedDialogue = nullptr;

    UPROPERTY()
    UCombatComponent* CachedCombat = nullptr;

    UPROPERTY()
    UStaminaComponent* CachedStamina = nullptr;

    UPROPERTY()
    UDamageSystem* CachedDamage = nullptr;

    UPROPERTY()
    UHealingSystem* CachedHealing = nullptr;

    UPROPERTY()
    UKeyItemComponent* CachedKeyItem = nullptr;

    UPROPERTY()
    UTrapComponent* CachedTrap = nullptr;

    UPROPERTY()
    UPuzzleComponent* CachedPuzzle = nullptr;

    UPROPERTY()
    UCraftingComponent* CachedCrafting = nullptr;

    // Low health threshold for survival quest trigger
    float LowHealthThreshold = 25.0f;

    // Tracks whether low-health warning has fired this "danger episode"
    bool bLowHealthWarningActive = false;

    // Cross-system event handlers
    void OnHealthChanged(float NewHealth, float Delta);
    void OnPlayerDeath();
    void OnItemAdded(const FInventoryItem& Item);
    void OnItemRemoved(const FInventoryItem& Item);
    void OnQuestCompleted(const FString& QuestID);
    void OnDialogueChoiceMade(const FString& ChoiceID);
    void OnEnemyKilled(AActor* Enemy, float DamageDealt);
    void OnKeyItemUsed(const FString& KeyName, AActor* LockTarget);
    void OnTrapTriggered(AActor* TrapActor, AActor* TriggeredBy);
    void OnPuzzleSolved(const FString& PuzzleName);
    void OnItemCrafted(const FString& RecipeName);
};
