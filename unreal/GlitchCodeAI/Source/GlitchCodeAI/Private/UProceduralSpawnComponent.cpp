#include "UProceduralSpawnComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SphereComponent.h"
#include "Components/BillboardComponent.h"
#include "Engine/World.h"
#include "Engine/Texture2D.h"

ASpawnPointMarker::ASpawnPointMarker()
{
    PrimaryActorTick.bCanEverTick = false;

    // Root component
    USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    // Trigger volume
    TriggerVolume = CreateDefaultSubobject<USphereComponent>(TEXT("TriggerVolume"));
    TriggerVolume->SetupAttachment(Root);
    TriggerVolume->SetSphereRadius(150.0f);
    TriggerVolume->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
    TriggerVolume->SetGenerateOverlapEvents(true);
    TriggerVolume->OnComponentBeginOverlap.AddDynamic(this, &ASpawnPointMarker::OnOverlapBegin);

    // Visible marker mesh
    MarkerMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MarkerMesh"));
    MarkerMesh->SetupAttachment(Root);
    MarkerMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    MarkerMesh->SetMobility(EComponentMobility::Movable);

    // Billboard for editor visibility
    Billboard = CreateDefaultSubobject<UBillboardComponent>(TEXT("Billboard"));
    Billboard->SetupAttachment(Root);
    Billboard->SetScreenSize(0.005f);
}

void ASpawnPointMarker::OnOverlapBegin(
    UPrimitiveComponent* OverlappedComp,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    if (!OtherActor || OtherActor == this) return;

    // Notify any UProceduralSpawnComponent on the overlapping actor's owner
    UProceduralSpawnComponent* SpawnComp = OtherActor->FindComponentByClass<UProceduralSpawnComponent>();
    if (!SpawnComp)
    {
        // Search the world for the spawn component
        TArray<AActor*> AllActors;
        UGameplayStatics::GetAllActorsOfClass(GetWorld(), AActor::StaticClass(), AllActors);
        for (AActor* Actor : AllActors)
        {
            SpawnComp = Actor->FindComponentByClass<UProceduralSpawnComponent>();
            if (SpawnComp) break;
        }
    }

    if (SpawnComp)
    {
        // Broadcast the spawn event with the marker's name and the overlapping actor
        FString MarkerName = GetActorLabel();
        SpawnComp->OnSpawnPointActivated.Broadcast(MarkerName, OtherActor);
    }
}

// --- UProceduralSpawnComponent ---

UProceduralSpawnComponent::UProceduralSpawnComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

int32 UProceduralSpawnComponent::FindSpawnIndex(const FString& Name) const
{
    for (int32 i = 0; i < SpawnPoints.Num(); ++i)
    {
        if (SpawnPoints[i].SpawnName == Name) return i;
    }
    return INDEX_NONE;
}

FString UProceduralSpawnComponent::CreateSpawnPoint(const FString& Type, const FVector& Location)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralSpawn: GetWorld() returned null"));
        return FString();
    }

    FString NewName = FString::Printf(TEXT("Spawn_%s_%d"), *Type, SpawnPoints.Num());

    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = GetOwner();
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    // Spawn the marker actor
    ASpawnPointMarker* Marker = World->SpawnActor<ASpawnPointMarker>(
        ASpawnPointMarker::StaticClass(),
        Location,
        FRotator::ZeroRotator,
        SpawnParams);

    if (Marker)
    {
        // Set marker label
        Marker->SetActorLabel(NewName);

        // Load a sphere mesh for visibility
        UStaticMesh* SphereMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere"));
        if (SphereMesh && Marker->MarkerMesh)
        {
            Marker->MarkerMesh->SetStaticMesh(SphereMesh);
            Marker->MarkerMesh->SetWorldScale3D(FVector(0.3f));
            Marker->MarkerMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        }

        // Color the billboard green for player spawn, red for enemy spawn
        FLinearColor MarkerColor = Type.Equals(TEXT("Player"), ESearchCase::IgnoreCase)
            ? FLinearColor::Green
            : FLinearColor::Red;
    }

    FSpawnPoint NewSpawn;
    NewSpawn.SpawnName = NewName;
    NewSpawn.SpawnType = Type;
    NewSpawn.Location = Location;
    NewSpawn.SpawnMarker = Marker;
    SpawnPoints.Add(NewSpawn);

    UE_LOG(LogTemp, Log, TEXT("ProceduralSpawn: Created '%s' type='%s' at %s"), *NewName, *Type, *Location.ToString());
    return NewName;
}

bool UProceduralSpawnComponent::RemoveSpawnPoint(const FString& Name)
{
    int32 Index = FindSpawnIndex(Name);
    if (Index == INDEX_NONE) return false;

    FSpawnPoint& Spawn = SpawnPoints[Index];
    if (Spawn.SpawnMarker)
    {
        Spawn.SpawnMarker->Destroy();
    }

    SpawnPoints.RemoveAt(Index);
    UE_LOG(LogTemp, Log, TEXT("ProceduralSpawn: Removed '%s'"), *Name);
    return true;
}

TArray<FString> UProceduralSpawnComponent::ListSpawnPoints()
{
    TArray<FString> Names;
    for (const FSpawnPoint& S : SpawnPoints) Names.Add(S.SpawnName);
    return Names;
}

bool UProceduralSpawnComponent::SetSpawnPoint(const FString& Name, const FVector& Location)
{
    int32 Index = FindSpawnIndex(Name);
    if (Index == INDEX_NONE) return false;

    FSpawnPoint& Spawn = SpawnPoints[Index];
    Spawn.Location = Location;

    if (Spawn.SpawnMarker)
    {
        Spawn.SpawnMarker->SetActorLocation(Location);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralSpawn: Moved '%s' to %s"), *Name, *Location.ToString());
    return true;
}

void UProceduralSpawnComponent::ClearAllSpawnPoints()
{
    for (FSpawnPoint& Spawn : SpawnPoints)
    {
        if (Spawn.SpawnMarker)
        {
            Spawn.SpawnMarker->Destroy();
        }
    }
    SpawnPoints.Empty();
    UE_LOG(LogTemp, Log, TEXT("ProceduralSpawn: Cleared all spawn points"));
}
