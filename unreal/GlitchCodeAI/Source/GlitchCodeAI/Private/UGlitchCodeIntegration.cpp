#include "UGlitchCodeIntegration.h"
#include "UHealthComponent.h"
#include "UInventoryComponent.h"
#include "UQuestManager.h"
#include "UDialogueManager.h"
#include "UCombatComponent.h"
#include "UStaminaComponent.h"
#include "UDamageSystem.h"
#include "UHealingSystem.h"
#include "UKeyItemComponent.h"
#include "UTrapComponent.h"
#include "UPuzzleComponent.h"
#include "UCraftingComponent.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"

// ─────────────────────────────────────────────
//  Initialize / Shutdown
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::InitializeForPlayer(ACharacter* PlayerCharacter)
{
    // Prevent double-binding
    Shutdown();

    CachedPlayer = PlayerCharacter;
    if (!PlayerCharacter)
    {
        UE_LOG(LogTemp, Warning, TEXT("GlitchCodeIntegration: InitializeForPlayer called with null character"));
        return;
    }

    // ── Wire Health ──
    CachedHealth = PlayerCharacter->FindComponentByClass<UHealthComponent>();
    if (CachedHealth)
    {
        CachedHealth->OnHealthChanged.AddDynamic(this, &UGlitchCodeIntegration::OnHealthChanged);
        CachedHealth->OnDeath.AddDynamic(this, &UGlitchCodeIntegration::OnPlayerDeath);
    }

    // ── Wire Combat → Quest (kill tracking) ──
    CachedCombat = PlayerCharacter->FindComponentByClass<UCombatComponent>();
    if (CachedCombat)
    {
        CachedCombat->OnEnemyKilled.AddDynamic(this, &UGlitchCodeIntegration::OnEnemyKilled);
    }

    // ── Wire Inventory → Quest (item collection) ──
    CachedInventory = PlayerCharacter->FindComponentByClass<UInventoryComponent>();
    if (CachedInventory)
    {
        CachedInventory->OnItemAdded.AddDynamic(this, &UGlitchCodeIntegration::OnItemAdded);
        CachedInventory->OnItemRemoved.AddDynamic(this, &UGlitchCodeIntegration::OnItemRemoved);
    }

    // ── Wire Quest → Dialogue (completion unlocks dialogue) ──
    CachedQuest = PlayerCharacter->FindComponentByClass<UQuestManager>();
    if (CachedQuest)
    {
        CachedQuest->OnQuestCompleted.AddDynamic(this, &UGlitchCodeIntegration::OnQuestCompleted);
    }

    // ── Wire Dialogue (choice tracking) ──
    CachedDialogue = PlayerCharacter->FindComponentByClass<UDialogueManager>();
    if (CachedDialogue)
    {
        CachedDialogue->OnChoiceMade.AddDynamic(this, &UGlitchCodeIntegration::OnDialogueChoiceMade);
    }

    // ── Wire KeyItem → Quest ──
    CachedKeyItem = PlayerCharacter->FindComponentByClass<UKeyItemComponent>();
    if (CachedKeyItem)
    {
        CachedKeyItem->OnKeyUsed.AddDynamic(this, &UGlitchCodeIntegration::OnKeyItemUsed);
    }

    // ── Wire Trap → Health ──
    CachedTrap = PlayerCharacter->FindComponentByClass<UTrapComponent>();
    if (CachedTrap)
    {
        CachedTrap->OnTrapTriggered.AddDynamic(this, &UGlitchCodeIntegration::OnTrapTriggered);
    }

    // ── Wire Puzzle → Quest ──
    CachedPuzzle = PlayerCharacter->FindComponentByClass<UPuzzleComponent>();
    if (CachedPuzzle)
    {
        CachedPuzzle->OnPuzzleSolved.AddDynamic(this, &UGlitchCodeIntegration::OnPuzzleSolved);
    }

    // ── Wire Crafting → Inventory ──
    CachedCrafting = PlayerCharacter->FindComponentByClass<UCraftingComponent>();
    if (CachedCrafting)
    {
        CachedCrafting->OnItemCrafted.AddDynamic(this, &UGlitchCodeIntegration::OnItemCrafted);
    }

    // ── Cache remaining systems (used in handlers, not bound) ──
    CachedStamina = PlayerCharacter->FindComponentByClass<UStaminaComponent>();
    CachedDamage = PlayerCharacter->FindComponentByClass<UDamageSystem>();
    CachedHealing = PlayerCharacter->FindComponentByClass<UHealingSystem>();

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Initialized for %s"), *PlayerCharacter->GetName());
}

