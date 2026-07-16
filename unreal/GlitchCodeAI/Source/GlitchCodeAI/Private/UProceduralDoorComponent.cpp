#include "UProceduralDoorComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "Kismet/KismetSystemLibrary.h"

UProceduralDoorComponent::UProceduralDoorComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

int32 UProceduralDoorComponent::FindDoorIndex(const FString& Name) const
{
    for (int32 i = 0; i < Doors.Num(); ++i)
    {
        if (Doors[i].DoorName == Name) return i;
    }
    return INDEX_NONE;
}

void UProceduralDoorComponent::ApplyDoorType(AStaticMeshActor* DoorMesh, EProceduralDoorType Type)
{
    if (!DoorMesh) return;

    UStaticMeshComponent* MeshComp = DoorMesh->GetStaticMeshComponent();
    if (!MeshComp) return;

    switch (Type)
    {
    case EProceduralDoorType::Wooden:
    {
        UStaticMesh* WoodMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube"));
        if (WoodMesh) MeshComp->SetStaticMesh(WoodMesh);
        FLinearColor WoodColor(0.4f, 0.25f, 0.1f);
        MeshComp->SetVectorParameterValueOnMaterials(FName("Color"), FVector(WoodColor.R, WoodColor.G, WoodColor.B));
        MeshComp->SetScalarParameterValueOnMaterials(FName("Roughness"), 0.9f);
        break;
    }
    case EProceduralDoorType::Metal:
    {
        UStaticMesh* MetalMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube"));
        if (MetalMesh) MeshComp->SetStaticMesh(MetalMesh);
        FLinearColor MetalColor(0.6f, 0.1f, 0.1f);
        MeshComp->SetVectorParameterValueOnMaterials(FName("Color"), FVector(MetalColor.R, MetalColor.G, MetalColor.B));
        MeshComp->SetScalarParameterValueOnMaterials(FName("Roughness"), 0.3f);
        break;
    }
    case EProceduralDoorType::Glass:
    {
        UStaticMesh* GlassMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube"));
        if (GlassMesh) MeshComp->SetStaticMesh(GlassMesh);
        MeshComp->SetScalarParameterValueOnMaterials(FName("Opacity"), 0.2f);
        MeshComp->SetScalarParameterValueOnMaterials(FName("Roughness"), 0.05f);
        MeshComp->SetScalarParameterValueOnMaterials(FName("Metallic"), 0.0f);
        break;
    }
    }
}

FString UProceduralDoorComponent::PlaceDoor(EProceduralDoorType DoorType, const FVector& Location)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralDoor: GetWorld() returned null"));
        return FString();
    }

    FString NewName = FString::Printf(TEXT("Door_%d"), Doors.Num());

    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = GetOwner();
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    // Door frame — slightly larger than door mesh
    AStaticMeshActor* DoorFrame = World->SpawnActor<AStaticMeshActor>(
        AStaticMeshActor::StaticClass(),
        Location,
        FRotator::ZeroRotator,
        SpawnParams);

    if (DoorFrame)
    {
        UStaticMesh* FrameMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube"));
        if (FrameMesh) DoorFrame->GetStaticMeshComponent()->SetStaticMesh(FrameMesh);
        DoorFrame->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
        DoorFrame->SetActorScale3D(FVector(1.2f, 0.15f, 2.2f));

        UBoxComponent* FrameCollision = NewObject<UBoxComponent>(DoorFrame);
        FrameCollision->SetupAttachment(DoorFrame->GetRootComponent());
        FrameCollision->SetBoxExtent(FVector(60.0f, 7.5f, 110.0f));
        FrameCollision->SetCollisionProfileName(TEXT("BlockAll"));
        FrameCollision->SetGenerateOverlapEvents(false);
        FrameCollision->RegisterComponent();
    }

    // Door mesh
    AStaticMeshActor* DoorMeshActor = World->SpawnActor<AStaticMeshActor>(
        AStaticMeshActor::StaticClass(),
        Location,
        FRotator::ZeroRotator,
        SpawnParams);

    if (DoorMeshActor)
    {
        DoorMeshActor->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
        DoorMeshActor->SetActorScale3D(FVector(1.0f, 0.1f, 2.0f));
        ApplyDoorType(DoorMeshActor, DoorType);
    }

    // Interaction trigger volume
    AActor* TriggerActor = World->SpawnActor<AActor>(
        AActor::StaticClass(),
        Location + FVector(0.0f, 80.0f, 0.0f),
        FRotator::ZeroRotator,
        SpawnParams);

    if (TriggerActor)
    {
        UBoxComponent* InteractionTrigger = NewObject<UBoxComponent>(TriggerActor);
        InteractionTrigger->SetupAttachment(TriggerActor->GetRootComponent());
        InteractionTrigger->SetBoxExtent(FVector(100.0f, 100.0f, 150.0f));
        InteractionTrigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
        InteractionTrigger->SetGenerateOverlapEvents(true);
        InteractionTrigger->RegisterComponent();
    }

    FProceduralDoor NewDoor;
    NewDoor.DoorName = NewName;
    NewDoor.DoorType = DoorType;
    NewDoor.Location = Location;
    NewDoor.DoorFrameActor = DoorFrame;
    NewDoor.DoorMeshActor = DoorMeshActor;
    NewDoor.InteractionTrigger = TriggerActor;
    Doors.Add(NewDoor);

    UE_LOG(LogTemp, Log, TEXT("ProceduralDoor: Placed '%s' type=%d at %s"), *NewName, static_cast<int32>(DoorType), *Location.ToString());
    return NewName;
}

