#include "ULightFlickerComponent.h"
#include "Components/LightComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SpotLightComponent.h"
#include "Engine/PointLight.h"
#include "Engine/SpotLight.h"
#include "Kismet/GameplayStatics.h"

ULightFlickerComponent::ULightFlickerComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void ULightFlickerComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bIsFlickering)
    {
        return;
    }

    float NewIntensity = CalculateFlickerIntensity(DeltaTime);
    ApplyFlickerIntensity(NewIntensity);
}

void ULightFlickerComponent::SetFlickerPattern(const FString& PatternName)
{
    if (PatternName == TEXT("Constant"))
        CurrentPattern = EFlickerPattern::Constant;
    else if (PatternName == TEXT("Random"))
        CurrentPattern = EFlickerPattern::Random;
    else if (PatternName == TEXT("Rhythm"))
        CurrentPattern = EFlickerPattern::Rhythm;
    else if (PatternName == TEXT("Broken"))
        CurrentPattern = EFlickerPattern::Broken;
    else if (PatternName == TEXT("Ghostly"))
        CurrentPattern = EFlickerPattern::Ghostly;

    FlickerTimer = 0.0f;
    RhythmPhase = 0.0f;
}

void ULightFlickerComponent::SetIntensity(float NewIntensity)
{
    BaseIntensity = FMath::Clamp(NewIntensity, 0.0f, 10.0f);
    if (!bIsFlickering)
    {
        ApplyFlickerIntensity(BaseIntensity);
    }
}

void ULightFlickerComponent::SetFrequency(float NewFrequency)
{
    Frequency = FMath::Max(0.1f, NewFrequency);
}

void ULightFlickerComponent::SetRandomness(float NewRandomness)
{
    Randomness = FMath::Clamp(NewRandomness, 0.0f, 1.0f);
}

void ULightFlickerComponent::StartFlicker()
{
    if (bIsFlickering)
    {
        return;
    }

    bIsFlickering = true;
    FlickerTimer = 0.0f;
    NextFlickerTime = FMath::FRandRange(0.0f, 1.0f / Frequency);
    OnFlickerStateChanged.Broadcast(true);
}

void ULightFlickerComponent::StopFlicker()
{
    if (!bIsFlickering)
    {
        return;
    }

    bIsFlickering = false;
    ApplyFlickerIntensity(BaseIntensity);
    OnFlickerStateChanged.Broadcast(false);
}

FString ULightFlickerComponent::GetCurrentPattern() const
{
    switch (CurrentPattern)
    {
    case EFlickerPattern::Constant: return TEXT("Constant");
    case EFlickerPattern::Random:   return TEXT("Random");
    case EFlickerPattern::Rhythm:   return TEXT("Rhythm");
    case EFlickerPattern::Broken:   return TEXT("Broken");
    case EFlickerPattern::Ghostly:  return TEXT("Ghostly");
    default:                        return TEXT("Constant");
    }
}

float ULightFlickerComponent::CalculateFlickerIntensity(float DeltaTime)
{
    FlickerTimer += DeltaTime;

    switch (CurrentPattern)
    {
    case EFlickerPattern::Constant:
        return GetConstantFlicker();
    case EFlickerPattern::Random:
        return GetRandomFlicker();
    case EFlickerPattern::Rhythm:
        return GetRhythmFlicker();
    case EFlickerPattern::Broken:
        return GetBrokenFlicker();
    case EFlickerPattern::Ghostly:
        return GetGhostlyFlicker();
    default:
        return BaseIntensity;
    }
}

float ULightFlickerComponent::GetConstantFlicker() const
{
    // Constant pattern: stable light with subtle micro-flickers
    float MicroFlicker = FMath::FRandRange(-0.05f * Randomness, 0.05f * Randomness);
    return FMath::Clamp(BaseIntensity + MicroFlicker, MinIntensity, MaxIntensity);
}

float ULightFlickerComponent::GetRandomFlicker() const
{
    // Random pattern: unpredictable intensity changes
    float RandomOffset = FMath::FRandRange(-1.0f, 1.0f) * Randomness;
    return FMath::Clamp(BaseIntensity * (1.0f + RandomOffset), MinIntensity, MaxIntensity);
}

float ULightFlickerComponent::GetRhythmFlicker() const
{
    // Rhythm pattern: sinusoidal with randomness
    RhythmPhase += FlickerTimer * Frequency;
    float SineValue = FMath::Sin(RhythmPhase * 2.0f * PI);
    float RandomOffset = FMath::FRandRange(-0.2f, 0.2f) * Randomness;
    float Result = BaseIntensity * (0.7f + 0.3f * SineValue) + RandomOffset;
    return FMath::Clamp(Result, MinIntensity, MaxIntensity);
}

float ULightFlickerComponent::GetBrokenFlicker() const
{
    // Broken pattern: intermittent flickers with random blackouts
    float Rand = FMath::FRand();
    if (Rand < 0.1f * Randomness)
    {
        // Complete blackout
        return MinIntensity;
    }
    else if (Rand < 0.3f * Randomness)
    {
        // Strong flicker
        return FMath::Clamp(BaseIntensity * 0.3f, MinIntensity, MaxIntensity);
    }
    else
    {
        // Mostly normal with subtle variation
        float Variation = FMath::FRandRange(-0.1f, 0.1f) * Randomness;
        return FMath::Clamp(BaseIntensity + Variation, MinIntensity, MaxIntensity);
    }
}

float ULightFlickerComponent::GetGhostlyFlicker() const
{
    // Ghostly pattern: slow fade in/out with occasional sharp spikes
    float Time = FlickerTimer * Frequency;
    float SlowWave = FMath::Sin(Time * 0.5f) * 0.5f + 0.5f;
    float Spike = FMath::FRand() < 0.05f ? FMath::FRandRange(1.5f, 2.0f) : 1.0f;
    float Result = BaseIntensity * SlowWave * Spike * (1.0f + FMath::FRandRange(-0.1f, 0.1f) * Randomness);
    return FMath::Clamp(Result, MinIntensity, MaxIntensity);
}

ULightComponent* ULightFlickerComponent::FindLightComponent() const
{
    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return nullptr;
    }

    // Try point light
    APointLight* PointLight = Cast<APointLight>(Owner);
    if (PointLight && PointLight->PointLightComponent)
    {
        return PointLight->PointLightComponent;
    }

    // Try spot light
    ASpotLight* SpotLight = Cast<ASpotLight>(Owner);
    if (SpotLight && SpotLight->SpotLightComponent)
    {
        return SpotLight->SpotLightComponent;
    }

    // Search for any light component
    TArray<ULightComponent*> LightComponents;
    Owner->GetComponents<ULightComponent>(LightComponents);
    if (LightComponents.Num() > 0)
    {
        return LightComponents[0];
    }

    return nullptr;
}

void ULightFlickerComponent::ApplyFlickerIntensity(float Intensity)
{
    ULightComponent* Light = FindLightComponent();
    if (Light)
    {
        Light->SetIntensity(Intensity);
    }
}