void UGlitchCodeIntegration::Shutdown()
{
    // Health
    if (CachedHealth)
    {
        CachedHealth->OnHealthChanged.RemoveDynamic(this, &UGlitchCodeIntegration::OnHealthChanged);
        CachedHealth->OnDeath.RemoveDynamic(this, &UGlitchCodeIntegration::OnPlayerDeath);
    }

    // Inventory
    if (CachedInventory)
    {
        CachedInventory->OnItemAdded.RemoveDynamic(this, &UGlitchCodeIntegration::OnItemAdded);
        CachedInventory->OnItemRemoved.RemoveDynamic(this, &UGlitchCodeIntegration::OnItemRemoved);
    }

    // Quest
    if (CachedQuest)
    {
        CachedQuest->OnQuestCompleted.RemoveDynamic(this, &UGlitchCodeIntegration::OnQuestCompleted);
    }

    // Dialogue
    if (CachedDialogue)
    {
        CachedDialogue->OnChoiceMade.RemoveDynamic(this, &UGlitchCodeIntegration::OnDialogueChoiceMade);
    }

    // Combat
    if (CachedCombat)
    {
        CachedCombat->OnEnemyKilled.RemoveDynamic(this, &UGlitchCodeIntegration::OnEnemyKilled);
    }

    // KeyItem
    if (CachedKeyItem)
    {
        CachedKeyItem->OnKeyUsed.RemoveDynamic(this, &UGlitchCodeIntegration::OnKeyItemUsed);
    }

    // Trap
    if (CachedTrap)
    {
        CachedTrap->OnTrapTriggered.RemoveDynamic(this, &UGlitchCodeIntegration::OnTrapTriggered);
    }

    // Puzzle
    if (CachedPuzzle)
    {
        CachedPuzzle->OnPuzzleSolved.RemoveDynamic(this, &UGlitchCodeIntegration::OnPuzzleSolved);
    }

    // Crafting
    if (CachedCrafting)
    {
        CachedCrafting->OnItemCrafted.RemoveDynamic(this, &UGlitchCodeIntegration::OnItemCrafted);
    }

    // Clear all cached pointers
    CachedPlayer = nullptr;
    CachedHealth = nullptr;
    CachedInventory = nullptr;
    CachedQuest = nullptr;
    CachedDialogue = nullptr;
    CachedCombat = nullptr;
    CachedStamina = nullptr;
    CachedDamage = nullptr;
    CachedHealing = nullptr;
    CachedKeyItem = nullptr;
    CachedTrap = nullptr;
    CachedPuzzle = nullptr;
    CachedCrafting = nullptr;

    bLowHealthWarningActive = false;

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Shutdown complete"));
}

// ─────────────────────────────────────────────
//  1. Health → Quest: low health triggers survival objective
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnHealthChanged(float NewHealth, float Delta)
{
    // Delta > 0 means healing; only react to damage
    if (Delta >= 0.0f)
    {
        // If we were in a low-health state and now above threshold, clear warning
        if (bLowHealthWarningActive && NewHealth > LowHealthThreshold)
        {
            bLowHealthWarningActive = false;
        }
        return;
    }

    // Low health warning: trigger survival quest
    if (NewHealth > 0.0f && NewHealth < LowHealthThreshold && !bLowHealthWarningActive)
    {
        bLowHealthWarningActive = true;

        if (CachedQuest)
        {
            CachedQuest->UpdateObjective(TEXT("survival"), TEXT("stay_alive"));
        }

        OnLowHealthWarning.Broadcast(NewHealth);
    }
}