bool UProceduralDoorComponent::RemoveDoor(const FString& Name)
{
    int32 Index = FindDoorIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralDoor& Door = Doors[Index];
    if (Door.DoorFrameActor) Door.DoorFrameActor->Destroy();
    if (Door.DoorMeshActor) Door.DoorMeshActor->Destroy();
    if (Door.InteractionTrigger) Door.InteractionTrigger->Destroy();

    Doors.RemoveAt(Index);
    UE_LOG(LogTemp, Log, TEXT("ProceduralDoor: Removed '%s'"), *Name);
    return true;
}

TArray<FString> UProceduralDoorComponent::ListDoors()
{
    TArray<FString> Names;
    for (const FProceduralDoor& D : Doors) Names.Add(D.DoorName);
    return Names;
}

bool UProceduralDoorComponent::LockDoor(const FString& Name)
{
    int32 Index = FindDoorIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralDoor& Door = Doors[Index];
    Door.bLocked = true;

    // Enable collision on the door mesh to block passage
    if (Door.DoorMeshActor)
    {
        UStaticMeshComponent* MeshComp = Door.DoorMeshActor->GetStaticMeshComponent();
        if (MeshComp)
        {
            MeshComp->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
            MeshComp->SetCollisionProfileName(TEXT("BlockAll"));
        }
    }

    // Play lock sound
    if (LockSound)
    {
        UGameplayStatics::PlaySoundAtLocation(GetWorld(), LockSound, Door.Location);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralDoor: Locked '%s'"), *Name);
    return true;
}

bool UProceduralDoorComponent::UnlockDoor(const FString& Name)
{
    int32 Index = FindDoorIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralDoor& Door = Doors[Index];
    Door.bLocked = false;

    // Disable collision on the door mesh to allow passage
    if (Door.DoorMeshActor)
    {
        UStaticMeshComponent* MeshComp = Door.DoorMeshActor->GetStaticMeshComponent();
        if (MeshComp)
        {
            MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        }
    }

    // Play unlock sound
    if (UnlockSound)
    {
        UGameplayStatics::PlaySoundAtLocation(GetWorld(), UnlockSound, Door.Location);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralDoor: Unlocked '%s'"), *Name);
    return true;
}

bool UProceduralDoorComponent::SetType(const FString& Name, EProceduralDoorType NewType)
{
    int32 Index = FindDoorIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralDoor& Door = Doors[Index];
    Door.DoorType = NewType;

    if (Door.DoorMeshActor)
    {
        ApplyDoorType(Cast<AStaticMeshActor>(Door.DoorMeshActor), NewType);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralDoor: Type set '%s' -> %d"), *Name, static_cast<int32>(NewType));
    return true;
}
