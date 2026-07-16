#include "UProceduralRoomComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Components/PointLightComponent.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

UProceduralRoomComponent::UProceduralRoomComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

int32 UProceduralRoomComponent::FindRoomIndex(const FString& Name) const
{
    for (int32 i = 0; i < Rooms.Num(); ++i)
    {
        if (Rooms[i].RoomName == Name) return i;
    }
    return INDEX_NONE;
}

AStaticMeshActor* UProceduralRoomComponent::SpawnMeshActor(
    UWorld* World,
    const FString& MeshPath,
    const FVector& Location,
    const FVector& Scale,
    const FRotator& Rotation,
    AActor* Owner)
{
    if (!World) return nullptr;

    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = Owner;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    AStaticMeshActor* NewActor = World->SpawnActor<AStaticMeshActor>(
        AStaticMeshActor::StaticClass(),
        Location,
        Rotation,
        SpawnParams);

    if (!NewActor) return nullptr;

    UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, *MeshPath);
    if (Mesh)
    {
        NewActor->GetStaticMeshComponent()->SetStaticMesh(Mesh);
    }

    NewActor->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
    NewActor->SetActorScale3D(Scale);

    return NewActor;
}

void UProceduralRoomComponent::AddBoxCollision(AStaticMeshActor* MeshActor, const FVector& BoxExtent)
{
    if (!MeshActor) return;

    UBoxComponent* BoxCollision = NewObject<UBoxComponent>(MeshActor);
    BoxCollision->SetupAttachment(MeshActor->GetRootComponent());
    BoxCollision->SetBoxExtent(BoxExtent);
    BoxCollision->SetCollisionProfileName(TEXT("BlockAll"));
    BoxCollision->SetGenerateOverlapEvents(false);
    BoxCollision->RegisterComponent();
}