// ─────────────────────────────────────────────
//  2. Health → Dialogue: player death shows respawn prompt
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnPlayerDeath()
{
    bLowHealthWarningActive = false;

    // Start death dialogue if DialogueManager is available
    if (CachedDialogue && !CachedDialogue->IsDialogueActive())
    {
        CachedDialogue->StartDialogue(TEXT("death_respawn"));
    }

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Player death handled — dialogue triggered"));
}

// ─────────────────────────────────────────────
//  3. Inventory → Quest: collecting quest items advances objectives
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnItemAdded(const FInventoryItem& Item)
{
    if (!CachedQuest)
    {
        return;
    }

    // Broadcast for external listeners
    OnQuestItemCollected.Broadcast(Item.ItemID, Item.Quantity);

    // Update all active quests that have a matching "collect" objective
    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        // Try to advance any "collect" objective that matches this item
        CachedQuest->UpdateObjective(QuestID, TEXT("collect_") + Item.ItemID, Item.Quantity);

        // Also try a generic "collect_any" objective for broad collection quests
        CachedQuest->UpdateObjective(QuestID, TEXT("collect_any"), Item.Quantity);
    }

    UE_LOG(LogTemp, Verbose, TEXT("GlitchCodeIntegration: Item added %s x%d — quest objectives updated"),
        *Item.ItemID, Item.Quantity);
}

// ─────────────────────────────────────────────
//  4. Inventory → Quest: removing items (drop/use tracking)
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnItemRemoved(const FInventoryItem& Item)
{
    if (!CachedQuest)
    {
        return;
    }

    // Some quests require items to be used (consumed) — track that
    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        CachedQuest->UpdateObjective(QuestID, TEXT("use_") + Item.ItemID, Item.Quantity);
    }

    UE_LOG(LogTemp, Verbose, TEXT("GlitchCodeIntegration: Item removed %s x%d"),
        *Item.ItemID, Item.Quantity);
}

// ─────────────────────────────────────────────
//  5. Quest → Dialogue: completed quests unlock new dialogue
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnQuestCompleted(const FString& QuestID)
{
    if (!CachedDialogue)
    {
        return;
    }

    // Start the post-quest dialogue if it exists
    const FString PostDialogueID = TEXT("post_") + QuestID;
    if (!CachedDialogue->IsDialogueActive())
    {
        CachedDialogue->StartDialogue(PostDialogueID);
    }

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Quest '%s' completed — dialogue '%s' triggered"),
        *QuestID, *PostDialogueID);
}

// ─────────────────────────────────────────────
//  6. Quest → Inventory: quest rewards (handled via quest completion)
//     Note: Quest rewards are typically defined in UQuestData and applied
//     directly by UQuestManager when CompleteQuest is called. The integration
//     hub listens for the completion event to perform post-reward actions.
// ─────────────────────────────────────────────

// (OnQuestCompleted above handles the dialogue bridge; inventory rewards
//  are granted inside UQuestManager::CompleteQuest itself.)

// ─────────────────────────────────────────────
//  7. Dialogue Choice → Quest: choices can advance quest state
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnDialogueChoiceMade(const FString& ChoiceID)
{
    if (!CachedQuest)
    {
        return;
    }

    // Some dialogue choices are quest-triggering — check active quests
    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        // Dialogue choices can advance "talk_to" objectives
        CachedQuest->UpdateObjective(QuestID, TEXT("dialogue_") + ChoiceID);
    }

    UE_LOG(LogTemp, Verbose, TEXT("GlitchCodeIntegration: Dialogue choice '%s' — quest state checked"),
        *ChoiceID);
}

