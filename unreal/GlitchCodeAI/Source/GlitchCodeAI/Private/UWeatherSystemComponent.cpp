#include "UWeatherSystemComponent.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Sound/SoundCue.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/WorldSettings.h"
#include "TimerManager.h"
#include "Components/AudioComponent.h"

UWeatherSystemComponent::UWeatherSystemComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UWeatherSystemComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Smoothly interpolate Niagara parameters each tick
    if (ActiveRainComponent)
    {
        ActiveRainComponent->SetNiagaraVariableFloat(FString("RainIntensity"), CurrentRainIntensity);
    }
    if (ActiveSnowComponent)
    {
        ActiveSnowComponent->SetNiagaraVariableFloat(FString("SnowIntensity"), CurrentSnowIntensity);
    }
    if (ActiveStormComponent)
    {
        ActiveStormComponent->SetNiagaraVariableFloat(FString("StormIntensity"), CurrentStormIntensity);
        ActiveStormComponent->SetNiagaraVariableFloat(FString("WindIntensity"), CurrentWindSpeed);
    }

    // Update wind audio volume based on speed
    if (ActiveWindAudio)
    {
        ActiveWindAudio->SetVolumeMultiplier(FMath::Clamp(CurrentWindSpeed / 50.0f, 0.0f, 1.0f));
    }
}

void UWeatherSystemComponent::SetRain(float Intensity)
{
    Intensity = FMath::Clamp(Intensity, 0.0f, 1.0f);

    if (Intensity > 0.0f && Intensity != CurrentRainIntensity)
    {
        // Clear other precipitation
        DestroySnowNiagara();
        CurrentSnowIntensity = 0.0f;

        SpawnRainNiagara(Intensity);
        UpdateFogDensity(Intensity * 0.3f); // Rain adds proportional fog
    }
    else if (Intensity <= 0.0f)
    {
        DestroyRainNiagara();
        UpdateFogDensity(0.0f);
    }

    CurrentRainIntensity = Intensity;
}

void UWeatherSystemComponent::SpawnRainNiagara(float Intensity)
{
    if (!RainSystem) return;

    UWorld* World = GetWorld();
    if (!World) return;

    AActor* Owner = GetOwner();
    if (!Owner) return;

    if (!ActiveRainComponent)
    {
        FVector SpawnLoc = Owner->GetActorLocation();
        FRotator SpawnRot = FRotator::ZeroRotator;
        ActiveRainComponent = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
            World, RainSystem, SpawnLoc, SpawnRot, FVector(1.0f), true,
            true, true);
    }

    if (ActiveRainComponent)
    {
        ActiveRainComponent->SetNiagaraVariableFloat(FString("RainIntensity"), Intensity);
        ActiveRainComponent->SetNiagaraVariableFloat(FString("SpawnRate"), Intensity * 5000.0f);
        ActiveRainComponent->SetAsset(RainSystem);
    }
}

void UWeatherSystemComponent::DestroyRainNiagara()
{
    if (ActiveRainComponent)
    {
        ActiveRainComponent->DeactivateImmediate();
        ActiveRainComponent->DestroyComponent();
        ActiveRainComponent = nullptr;
    }
}

void UWeatherSystemComponent::SetSnow(float Intensity)
{
    Intensity = FMath::Clamp(Intensity, 0.0f, 1.0f);

    if (Intensity > 0.0f && Intensity != CurrentSnowIntensity)
    {
        // Clear rain when snowing
        DestroyRainNiagara();
        CurrentRainIntensity = 0.0f;

        SpawnSnowNiagara(Intensity);
        UpdateFogDensity(Intensity * 0.15f); // Lighter fog from snow
    }
    else if (Intensity <= 0.0f)
    {
        DestroySnowNiagara();
        UpdateFogDensity(0.0f);
    }

    CurrentSnowIntensity = Intensity;
}

void UWeatherSystemComponent::SpawnSnowNiagara(float Intensity)
{
    if (!SnowSystem) return;

    UWorld* World = GetWorld();
    if (!World) return;

    AActor* Owner = GetOwner();
    if (!Owner) return;

    if (!ActiveSnowComponent)
    {
        FVector SpawnLoc = Owner->GetActorLocation();
        ActiveSnowComponent = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
            World, SnowSystem, SpawnLoc, FRotator::ZeroRotator, FVector(1.0f), true,
            true, true);
    }

    if (ActiveSnowComponent)
    {
        ActiveSnowComponent->SetNiagaraVariableFloat(FString("SnowIntensity"), Intensity);
        ActiveSnowComponent->SetNiagaraVariableFloat(FString("SpawnRate"), Intensity * 3000.0f);
    }
}