FString UProceduralRoomComponent::GenerateRoom(const FString& RoomType, float Width, float Height, float Depth)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralRoom: GetWorld() returned null"));
        return FString();
    }

    FString NewName = FString::Printf(TEXT("Room_%s_%d"), *RoomType, Rooms.Num());
    FVector RoomOrigin = FVector(Rooms.Num() * (Width + 500.0f), 0.0f, 0.0f);

    FProceduralRoom NewRoom;
    NewRoom.RoomName = NewName;
    NewRoom.RoomType = RoomType;
    NewRoom.Width = Width;
    NewRoom.Height = Height;
    NewRoom.Depth = Depth;
    NewRoom.Origin = RoomOrigin;

    AActor* Owner = GetOwner();
    float HalfW = Width / 2.0f;
    float HalfD = Depth / 2.0f;
    float HalfH = Height / 2.0f;

    // Floor
    FVector FloorLocation = RoomOrigin + FVector(0.0f, 0.0f, 0.0f);
    FVector FloorScale = FVector(Width / 100.0f, Depth / 100.0f, 0.1f);
    AStaticMeshActor* Floor = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), FloorLocation, FloorScale, FRotator::ZeroRotator, Owner);
    if (Floor && FloorMaterial)
    {
        Floor->GetStaticMeshComponent()->SetMaterial(0, FloorMaterial);
    }
    if (Floor) NewRoom.SpawnedActors.Add(Floor);

    // Back wall (Y = -HalfD)
    FVector BackWallLocation = RoomOrigin + FVector(0.0f, -HalfD, HalfH);
    FVector BackWallScale = FVector(Width / 100.0f, 0.1f, Height / 100.0f);
    AStaticMeshActor* BackWall = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), BackWallLocation, BackWallScale, FRotator::ZeroRotator, Owner);
    if (BackWall)
    {
        if (WallMaterial) BackWall->GetStaticMeshComponent()->SetMaterial(0, WallMaterial);
        AddBoxCollision(BackWall, FVector(HalfW, 5.0f, HalfH));
    }
    if (BackWall) NewRoom.SpawnedActors.Add(BackWall);

    // Front wall (Y = +HalfD)
    FVector FrontWallLocation = RoomOrigin + FVector(0.0f, HalfD, HalfH);
    AStaticMeshActor* FrontWall = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), FrontWallLocation, BackWallScale, FRotator::ZeroRotator, Owner);
    if (FrontWall)
    {
        if (WallMaterial) FrontWall->GetStaticMeshComponent()->SetMaterial(0, WallMaterial);
        AddBoxCollision(FrontWall, FVector(HalfW, 5.0f, HalfH));
    }
    if (FrontWall) NewRoom.SpawnedActors.Add(FrontWall);

    // Left wall (X = -HalfW)
    FVector LeftWallLocation = RoomOrigin + FVector(-HalfW, 0.0f, HalfH);
    FVector SideWallScale = FVector(0.1f, Depth / 100.0f, Height / 100.0f);
    AStaticMeshActor* LeftWall = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), LeftWallLocation, SideWallScale, FRotator::ZeroRotator, Owner);
    if (LeftWall)
    {
        if (WallMaterial) LeftWall->GetStaticMeshComponent()->SetMaterial(0, WallMaterial);
        AddBoxCollision(LeftWall, FVector(5.0f, HalfD, HalfH));
    }
    if (LeftWall) NewRoom.SpawnedActors.Add(LeftWall);

    // Right wall (X = +HalfW)
    FVector RightWallLocation = RoomOrigin + FVector(HalfW, 0.0f, HalfH);
    AStaticMeshActor* RightWall = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), RightWallLocation, SideWallScale, FRotator::ZeroRotator, Owner);
    if (RightWall)
    {
        if (WallMaterial) RightWall->GetStaticMeshComponent()->SetMaterial(0, WallMaterial);
        AddBoxCollision(RightWall, FVector(5.0f, HalfD, HalfH));
    }
    if (RightWall) NewRoom.SpawnedActors.Add(RightWall);

    // Ceiling
    FVector CeilingLocation = RoomOrigin + FVector(0.0f, 0.0f, Height);
    FVector CeilingScale = FVector(Width / 100.0f, Depth / 100.0f, 0.1f);
    AStaticMeshActor* Ceiling = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), CeilingLocation, CeilingScale, FRotator::ZeroRotator, Owner);
    if (Ceiling) NewRoom.SpawnedActors.Add(Ceiling);

    // Interior light
    AActor* LightOwner = NewObject<AActor>(GetTransientPackage(), NAME_None, RF_Transient);
    if (LightOwner)
    {
        LightOwner->SetActorLocation(RoomOrigin + FVector(0.0f, 0.0f, HalfH));
        UPointLightComponent* PointLight = NewObject<UPointLightComponent>(LightOwner);
        PointLight->SetupAttachment(LightOwner->GetRootComponent());
        PointLight->SetIntensity(5000.0f);
        PointLight->SetLightColor(FLinearColor(1.0f, 0.95f, 0.85f));
        PointLight->SetAttenuationRadius(800.0f);
        PointLight->SetSourceRadius(20.0f);
        PointLight->SetCastShadows(true);
        PointLight->RegisterComponent();
        NewRoom.SpawnedActors.Add(LightOwner);
    }

    Rooms.Add(NewRoom);
    UE_LOG(LogTemp, Log, TEXT("ProceduralRoom: Generated '%s' type=%s at %s (%.0fx%.0fx%.0f) with %d actors"),
        *NewName, *RoomType, *RoomOrigin.ToString(), Width, Height, Depth, NewRoom.SpawnedActors.Num());
    return NewName;
}

bool UProceduralRoomComponent::DeleteRoom(const FString& Name)
{
    int32 Index = FindRoomIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralRoom& Room = Rooms[Index];
    for (AActor* Actor : Room.SpawnedActors)
    {
        if (Actor)
        {
            Actor->Destroy();
        }
    }
    Room.SpawnedActors.Empty();

    Rooms.RemoveAt(Index);
    UE_LOG(LogTemp, Log, TEXT("ProceduralRoom: Deleted room '%s'"), *Name);
    return true;
}

TArray<FString> UProceduralRoomComponent::ListRooms()
{
    TArray<FString> Names;
    for (const FProceduralRoom& R : Rooms) Names.Add(R.RoomName);
    return Names;
}

