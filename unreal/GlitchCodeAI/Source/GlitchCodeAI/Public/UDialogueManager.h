#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UDialogueNode.h"
#include "UDialogueData.h"
#include "UDialogueManager.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDialogueStarted, const FString&, DialogueID);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnDialogueNodeChanged, const FString&, NodeID, const FString&, SpeakerName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDialogueEnded, const FString&, DialogueID);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnChoiceMade, const FString&, ChoiceID);

UCLASS(ClassGroup=(GlitchCodeAI), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UDialogueManager : public UActorComponent
{
    GENERATED_BODY()

public:
    UDialogueManager();

    // --- Delegates ---
    UPROPERTY(BlueprintAssignable, Category = "Dialogue|Events")
    FOnDialogueStarted OnDialogueStarted;

    UPROPERTY(BlueprintAssignable, Category = "Dialogue|Events")
    FOnDialogueNodeChanged OnDialogueNodeChanged;

    UPROPERTY(BlueprintAssignable, Category = "Dialogue|Events")
    FOnDialogueEnded OnDialogueEnded;

    UPROPERTY(BlueprintAssignable, Category = "Dialogue|Events")
    FOnChoiceMade OnChoiceMade;

    // --- Dialogue Control ---
    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    bool StartDialogue(const FString& DialogueID);

    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    bool SelectChoice(const FString& ChoiceID);

    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    bool AdvanceDialogue();

    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    void EndDialogue();

    // --- Queries ---
    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Dialogue")
    UDialogueNode* GetCurrentNode() const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Dialogue")
    TArray<FDialogueChoice> GetAvailableChoices() const;

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Dialogue")
    bool IsDialogueActive() const { return bIsActive; }

    UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Dialogue")
    FString GetCurrentDialogueID() const { return CurrentDialogueID; }

    // --- Data Management ---
    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    void RegisterDialogueData(UDialogueData* DialogueData);

    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    UDialogueData* GetDialogueData(const FString& DialogueID) const;

    virtual void BeginPlay() override;

private:
    UPROPERTY()
    TMap<FString, UDialogueData*> DialogueDataMap;

    UPROPERTY()
    UDialogueData* CurrentDialogueData = nullptr;

    UPROPERTY()
    UDialogueNode* CurrentNode = nullptr;

    FString CurrentDialogueID;
    bool bIsActive = false;

    bool CheckChoiceRequirements(const FDialogueChoice& Choice) const;
};