void UWeatherSystemComponent::DestroySnowNiagara()
{
    if (ActiveSnowComponent)
    {
        ActiveSnowComponent->DeactivateImmediate();
        ActiveSnowComponent->DestroyComponent();
        ActiveSnowComponent = nullptr;
    }
}

void UWeatherSystemComponent::SetStorm(float Intensity)
{
    Intensity = FMath::Clamp(Intensity, 0.0f, 1.0f);

    // Storm implies rain
    if (Intensity > 0.0f)
    {
        CurrentRainIntensity = FMath::Max(CurrentRainIntensity, Intensity * 0.7f);
        SpawnRainNiagara(CurrentRainIntensity);
        SpawnStormNiagara(Intensity);

        // Start lightning timer — more frequent at higher intensity
        UWorld* World = GetWorld();
        if (World)
        {
            float MinDelay = FMath::Lerp(3.0f, 0.5f, Intensity);
            float MaxDelay = FMath::Lerp(8.0f, 2.0f, Intensity);
            World->GetTimerManager().SetTimer(LightningTimerHandle, this,
                &UWeatherSystemComponent::OnLightningTimer,
                FMath::RandRange(MinDelay, MaxDelay), true);

            // Increase fog during storm
            UpdateFogDensity(Intensity * 0.5f);
        }
    }
    else
    {
        DestroyStormNiagara();
        GetWorld()->GetTimerManager().ClearTimer(LightningTimerHandle);
    }

    CurrentStormIntensity = Intensity;
}

void UWeatherSystemComponent::SpawnStormNiagara(float Intensity)
{
    if (!StormSystem) return;

    UWorld* World = GetWorld();
    if (!World) return;

    AActor* Owner = GetOwner();
    if (!Owner) return;

    if (!ActiveStormComponent)
    {
        FVector SpawnLoc = Owner->GetActorLocation();
        ActiveStormComponent = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
            World, StormSystem, SpawnLoc, FRotator::ZeroRotator, FVector(1.0f), true,
            true, true);
    }

    if (ActiveStormComponent)
    {
        ActiveStormComponent->SetNiagaraVariableFloat(FString("StormIntensity"), Intensity);
    }
}

void UWeatherSystemComponent::DestroyStormNiagara()
{
    if (ActiveStormComponent)
    {
        ActiveStormComponent->DeactivateImmediate();
        ActiveStormComponent->DestroyComponent();
        ActiveStormComponent = nullptr;
    }
}

void UWeatherSystemComponent::OnLightningTimer()
{
    if (CurrentStormIntensity <= 0.0f) return;

    // Play thunder sound at a random offset near the player
    PlayThunderSound();

    // Reschedule with random interval for natural feel
    UWorld* World = GetWorld();
    if (World)
    {
        float MinDelay = FMath::Lerp(3.0f, 0.5f, CurrentStormIntensity);
        float MaxDelay = FMath::Lerp(8.0f, 2.0f, CurrentStormIntensity);
        World->GetTimerManager().SetTimer(LightningTimerHandle, this,
            &UWeatherSystemComponent::OnLightningTimer,
            FMath::RandRange(MinDelay, MaxDelay), true);
    }
}

void UWeatherSystemComponent::PlayThunderSound()
{
    UWorld* World = GetWorld();
    if (!World || !ThunderSound) return;

    APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
    if (!PC || !PC->GetPawn()) return;

    FVector PlayerLoc = PC->GetPawn()->GetActorLocation();
    FVector ThunderOffset = FVector(FMath::RandRange(-2000.0f, 2000.0f),
                                     FMath::RandRange(-2000.0f, 2000.0f),
                                     FMath::RandRange(500.0f, 2000.0f));

    float Volume = FMath::Lerp(0.3f, 1.0f, CurrentStormIntensity);
    UGameplayStatics::PlaySoundAtLocation(World, ThunderSound, PlayerLoc + ThunderOffset, Volume);
}