bool UProceduralRoomComponent::ResizeRoom(const FString& Name, float Width, float Height, float Depth)
{
    int32 Index = FindRoomIndex(Name);
    if (Index == INDEX_NONE) return false;

    // Delete and regenerate with new dimensions
    FProceduralRoom& Room = Rooms[Index];
    for (AActor* Actor : Room.SpawnedActors)
    {
        if (Actor) Actor->Destroy();
    }
    Room.SpawnedActors.Empty();

    Room.Width = Width;
    Room.Height = Height;
    Room.Depth = Depth;

    // Respawn with updated dimensions
    UWorld* World = GetWorld();
    if (!World) return false;

    AActor* Owner = GetOwner();
    float HalfW = Width / 2.0f;
    float HalfD = Depth / 2.0f;
    float HalfH = Height / 2.0f;

    // Floor
    AStaticMeshActor* Floor = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), Room.Origin, FVector(Width / 100.0f, Depth / 100.0f, 0.1f), FRotator::ZeroRotator, Owner);
    if (Floor && FloorMaterial) Floor->GetStaticMeshComponent()->SetMaterial(0, FloorMaterial);
    if (Floor) Room.SpawnedActors.Add(Floor);

    // Walls
    FVector BackWallLoc = Room.Origin + FVector(0.0f, -HalfD, HalfH);
    FVector FrontWallLoc = Room.Origin + FVector(0.0f, HalfD, HalfH);
    FVector LeftWallLoc = Room.Origin + FVector(-HalfW, 0.0f, HalfH);
    FVector RightWallLoc = Room.Origin + FVector(HalfW, 0.0f, HalfH);

    FVector BackFrontScale = FVector(Width / 100.0f, 0.1f, Height / 100.0f);
    FVector SideScale = FVector(0.1f, Depth / 100.0f, Height / 100.0f);

    auto SpawnWall = [&](const FVector& Loc, const FVector& Scale, const FVector& BoxExt) {
        AStaticMeshActor* Wall = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), Loc, Scale, FRotator::ZeroRotator, Owner);
        if (Wall)
        {
            if (WallMaterial) Wall->GetStaticMeshComponent()->SetMaterial(0, WallMaterial);
            AddBoxCollision(Wall, BoxExt);
        }
        if (Wall) Room.SpawnedActors.Add(Wall);
    };

    SpawnWall(BackWallLoc, BackFrontScale, FVector(HalfW, 5.0f, HalfH));
    SpawnWall(FrontWallLoc, BackFrontScale, FVector(HalfW, 5.0f, HalfH));
    SpawnWall(LeftWallLoc, SideScale, FVector(5.0f, HalfD, HalfH));
    SpawnWall(RightWallLoc, SideScale, FVector(5.0f, HalfD, HalfH));

    // Ceiling
    AStaticMeshActor* Ceiling = SpawnMeshActor(World, TEXT("/Engine/BasicShapes/Cube"), Room.Origin + FVector(0.0f, 0.0f, Height), FVector(Width / 100.0f, Depth / 100.0f, 0.1f), FRotator::ZeroRotator, Owner);
    if (Ceiling) Room.SpawnedActors.Add(Ceiling);

    UE_LOG(LogTemp, Log, TEXT("ProceduralRoom: Resized '%s' to (%.0fx%.0fx%.0f)"), *Name, Width, Height, Depth);
    return true;
}

bool UProceduralRoomComponent::DecorateRoom(const FString& Name, const FString& Style)
{
    int32 Index = FindRoomIndex(Name);
    if (Index == INDEX_NONE) return false;
    Rooms[Index].Style = Style;
    UE_LOG(LogTemp, Log, TEXT("ProceduralRoom: Decorated '%s' with style '%s'"), *Name, *Style);
    return true;
}

bool UProceduralRoomComponent::ConnectRooms(const FString& Room1, const FString& Room2)
{
    int32 Index1 = FindRoomIndex(Room1);
    int32 Index2 = FindRoomIndex(Room2);
    if (Index1 == INDEX_NONE || Index2 == INDEX_NONE) return false;

    UWorld* World = GetWorld();
    if (!World) return false;

    const FProceduralRoom& R1 = Rooms[Index1];
    const FProceduralRoom& R2 = Rooms[Index2];

    FVector MidPoint = (R1.Origin + R2.Origin) / 2.0f;
    FVector Direction = R2.Origin - R1.Origin;
    float Distance = Direction.Size();
    float CorridorWidth = FMath::Min(R1.Width, R2.Width) * 0.4f;

    FRotator LookAtRotation = FRotationMatrix::MakeFromX(Direction).Rotator();

    AStaticMeshActor* CorridorMesh = SpawnMeshActor(
        World,
        TEXT("/Engine/BasicShapes/Cube"),
        MidPoint,
        FVector(Distance / 100.0f, CorridorWidth / 100.0f, R1.Height / 100.0f * 0.6f),
        LookAtRotation,
        GetOwner());

    if (CorridorMesh)
    {
        UE_LOG(LogTemp, Log, TEXT("ProceduralRoom: Connected '%s' <-> '%s' via corridor mesh at %s"), *Room1, *Room2, *MidPoint.ToString());
    }

    return true;
}
