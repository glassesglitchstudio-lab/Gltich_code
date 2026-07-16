#include "UDialogueManager.h"
#include "UInventoryComponent.h"
#include "UQuestManager.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"

UDialogueManager::UDialogueManager()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UDialogueManager::BeginPlay()
{
    Super::BeginPlay();
}

bool UDialogueManager::StartDialogue(const FString& DialogueID)
{
    if (bIsActive)
    {
        return false;
    }

    UDialogueData* DialogueData = GetDialogueData(DialogueID);
    if (!DialogueData)
    {
        return false;
    }

    UDialogueNode* StartNode = DialogueData->FindNode(DialogueData->StartNodeID);
    if (!StartNode)
    {
        return false;
    }

    CurrentDialogueData = DialogueData;
    CurrentNode = StartNode;
    CurrentDialogueID = DialogueID;
    bIsActive = true;

    OnDialogueStarted.Broadcast(DialogueID);
    OnDialogueNodeChanged.Broadcast(CurrentNode->NodeID, CurrentNode->SpeakerName);
    return true;
}

bool UDialogueManager::SelectChoice(const FString& ChoiceID)
{
    if (!bIsActive || !CurrentNode)
    {
        return false;
    }

    for (const FDialogueChoice& Choice : CurrentNode->Choices)
    {
        if (Choice.ChoiceID == ChoiceID)
        {
            if (!CheckChoiceRequirements(Choice))
            {
                return false;
            }

            OnChoiceMade.Broadcast(ChoiceID);

            if (Choice.NextNodeID.IsEmpty())
            {
                EndDialogue();
                return true;
            }

            UDialogueNode* NextNode = CurrentDialogueData->FindNode(Choice.NextNodeID);
            if (NextNode)
            {
                CurrentNode = NextNode;
                OnDialogueNodeChanged.Broadcast(CurrentNode->NodeID, CurrentNode->SpeakerName);

                if (CurrentNode->bIsEndNode)
                {
                    EndDialogue();
                }
                return true;
            }
            return false;
        }
    }
    return false;
}

bool UDialogueManager::AdvanceDialogue()
{
    if (!bIsActive || !CurrentNode)
    {
        return false;
    }

    if (CurrentNode->bIsEndNode || (!CurrentNode->Choices.IsEmpty()))
    {
        return false;
    }

    if (CurrentNode->NextNodeID.IsEmpty())
    {
        EndDialogue();
        return true;
    }

    UDialogueNode* NextNode = CurrentDialogueData->FindNode(CurrentNode->NextNodeID);
    if (NextNode)
    {
        CurrentNode = NextNode;
        OnDialogueNodeChanged.Broadcast(CurrentNode->NodeID, CurrentNode->SpeakerName);

        if (CurrentNode->bIsEndNode)
        {
            EndDialogue();
        }
        return true;
    }

    EndDialogue();
    return true;
}

void UDialogueManager::EndDialogue()
{
    if (!bIsActive)
    {
        return;
    }

    FString EndedDialogueID = CurrentDialogueID;
    bIsActive = false;
    CurrentNode = nullptr;
    CurrentDialogueData = nullptr;
    CurrentDialogueID.Empty();

    OnDialogueEnded.Broadcast(EndedDialogueID);
}

UDialogueNode* UDialogueManager::GetCurrentNode() const
{
    return CurrentNode;
}

TArray<FDialogueChoice> UDialogueManager::GetAvailableChoices() const
{
    TArray<FDialogueChoice> Available;
    if (!CurrentNode)
    {
        return Available;
    }

    for (const FDialogueChoice& Choice : CurrentNode->Choices)
    {
        if (!Choice.bHidden && CheckChoiceRequirements(Choice))
        {
            Available.Add(Choice);
        }
    }
    return Available;
}

bool UDialogueManager::CheckChoiceRequirements(const FDialogueChoice& Choice) const
{
    if (Choice.bRequiresItem)
    {
        AActor* Owner = GetOwner();
        if (!Owner)
        {
            return false;
        }

        UInventoryComponent* Inventory = Owner->FindComponentByClass<UInventoryComponent>();
        if (!Inventory || !Inventory->HasItem(Choice.RequiredItemID))
        {
            return false;
        }
    }

    if (Choice.bRequiresQuest)
    {
        AActor* Owner = GetOwner();
        if (!Owner)
        {
            return false;
        }

        UQuestManager* QuestManager = Owner->FindComponentByClass<UQuestManager>();
        if (!QuestManager)
        {
            UWorld* World = GetWorld();
            if (World)
            {
                for (TActorIterator<AActor> It(World); It; ++It)
                {
                    UQuestManager* Found = It->FindComponentByClass<UQuestManager>();
                    if (Found)
                    {
                        QuestManager = Found;
                        break;
                    }
                }
            }
        }

        if (!QuestManager || !QuestManager->IsQuestCompleted(Choice.RequiredQuestID))
        {
            return false;
        }
    }

    return true;
}

void UDialogueManager::RegisterDialogueData(UDialogueData* DialogueData)
{
    if (DialogueData && !DialogueData->DialogueID.IsEmpty())
    {
        DialogueDataMap.Add(DialogueData->DialogueID, DialogueData);
    }
}

UDialogueData* UDialogueManager::GetDialogueData(const FString& DialogueID) const
{
    return DialogueDataMap.FindRef(DialogueID);
}
