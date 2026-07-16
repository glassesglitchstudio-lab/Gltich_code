#include "AHorrorDemoGameMode.h"
#include "UProceduralRoomComponent.h"
#include "UProceduralDoorComponent.h"
#include "UProceduralLightingComponent.h"
#include "UWeatherSystemComponent.h"
#include "UDarknessComponent.h"
#include "UHorrorAtmosphereComponent.h"
#include "UHealthComponent.h"
#include "UStaminaComponent.h"
#include "UCombatComponent.h"
#include "Kismet/GameplayStatics.h"

AHorrorDemoGameMode::AHorrorDemoGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AHorrorDemoGameMode::BeginPlay()
{
    Super::BeginPlay();
    SpawnHorrorRoom();
}

void AHorrorDemoGameMode::SpawnHorrorRoom()
{
    // Use procedural generation to create the horror level
    AActor* RoomGenActor = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    UProceduralRoomComponent* RoomGen = NewObject<UProceduralRoomComponent>(RoomGenActor);
    RoomGen->RegisterComponent();

    // Generate main room
    FString MainRoom = RoomGen->GenerateRoom(TEXT("basement"), 1200.0f, 400.0f, 1000.0f);

    // Generate corridor
    AActor* CorridorGen = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    UProceduralCorridorComponent* Corridor = NewObject<UProceduralCorridorComponent>(CorridorGen);
    Corridor->RegisterComponent();

    // Add horror lighting
    AActor* LightGen = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    UProceduralLightingComponent* Lighting = NewObject<UProceduralLightingComponent>(LightGen);
    Lighting->RegisterComponent();
    Lighting->GenerateLighting(TEXT("point"), 200.0f, FLinearColor(1.0f, 0.8f, 0.6f));

    // Set up weather
    AActor* WeatherActor = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    UWeatherSystemComponent* Weather = NewObject<UWeatherSystemComponent>(WeatherActor);
    Weather->RegisterComponent();
    Weather->SetFog(0.02f, FLinearColor(0.05f, 0.05f, 0.08f));

    // Set up darkness
    AActor* DarknessActor = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    UDarknessComponent* Darkness = NewObject<UDarknessComponent>(DarknessActor);
    Darkness->RegisterComponent();
    Darkness->SetDarknessLevel(TEXT("main_area"), 0.7f);

    // Horror atmosphere
    AActor* HorrorActor = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    UHorrorAtmosphereComponent* Horror = NewObject<UHorrorAtmosphereComponent>(HorrorActor);
    Horror->RegisterComponent();
    Horror->SetAmbientFear(TEXT("main_area"), 0.5f);
}

void AHorrorDemoGameMode::StartHorrorEvent()
{
    AActor* HorrorActor = UGameplayStatics::GetActorOfClass(this, UHorrorAtmosphereComponent::StaticClass());
    if (HorrorActor)
    {
        UHorrorAtmosphereComponent* Horror = HorrorActor->FindComponentByClass<UHorrorAtmosphereComponent>();
        if (Horror) Horror->TriggerHorrorEvent(TEXT("ambient"));
    }
}

void AHorrorDemoGameMode::ResetDemo()
{
    UGameplayStatics::OpenLevel(this, FName(*GetWorld()->GetMap()->GetMapName()));
}
