#include "UProceduralCorridorComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "Kismet/KismetMathLibrary.h"

UProceduralCorridorComponent::UProceduralCorridorComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

int32 UProceduralCorridorComponent::FindCorridorIndex(const FString& Name) const
{
    for (int32 i = 0; i < Corridors.Num(); ++i)
    {
        if (Corridors[i].CorridorName == Name) return i;
    }
    return INDEX_NONE;
}

FString UProceduralCorridorComponent::CreateCorridor(const FString& From, const FString& To, float Width, const FString& Type)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralCorridor: GetWorld() returned null"));
        return FString();
    }

    // Parse room positions from name format "Room_Type_N" — use simple offset approach
    FVector FromPos = FVector(Corridors.Num() * 2000.0f, 0.0f, 0.0f);
    FVector ToPos = FVector(Corridors.Num() * 2000.0f + 1000.0f, 0.0f, 0.0f);

    FString NewName = FString::Printf(TEXT("Corridor_%d"), Corridors.Num());
    FVector MidPoint = (FromPos + ToPos) / 2.0f;
    FVector Direction = ToPos - FromPos;
    float Distance = Direction.Size();

    // Calculate rotation from corridor direction
    FRotator LookAtRotation = UKismetMathLibrary::FindLookAtRotation(FromPos, ToPos);

    FProceduralCorridor NewCorr;
    NewCorr.CorridorName = NewName;
    NewCorr.FromRoom = From;
    NewCorr.ToRoom = To;
    NewCorr.Width = Width;
    NewCorr.CorridorType = Type;

    // Spawn corridor mesh
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = GetOwner();
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    AStaticMeshActor* CorridorMesh = World->SpawnActor<AStaticMeshActor>(
        AStaticMeshActor::StaticClass(),
        MidPoint,
        LookAtRotation,
        SpawnParams);

    if (CorridorMesh)
    {
        UStaticMesh* CubeMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube"));
        if (CubeMesh)
        {
            CorridorMesh->GetStaticMeshComponent()->SetStaticMesh(CubeMesh);
        }
        CorridorMesh->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
        CorridorMesh->SetActorScale3D(FVector(Distance / 100.0f, Width / 100.0f, 0.3f));
        NewCorr.CorridorMeshActor = CorridorMesh;
    }

    // Spawn trigger volumes at each end of the corridor
    for (int32 End = 0; End < 2; ++End)
    {
        FVector TriggerLocation = (End == 0) ? FromPos : ToPos;

        AActor* TriggerActor = World->SpawnActor<AActor>(
            AActor::StaticClass(),
            TriggerLocation,
            FRotator::ZeroRotator,
            SpawnParams);

        if (TriggerActor)
        {
            UBoxComponent* TriggerBox = NewObject<UBoxComponent>(TriggerActor);
            TriggerBox->SetupAttachment(TriggerActor->GetRootComponent());
            TriggerBox->SetBoxExtent(FVector(50.0f, Width / 2.0f, 150.0f));
            TriggerBox->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
            TriggerBox->SetGenerateOverlapEvents(true);
            TriggerBox->RegisterComponent();
            NewCorr.TriggerVolumes.Add(TriggerActor);
        }
    }

    Corridors.Add(NewCorr);
    UE_LOG(LogTemp, Log, TEXT("ProceduralCorridor: Created '%s' from '%s' to '%s' (distance=%.0f)"),
        *NewName, *From, *To, Distance);
    return NewName;
}

bool UProceduralCorridorComponent::DeleteCorridor(const FString& Name)
{
    int32 Index = FindCorridorIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralCorridor& Corr = Corridors[Index];
    if (Corr.CorridorMeshActor)
    {
        Corr.CorridorMeshActor->Destroy();
    }
    for (AActor* Trigger : Corr.TriggerVolumes)
    {
        if (Trigger) Trigger->Destroy();
    }
    Corr.TriggerVolumes.Empty();

    Corridors.RemoveAt(Index);
    UE_LOG(LogTemp, Log, TEXT("ProceduralCorridor: Deleted '%s'"), *Name);
    return true;
}

TArray<FString> UProceduralCorridorComponent::ListCorridors()
{
    TArray<FString> Names;
    for (const FProceduralCorridor& C : Corridors) Names.Add(C.CorridorName);
    return Names;
}

bool UProceduralCorridorComponent::ResizeCorridor(const FString& Name, float Width)
{
    int32 Index = FindCorridorIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralCorridor& Corr = Corridors[Index];
    Corr.Width = Width;

    if (Corr.CorridorMeshActor)
    {
        FVector CurrentScale = Corr.CorridorMeshActor->GetActorScale3D();
        Corr.CorridorMeshActor->SetActorScale3D(FVector(CurrentScale.X, Width / 100.0f, CurrentScale.Z));
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralCorridor: Resized '%s' width=%.0f"), *Name, Width);
    return true;
}

bool UProceduralCorridorComponent::SetStyle(const FString& Name, const FString& Style)
{
    int32 Index = FindCorridorIndex(Name);
    if (Index == INDEX_NONE) return false;
    Corridors[Index].Style = Style;
    UE_LOG(LogTemp, Log, TEXT("ProceduralCorridor: Style set '%s' -> '%s'"), *Name, *Style);
    return true;
}
