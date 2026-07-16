#include "UNoiseEmitterComponent.h"

UNoiseEmitterComponent::UNoiseEmitterComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickInterval = 0.1f;
}

void UNoiseEmitterComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    float CurrentTime = GetWorld()->GetTimeSeconds();

    // Decay noise level over time
    if (CurrentNoiseLevel > 0.0f)
    {
        CurrentNoiseLevel = FMath::FInterpTo(CurrentNoiseLevel, 0.0f, DeltaTime, 2.0f);
    }

    // Clean old history entries (keep last 10 seconds)
    NoiseHistory.RemoveAll([CurrentTime](const FNoiseEvent& Event)
    {
        return (CurrentTime - Event.Timestamp) > 10.0f;
    });
}

FNoiseEvent UNoiseEmitterComponent::EmitNoise(float Loudness, FVector Origin)
{
    FNoiseEvent Event;
    Event.Type = CurrentNoiseType;
    Event.Loudness = FMath::Clamp(Loudness, 0.0f, 1.0f);
    Event.Origin = Origin;
    Event.Radius = NoiseRadius;
    Event.Timestamp = GetWorld()->GetTimeSeconds();

    CurrentNoiseLevel = FMath::Max(CurrentNoiseLevel, Event.Loudness);
    LastEmittedTime = Event.Timestamp;

    NoiseHistory.Add(Event);
    OnNoiseEmitted.Broadcast(Event);

    UE_LOG(LogTemp, Log, TEXT("NoiseEmitter: Emitted %s at %s (Loudness: %.2f, Radius: %.0f)"),
        *UEnum::GetValueAsString(Event.Type),
        *Event.Origin.ToString(),
        Event.Loudness,
        Event.Radius);

    return Event;
}

FNoiseEvent UNoiseEmitterComponent::EmitNoiseAtOwner(float Loudness)
{
    AActor* Owner = GetOwner();
    FVector Origin = Owner ? Owner->GetActorLocation() : FVector::ZeroVector;
    return EmitNoise(Loudness, Origin);
}

void UNoiseEmitterComponent::SetNoiseType(ENoiseType NewType)
{
    CurrentNoiseType = NewType;
    BaseLoudness = GetLoudnessForType(NewType);
}

void UNoiseEmitterComponent::SetNoiseTypeFromString(const FString& TypeName)
{
    ENoiseType Parsed = ParseNoiseType(TypeName);
    SetNoiseType(Parsed);
}

void UNoiseEmitterComponent::SetNoiseRadius(float NewRadius)
{
    NoiseRadius = FMath::Max(0.0f, NewRadius);
}

float UNoiseEmitterComponent::GetNoiseLevel() const
{
    return CurrentNoiseLevel;
}

ENoiseType UNoiseEmitterComponent::GetCurrentNoiseType() const
{
    return CurrentNoiseType;
}

float UNoiseEmitterComponent::GetNoiseRadius() const
{
    return NoiseRadius;
}

TArray<FNoiseEvent> UNoiseEmitterComponent::GetRecentNoiseEvents(float TimeWindow) const
{
    float CurrentTime = GetWorld()->GetTimeSeconds();
    TArray<FNoiseEvent> RecentEvents;

    for (const FNoiseEvent& Event : NoiseHistory)
    {
        if ((CurrentTime - Event.Timestamp) <= TimeWindow)
        {
            RecentEvents.Add(Event);
        }
    }

    return RecentEvents;
}

bool UNoiseEmitterComponent::HasEmittedRecently(float TimeWindow) const
{
    float CurrentTime = GetWorld()->GetTimeSeconds();
    return (CurrentTime - LastEmittedTime) <= TimeWindow;
}

float UNoiseEmitterComponent::GetLoudnessForType(ENoiseType Type) const
{
    switch (Type)
    {
    case ENoiseType::Whisper:    return 0.1f;
    case ENoiseType::Footstep:   return 0.3f;
    case ENoiseType::Door:       return 0.5f;
    case ENoiseType::Gunshot:    return 0.8f;
    case ENoiseType::Explosion:  return 1.0f;
    case ENoiseType::Custom:     return BaseLoudness;
    default:                     return 0.5f;
    }
}

ENoiseType UNoiseEmitterComponent::ParseNoiseType(const FString& TypeName) const
{
    FString Lower = TypeName.ToLower();

    if (Lower.Contains(TEXT("footstep")))   return ENoiseType::Footstep;
    if (Lower.Contains(TEXT("door")))       return ENoiseType::Door;
    if (Lower.Contains(TEXT("gunshot")))    return ENoiseType::Gunshot;
    if (Lower.Contains(TEXT("explosion")))  return ENoiseType::Explosion;
    if (Lower.Contains(TEXT("whisper")))    return ENoiseType::Whisper;

    return ENoiseType::Custom;
}