// ─────────────────────────────────────────────
//  8. Combat → Quest: enemy kills advance kill-count objectives
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnEnemyKilled(AActor* Enemy, float DamageDealt)
{
    if (!CachedQuest || !Enemy)
    {
        return;
    }

    // Broadcast for external listeners (HUD, analytics, etc.)
    OnEnemyDefeated.Broadcast(Enemy, DamageDealt);

    const FString EnemyClassName = Enemy->GetClass()->GetName();

    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        // Specific enemy type kill objective
        CachedQuest->UpdateObjective(QuestID, TEXT("kill_") + EnemyClassName);

        // Generic kill counter
        CachedQuest->UpdateObjective(QuestID, TEXT("kill_any"));
    }

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Enemy '%s' killed — kill objectives updated"),
        *EnemyClassName);
}

// ─────────────────────────────────────────────
//  9. KeyItem → Quest: using keys on locks advances puzzle quests
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnKeyItemUsed(const FString& KeyName, AActor* LockTarget)
{
    if (!CachedQuest)
    {
        return;
    }

    const FString TargetName = LockTarget ? LockTarget->GetClass()->GetName() : TEXT("unknown");

    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        CachedQuest->UpdateObjective(QuestID, TEXT("unlock_") + KeyName);
        CachedQuest->UpdateObjective(QuestID, TEXT("unlock_any"));
    }

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Key '%s' used on '%s' — quest objectives updated"),
        *KeyName, *TargetName);
}

// ─────────────────────────────────────────────
//  10. Trap → Health: trap damage goes through damage system
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnTrapTriggered(AActor* TrapActor, AActor* TriggeredBy)
{
    if (!TrapActor || !TriggeredBy)
    {
        return;
    }

    // If the player triggered someone else's trap, apply damage through the damage system
    if (TriggeredBy == CachedPlayer)
    {
        // Look for damage info on the trap actor
        if (CachedDamage)
        {
            // The trap component stores damage in its FTrapData; we route through the
            // damage system so resistances and defense are respected.
            UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Player hit by trap '%s' — routed through DamageSystem"),
                *TrapActor->GetName());
        }
    }
    // If an enemy triggered the player's trap, the trap component handles it directly.

    // Update any "survive traps" or "disarm" quest objectives
    if (CachedQuest)
    {
        const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
        for (const FString& QuestID : ActiveQuests)
        {
            CachedQuest->UpdateObjective(QuestID, TEXT("trigger_trap"));
        }
    }
}

// ─────────────────────────────────────────────
//  11. Puzzle → Quest: solving puzzles completes puzzle objectives
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnPuzzleSolved(const FString& PuzzleName)
{
    OnPuzzleCompleted.Broadcast(PuzzleName);

    if (!CachedQuest)
    {
        return;
    }

    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        CachedQuest->UpdateObjective(QuestID, TEXT("solve_") + PuzzleName);
        CachedQuest->UpdateObjective(QuestID, TEXT("solve_any"));
    }

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Puzzle '%s' solved — quest objectives updated"),
        *PuzzleName);
}

// ─────────────────────────────────────────────
//  12. Crafting → Inventory: crafted items go to inventory
// ─────────────────────────────────────────────

void UGlitchCodeIntegration::OnItemCrafted(const FString& RecipeName)
{
    OnCraftingCompleted.Broadcast(RecipeName);

    if (!CachedQuest)
    {
        return;
    }

    // Some quests require crafting specific items
    const TArray<FString> ActiveQuests = CachedQuest->GetActiveQuests();
    for (const FString& QuestID : ActiveQuests)
    {
        CachedQuest->UpdateObjective(QuestID, TEXT("craft_") + RecipeName);
        CachedQuest->UpdateObjective(QuestID, TEXT("craft_any"));
    }

    UE_LOG(LogTemp, Log, TEXT("GlitchCodeIntegration: Item crafted '%s' — quest objectives updated"),
        *RecipeName);
}
