#include "UProceduralPropsComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"

UProceduralPropsComponent::UProceduralPropsComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

int32 UProceduralPropsComponent::ScatterProps(
    const FString& Category,
    const FVector& RoomOrigin,
    float RoomWidth,
    float RoomDepth,
    int32 Seed)
{
    CurrentSeed = Seed;
    FRandomStream Rand(Seed);

    UWorld* World = GetWorld();
    if (!World)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralProps: GetWorld() returned null"));
        return 0;
    }

    float Density = 1.0f;
    if (float* FoundDensity = CategoryDensity.Find(Category))
    {
        Density = *FoundDensity;
    }

    int32 Count = FMath::Max(1, FMath::RoundToInt(Density * (RoomWidth / 100.0f) * (RoomDepth / 100.0f)));

    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = GetOwner();
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

    float HalfW = RoomWidth / 2.0f;
    float HalfD = RoomDepth / 2.0f;

    for (int32 i = 0; i < Count; ++i)
    {
        // Deterministic random position within room bounds
        float X = RoomOrigin.X + Rand.FRandRange(-HalfW + 20.0f, HalfW - 20.0f);
        float Y = RoomOrigin.Y + Rand.FRandRange(-HalfD + 20.0f, HalfD - 20.0f);
        float Z = RoomOrigin.Z;
        FVector PropLocation = FVector(X, Y, Z);

        FRotator PropRotation = FRotator(0.0f, Rand.FRandRange(0.0f, 360.0f), 0.0f);

        // Pick a mesh from pool or use default
        UStaticMesh* PropMesh = nullptr;
        if (PropMeshPool.Num() > 0)
        {
            int32 MeshIndex = Rand.RandRange(0, PropMeshPool.Num() - 1);
            PropMesh = PropMeshPool[MeshIndex];
        }
        else
        {
            PropMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube"));
        }

        AStaticMeshActor* PropActor = World->SpawnActor<AStaticMeshActor>(
            AStaticMeshActor::StaticClass(),
            PropLocation,
            PropRotation,
            SpawnParams);

        if (PropActor && PropMesh)
        {
            PropActor->GetStaticMeshComponent()->SetStaticMesh(PropMesh);
            PropActor->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
            PropActor->SetActorScale3D(FVector(Rand.FRandRange(0.3f, 0.8f)));

            // Add collision to prop
            UBoxComponent* PropCollision = NewObject<UBoxComponent>(PropActor);
            PropCollision->SetupAttachment(PropActor->GetRootComponent());
            PropCollision->SetCollisionProfileName(TEXT("BlockAll"));
            PropCollision->SetGenerateOverlapEvents(false);
            PropCollision->RegisterComponent();

            FPropInstance NewProp;
            NewProp.PropCategory = Category;
            NewProp.Location = PropLocation;
            NewProp.Rotation = PropRotation;
            NewProp.SpawnedActor = PropActor;
            Props.Add(NewProp);
        }
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralProps: Scattered %d '%s' props (seed=%d, density=%.2f) in area %.0fx%.0f"),
        Count, *Category, Seed, Density, RoomWidth, RoomDepth);
    return Count;
}

bool UProceduralPropsComponent::ClearProps(const FString& Room)
{
    int32 Before = Props.Num();
    TArray<FPropInstance> ToRemove;

    for (FPropInstance& Prop : Props)
    {
        if (Prop.ParentRoom == Room)
        {
            if (Prop.SpawnedActor)
            {
                Prop.SpawnedActor->Destroy();
            }
            ToRemove.Add(Prop);
        }
    }

    for (const FPropInstance& Prop : ToRemove)
    {
        Props.Remove(Prop);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralProps: Cleared props in room '%s' (%d removed)"), *Room, Before - Props.Num());
    return Before != Props.Num();
}

TArray<FPropInstance> UProceduralPropsComponent::ListProps()
{
    return Props;
}

void UProceduralPropsComponent::SetDensity(const FString& Category, float NewDensity)
{
    CategoryDensity.Add(Category, NewDensity);
    UE_LOG(LogTemp, Log, TEXT("ProceduralProps: Density '%s' = %.2f"), *Category, NewDensity);
}

void UProceduralPropsComponent::SetSeed(int32 Seed)
{
    CurrentSeed = Seed;
    UE_LOG(LogTemp, Log, TEXT("ProceduralProps: Seed set to %d"), Seed);
}
