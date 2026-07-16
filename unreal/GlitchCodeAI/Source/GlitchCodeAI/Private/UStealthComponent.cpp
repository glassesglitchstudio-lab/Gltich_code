#include "UStealthComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Components/PrimitiveComponent.h"

UStealthComponent::UStealthComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickInterval = 0.1f;
    CurrentVisibility = BaseVisibility;
}

void UStealthComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    UpdateLightState();

    float OldDetectionRate = CalculateDetectionRate();
    float FinalVisibility = CurrentVisibility;

    if (bIsInShadow)
    {
        FinalVisibility *= ShadowMultiplier;
    }
    else if (bIsInLight)
    {
        FinalVisibility *= LightMultiplier;
    }

    if (bInCover)
    {
        FinalVisibility = FMath::Max(0.0f, FinalVisibility - CoverBonus);
    }

    float CombinedDetection = FMath::Clamp(
        FinalVisibility * 0.6f + CurrentNoise * 0.4f,
        0.0f,
        1.0f
    );

    bool bWasDetected = bCurrentlyDetected;
    bCurrentlyDetected = CombinedDetection >= DetectionThreshold;

    if (bCurrentlyDetected && !bWasDetected)
    {
        OnDetected.Broadcast(CombinedDetection);
    }
    else if (!bCurrentlyDetected && bWasDetected)
    {
        OnHidden.Broadcast();
    }
}

float UStealthComponent::GetVisibilityLevel() const
{
    return CurrentVisibility;
}

void UStealthComponent::SetVisibilityLevel(float NewLevel)
{
    CurrentVisibility = FMath::Clamp(NewLevel, 0.0f, 1.0f);
}

bool UStealthComponent::IsInShadow() const
{
    return bIsInShadow;
}

bool UStealthComponent::IsInLight() const
{
    return bIsInLight;
}

float UStealthComponent::GetNoiseLevel() const
{
    return CurrentNoise;
}

void UStealthComponent::SetNoiseLevel(float NewLevel)
{
    CurrentNoise = FMath::Clamp(NewLevel, 0.0f, 1.0f);
}

bool UStealthComponent::CanBeDetected() const
{
    return CalculateDetectionRate() >= DetectionThreshold;
}

float UStealthComponent::GetDetectionRate() const
{
    return CalculateDetectionRate();
}

void UStealthComponent::UpdateLightState()
{
    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return;
    }

    FVector Location = Owner->GetActorLocation();

    TArray<FLightingInfo> Lights;
    // Use line traces upward to detect light sources
    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(Owner);

    FHitResult Hit;
    FVector Start = Location;
    FVector End = Location + FVector(0, 0, 10000.0f);

    bIsInShadow = false;
    bIsInLight = false;

    if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, QueryParams))
    {
        // Hit something above — likely in shadow
        bIsInShadow = true;
    }
    else
    {
        // Nothing above — exposed to sky light
        bIsInLight = true;
    }
}

float UStealthComponent::CalculateDetectionRate() const
{
    float FinalVisibility = CurrentVisibility;

    if (bIsInShadow)
    {
        FinalVisibility *= ShadowMultiplier;
    }
    else if (bIsInLight)
    {
        FinalVisibility *= LightMultiplier;
    }

    if (bInCover)
    {
        FinalVisibility = FMath::Max(0.0f, FinalVisibility - CoverBonus);
    }

    return FMath::Clamp(
        FinalVisibility * 0.6f + CurrentNoise * 0.4f,
        0.0f,
        1.0f
    );
}
