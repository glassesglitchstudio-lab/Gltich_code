#include "UDialogueTrigger.h"
#include "UDialogueManager.h"
#include "GameFramework/Character.h"
#include "Components/PrimitiveComponent.h"
#include "Kismet/GameplayStatics.h"

UDialogueTrigger::UDialogueTrigger()
{
    BoxExtent = FVector(100.0f, 100.0f, 50.0f);
    SetCollisionProfileName("OverlapAllDynamic");
    SetGenerateOverlapEvents(true);
    PrimaryComponentTick.bCanEverTick = true;
}

void UDialogueTrigger::BeginPlay()
{
    Super::BeginPlay();

    OnComponentBeginOverlap.AddDynamic(this, &UDialogueTrigger::OnOverlapBegin);
    OnComponentEndOverlap.AddDynamic(this, &UDialogueTrigger::OnOverlapEnd);

    UDialogueManager* Manager = FindDialogueManager();
    if (Manager)
    {
        Manager->OnDialogueEnded.AddDynamic(this, &UDialogueTrigger::OnDialogueEnded);
    }
}

void UDialogueTrigger::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bPlayerInRange || bHasTriggered || bAutoStart)
    {
        return;
    }

    APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
    if (PC && PC->WasInputKeyJustPressed(EKeys::E))
    {
        TryStartDialogue();
    }
}

void UDialogueTrigger::OnOverlapBegin(
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

    bPlayerInRange = true;
    OverlappingActor = OtherActor;
    bPromptVisible = true;

    if (bAutoStart)
    {
        TryStartDialogue();
    }
}

void UDialogueTrigger::OnOverlapEnd(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex)
{
    if (OtherActor == OverlappingActor)
    {
        bPlayerInRange = false;
        OverlappingActor = nullptr;
        bPromptVisible = false;
    }
}

void UDialogueTrigger::TryStartDialogue()
{
    UDialogueManager* Manager = FindDialogueManager();
    if (!Manager)
    {
        return;
    }

    bool bStarted = Manager->StartDialogue(DialogueIDToStart);
    if (bStarted)
    {
        bHasTriggered = true;
        bPromptVisible = false;
    }
}

void UDialogueTrigger::OnDialogueEnded(const FString& EndedDialogueID)
{
    if (EndedDialogueID == DialogueIDToStart && bTriggerOnce)
    {
        bHasTriggered = false;
    }
}

UDialogueManager* UDialogueTrigger::FindDialogueManager() const
{
    UWorld* World = GetWorld();
    if (!World)
    {
        return nullptr;
    }

    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        UDialogueManager* Manager = Actor->FindComponentByClass<UDialogueManager>();
        if (Manager)
        {
            return Manager;
        }
    }

    APlayerController* PC = World->GetFirstPlayerController();
    if (PC && PC->GetPawn())
    {
        return PC->GetPawn()->FindComponentByClass<UDialogueManager>();
    }

    return nullptr;
}