void UWeatherSystemComponent::SetFog(float Density, const FLinearColor& Color)
{
    CurrentFogDensity = FMath::Clamp(Density, 0.0f, 1.0f);
    UpdateFogDensity(CurrentFogDensity);

    UExponentialHeightFogComponent* Fog = GetHeightFog();
    if (Fog)
    {
        Fog->SetFogInscatteringColor(Color);
    }
}

void UWeatherSystemComponent::UpdateFogDensity(float Density)
{
    UExponentialHeightFogComponent* Fog = GetHeightFog();
    if (Fog)
    {
        Fog->SetFogDensity(Density);
    }
}

void UWeatherSystemComponent::ResetFog()
{
    UExponentialHeightFogComponent* Fog = GetHeightFog();
    if (Fog)
    {
        Fog->SetFogDensity(0.0f);
        Fog->SetFogInscatteringColor(FLinearColor(0.5f, 0.5f, 0.5f));
    }
}

UExponentialHeightFogComponent* UWeatherSystemComponent::GetHeightFog() const
{
    UWorld* World = GetWorld();
    if (!World) return nullptr;

    AExponentialHeightFog* HeightFogActor = Cast<AExponentialHeightFog>(
        UGameplayStatics::GetActorOfClass(World, AExponentialHeightFog::StaticClass()));
    if (HeightFogActor)
    {
        return HeightFogActor->GetComponent();
    }

    return nullptr;
}

void UWeatherSystemComponent::ClearWeather()
{
    DestroyRainNiagara();
    DestroySnowNiagara();
    DestroyStormNiagara();

    CurrentRainIntensity = 0.0f;
    CurrentSnowIntensity = 0.0f;
    CurrentStormIntensity = 0.0f;
    CurrentFogDensity = 0.0f;
    CurrentWindSpeed = 0.0f;

    ResetFog();

    GetWorld()->GetTimerManager().ClearTimer(LightningTimerHandle);

    if (ActiveWindAudio)
    {
        ActiveWindAudio->Stop();
        ActiveWindAudio->DestroyComponent();
        ActiveWindAudio = nullptr;
    }
}

void UWeatherSystemComponent::SetWind(float Speed, const FVector& Direction)
{
    CurrentWindSpeed = FMath::Max(0.0f, Speed);
    CurrentWindDirection = Direction.GetSafeNormal();

    // Spawn / update wind audio
    if (CurrentWindSpeed > 0.0f && WindLoopSound)
    {
        if (!ActiveWindAudio)
        {
            AActor* Owner = GetOwner();
            if (Owner)
            {
                ActiveWindAudio = UGameplayStatics::SpawnSoundAttached(
                    WindLoopSound, Owner->GetRootComponent(),
                    NAME_None, FVector::ZeroVector, FRotator::ZeroRotator,
                    EAttachLocation::SnapToTarget, true);
            }
        }

        if (ActiveWindAudio)
        {
            ActiveWindAudio->SetVolumeMultiplier(FMath::Clamp(CurrentWindSpeed / 50.0f, 0.0f, 1.0f));
            ActiveWindAudio->SetPitchMultiplier(FMath::Lerp(0.8f, 1.3f, CurrentWindSpeed / 100.0f));
        }
    }
    else if (ActiveWindAudio)
    {
        ActiveWindAudio->Stop();
        ActiveWindAudio->DestroyComponent();
        ActiveWindAudio = nullptr;
    }

    // Apply wind force to physics objects in the world
    UWorld* World = GetWorld();
    if (World && CurrentWindSpeed > 0.0f)
    {
        FVector WindForce = CurrentWindDirection * CurrentWindSpeed * 100.0f;

        TArray<FOverlapResult> Overlaps;
        FVector Center = GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector;
        FCollisionShape Sphere = FCollisionShape::MakeSphere(5000.0f);

        if (World->OverlapMultiByChannel(Overlaps, Center, FQuat::Identity, ECC_PhysicsBody, Sphere))
        {
            for (FOverlapResult& Result : Overlaps)
            {
                UPrimitiveComponent* Prim = Result.GetComponent();
                if (Prim && Prim->IsSimulatingPhysics())
                {
                    Prim->AddForce(WindForce * Prim->GetMass());
                }
            }
        }
    }
}
