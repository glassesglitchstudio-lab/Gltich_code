#include "USaveTrigger.h"
#include "USaveManager.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"
#include "Components/BoxComponent.h"

AUSaveTrigger::AUSaveTrigger()
{
    PrimaryActorTick.bCanEverTick = false;

    TriggerVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("TriggerVolume"));
    RootComponent = TriggerVolume;
    TriggerVolume->SetBoxExtent(FVector(200.0f, 200.0f, 100.0f));
    TriggerVolume->SetCollisionProfileName(TEXT("Trigger"));
    TriggerVolume->SetGenerateOverlapEvents(true);

    // Set default collision to overlap with pawn
    TriggerVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
}

void AUSaveTrigger::BeginPlay()
{
    Super::BeginPlay();

    // Cache save manager reference
    if (UGameInstance* GI = UGameplayStatics::GetGameInstance(this))
    {
        CachedSaveManager = GI->GetSubsystem<USaveManager>();
    }

    // Bind overlap events
    TriggerVolume->OnComponentBeginOverlap.AddDynamic(this, &AUSaveTrigger::OnOverlapBegin);
    TriggerVolume->OnComponentEndOverlap.AddDynamic(this, &AUSaveTrigger::OnOverlapEnd);
}

void AUSaveTrigger::OnOverlapBegin(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    // Check if the overlapping actor is the player
    if (!OtherActor || !OtherActor->IsA<ACharacter>())
    {
        return;
    }

    // Prevent multiple triggers in the same session
    if (bHasTriggeredThisSession)
    {
        return;
    }

    bHasTriggeredThisSession = true;

    if (bAutoSaveOnOverlap && CachedSaveManager)
    {
        // Perform the save
        bool bSuccess = CachedSaveManager->SaveGame(CheckpointName, CheckpointIndex);

        if (bSuccess)
        {
            OnCheckpointReached(CheckpointName, CheckpointIndex);

            if (bShowNotification)
            {
                FString NotificationMessage = FString::Printf(
                    TEXT("Checkpoint reached: %s"),
                    *CheckpointName
                );
                OnSaveNotification(NotificationMessage);

                // Log to console for debugging
                UE_LOG(LogTemp, Log, TEXT("SaveTrigger: Checkpoint '%s' triggered at %s"),
                    *CheckpointName,
                    *GetActorLocation().ToString());
            }
        }
    }
}

void AUSaveTrigger::OnOverlapEnd(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex)
{
    // Reset trigger flag when player leaves the area
    // This allows the checkpoint to trigger again if the player re-enters
    if (OtherActor && OtherActor->IsA<ACharacter>())
    {
        bHasTriggeredThisSession = false;
    }
}
