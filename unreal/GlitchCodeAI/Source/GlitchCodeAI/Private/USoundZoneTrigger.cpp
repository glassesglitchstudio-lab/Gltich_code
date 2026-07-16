#include "USoundZoneTrigger.h"
#include "UAmbientSoundManager.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"
#include "Components/SphereComponent.h"

AUSoundZoneTrigger::AUSoundZoneTrigger()
{
    PrimaryActorTick.bCanEverTick = false;

    TriggerVolume = CreateDefaultSubobject<USphereComponent>(TEXT("TriggerVolume"));
    RootComponent = TriggerVolume;
    TriggerVolume->SetSphereRadius(1000.0f);
    TriggerVolume->SetCollisionProfileName(TEXT("Trigger"));
    TriggerVolume->SetGenerateOverlapEvents(true);
    TriggerVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
}

void AUSoundZoneTrigger::BeginPlay()
{
    Super::BeginPlay();

    if (UGameInstance* GI = UGameplayStatics::GetGameInstance(this))
    {
        CachedSoundManager = GI->GetSubsystem<UAmbientSoundManager>();
    }

    // Register as a sound zone if enabled
    if (bRegisterAsSoundZone && CachedSoundManager && !AmbientSoundPath.IsEmpty())
    {
        float ZoneRadius = SoundZoneRadius > 0.0f
            ? SoundZoneRadius
            : TriggerVolume->GetScaledSphereRadius();

        RegisteredZoneID = CachedSoundManager->AddSoundZone(
            GetActorLocation(),
            ZoneRadius,
            AmbientSoundPath
        );
    }

    TriggerVolume->OnComponentBeginOverlap.AddDynamic(this, &AUSoundZoneTrigger::OnOverlapBegin);
    TriggerVolume->OnComponentEndOverlap.AddDynamic(this, &AUSoundZoneTrigger::OnOverlapEnd);
}

void AUSoundZoneTrigger::OnOverlapBegin(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    if (!OtherActor || !OtherActor->IsA<ACharacter>())
    {
        return;
    }

    if (bPlayerInside)
    {
        return;
    }

    bPlayerInside = true;

    // Play zone ambient sound
    if (CachedSoundManager && !AmbientSoundPath.IsEmpty())
    {
        ActiveSoundID = CachedSoundManager->PlayAmbientSound(
            AmbientSoundPath,
            GetActorLocation(),
            ZoneVolume,
            FadeInDuration
        );
    }

    OnPlayerEnteredZone(ZoneName);

    UE_LOG(LogTemp, Log, TEXT("SoundZoneTrigger: Player entered zone '%s'"), *ZoneName);
}

void AUSoundZoneTrigger::OnOverlapEnd(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex)
{
    if (!OtherActor || !OtherActor->IsA<ACharacter>())
    {
        return;
    }

    if (!bPlayerInside)
    {
        return;
    }

    bPlayerInside = false;

    // Stop zone ambient sound
    if (CachedSoundManager && ActiveSoundID >= 0)
    {
        CachedSoundManager->StopAmbientSound(ActiveSoundID, FadeOutDuration);
        ActiveSoundID = -1;
    }

    // Play exit sound if configured
    if (CachedSoundManager && !ExitSoundPath.IsEmpty())
    {
        CachedSoundManager->PlayAmbientSound(
            ExitSoundPath,
            GetActorLocation(),
            ZoneVolume * 0.5f,
            0.5f
        );
    }

    OnPlayerExitedZone(ZoneName);

    UE_LOG(LogTemp, Log, TEXT("SoundZoneTrigger: Player exited zone '%s'"), *ZoneName);
}
