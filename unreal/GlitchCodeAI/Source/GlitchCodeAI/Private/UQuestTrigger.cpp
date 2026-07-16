#include "UQuestTrigger.h"
#include "UQuestManager.h"
#include "GameFramework/Character.h"
#include "Components/PrimitiveComponent.h"

UQuestTrigger::UQuestTrigger()
{
    BoxExtent = FVector(100.0f, 100.0f, 50.0f);
    SetCollisionProfileName("OverlapAllDynamic");
    SetGenerateOverlapEvents(true);
}

void UQuestTrigger::BeginPlay()
{
    Super::BeginPlay();

    OnComponentBeginOverlap.AddDynamic(this, &UQuestTrigger::OnOverlapBegin);
}

void UQuestTrigger::OnOverlapBegin(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    if (bTriggerOnce && bHasTriggered)
    {
        return;
    }

    if (!OtherActor)
    {
        return;
    }

    if (!RequiredTag.IsEmpty() && !OtherActor->Tags.Contains(FName(*RequiredTag)))
    {
        return;
    }

    UQuestManager* QuestManager = FindQuestManager();
    if (!QuestManager)
    {
        return;
    }

    if (bAutoAccept)
    {
        bool bAccepted = QuestManager->AcceptQuest(QuestIDToGrant);
        if (bAccepted)
        {
            bHasTriggered = true;
        }
    }
}

void UQuestTrigger::HandleQuestCompleted(const FString& CompletedQuestID)
{
    if (CompletedQuestID == QuestIDToGrant)
    {
        bHasTriggered = false;
    }
}

UQuestManager* UQuestTrigger::FindQuestManager() const
{
    UWorld* World = GetWorld();
    if (!World)
    {
        return nullptr;
    }

    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        UQuestManager* Manager = Actor->FindComponentByClass<UQuestManager>();
        if (Manager)
        {
            return Manager;
        }
    }

    APlayerController* PC = World->GetFirstPlayerController();
    if (PC && PC->GetPawn())
    {
        return PC->GetPawn()->FindComponentByClass<UQuestManager>();
    }

    return nullptr;
}
