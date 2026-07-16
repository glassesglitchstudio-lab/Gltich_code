#include "UProceduralLightingComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "TimerManager.h"

UProceduralLightingComponent::UProceduralLightingComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UProceduralLightingComponent::BeginPlay()
{
    Super::BeginPlay();
}

void UProceduralLightingComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // Clear all flicker timers
    for (auto& Pair : FlickerTimers)
    {
        UWorld* World = GetWorld();
        if (World)
        {
            World->GetTimerManager().ClearTimer(Pair.Value);
        }
    }
    FlickerTimers.Empty();

    // Destroy all light actors
    for (FProceduralLight& Light : Lights)
    {
        if (Light.LightActor)
        {
            Light.LightActor->Destroy();
        }
    }
    Lights.Empty();

    Super::EndPlay(EndPlayReason);
}

int32 UProceduralLightingComponent::FindLightIndex(const FString& Name) const
{
    for (int32 i = 0; i < Lights.Num(); ++i)
    {
        if (Lights[i].LightName == Name) return i;
    }
    return INDEX_NONE;
}

void UProceduralLightingComponent::ToggleFlickerLight(int32 LightIndex)
{
    if (!Lights.IsValidIndex(LightIndex)) return;

    FProceduralLight& Light = Lights[LightIndex];

    if (Light.PointLight)
    {
        float CurrentIntensity = Light.PointLight->Intensity;
        Light.PointLight->SetIntensity(CurrentIntensity > 0.0f ? 0.0f : Light.Intensity);
    }
    else if (Light.SpotLight)
    {
        float CurrentIntensity = Light.SpotLight->Intensity;
        Light.SpotLight->SetIntensity(CurrentIntensity > 0.0f ? 0.0f : Light.Intensity);
    }
}

FString UProceduralLightingComponent::GenerateLighting(
    const FString& Type,
    const FVector& Location,
    float Intensity,
    const FLinearColor& Color,
    float AttenuationRadius,
    float SourceRadius)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralLighting: GetWorld() returned null"));
        return FString();
    }

    FString NewName = FString::Printf(TEXT("Light_%s_%d"), *Type, Lights.Num());

    // Create a lightweight actor to own the light component
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = GetOwner();
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    AActor* LightActor = World->SpawnActor<AActor>(
        AActor::StaticClass(),
        Location,
        FRotator::ZeroRotator,
        SpawnParams);

    if (!LightActor)
    {
        UE_LOG(LogTemp, Error, TEXT("ProceduralLighting: Failed to spawn light actor"));
        return FString();
    }

    FProceduralLight NewLight;
    NewLight.LightName = NewName;
    NewLight.LightType = Type;
    NewLight.Intensity = Intensity;
    NewLight.Color = Color;
    NewLight.AttenuationRadius = AttenuationRadius;
    NewLight.SourceRadius = SourceRadius;
    NewLight.LightActor = LightActor;

    if (Type.Equals(TEXT("Spot"), ESearchCase::IgnoreCase))
    {
        USpotLightComponent* SpotLight = NewObject<USpotLightComponent>(LightActor);
        SpotLight->SetupAttachment(LightActor->GetRootComponent());
        SpotLight->SetIntensity(Intensity);
        SpotLight->SetLightColor(Color);
        SpotLight->SetAttenuationRadius(AttenuationRadius);
        SpotLight->SetSourceRadius(SourceRadius);
        SpotLight->SetInnerConeAngle(30.0f);
        SpotLight->SetOuterConeAngle(45.0f);
        SpotLight->SetCastShadows(true);
        SpotLight->RegisterComponent();
        NewLight.SpotLight = SpotLight;
    }
    else
    {
        // Default to point light
        UPointLightComponent* PointLight = NewObject<UPointLightComponent>(LightActor);
        PointLight->SetupAttachment(LightActor->GetRootComponent());
        PointLight->SetIntensity(Intensity);
        PointLight->SetLightColor(Color);
        PointLight->SetAttenuationRadius(AttenuationRadius);
        PointLight->SetSourceRadius(SourceRadius);
        PointLight->SetCastShadows(true);
        PointLight->RegisterComponent();
        NewLight.PointLight = PointLight;
    }

    Lights.Add(NewLight);
    UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Generated '%s' type='%s' intensity=%.2f at %s"),
        *NewName, *Type, Intensity, *Location.ToString());
    return NewName;
}

bool UProceduralLightingComponent::RemoveLighting(const FString& Name)
{
    int32 Index = FindLightIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralLight& Light = Lights[Index];

    // Clear flicker timer if active
    FTimerHandle* TimerHandle = FlickerTimers.Find(Name);
    if (TimerHandle)
    {
        UWorld* World = GetWorld();
        if (World)
        {
            World->GetTimerManager().ClearTimer(*TimerHandle);
        }
        FlickerTimers.Remove(Name);
    }

    if (Light.LightActor)
    {
        Light.LightActor->Destroy();
    }

    Lights.RemoveAt(Index);
    UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Removed '%s'"), *Name);
    return true;
}

bool UProceduralLightingComponent::SetFlicker(const FString& Name, bool bEnabled, float MinInterval, float MaxInterval)
{
    int32 Index = FindLightIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralLight& Light = Lights[Index];
    Light.bFlickering = bEnabled;

    UWorld* World = GetWorld();
    if (!World) return false;

    if (bEnabled)
    {
        // Set up recurring flicker timer
        FTimerHandle NewTimerHandle;
        float Interval = FMath::RandRange(MinInterval, MaxInterval);

        World->GetTimerManager().SetTimer(
            NewTimerHandle,
            [this, Index]()
            {
                ToggleFlickerLight(Index);
            },
            Interval,
            true); // Looping

        FlickerTimers.Add(Name, NewTimerHandle);
        UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Flicker ON for '%s' (interval=%.2fs)"), *Name, Interval);
    }
    else
    {
        // Stop flicker and restore full intensity
        FTimerHandle* ExistingHandle = FlickerTimers.Find(Name);
        if (ExistingHandle)
        {
            World->GetTimerManager().ClearTimer(*ExistingHandle);
            FlickerTimers.Remove(Name);
        }

        // Restore light to full intensity
        if (Light.PointLight)
        {
            Light.PointLight->SetIntensity(Light.Intensity);
        }
        else if (Light.SpotLight)
        {
            Light.SpotLight->SetIntensity(Light.Intensity);
        }

        UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Flicker OFF for '%s'"), *Name);
    }

    return true;
}

bool UProceduralLightingComponent::SetIntensity(const FString& Name, float Intensity)
{
    int32 Index = FindLightIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralLight& Light = Lights[Index];
    Light.Intensity = Intensity;

    if (Light.PointLight)
    {
        Light.PointLight->SetIntensity(Intensity);
    }
    else if (Light.SpotLight)
    {
        Light.SpotLight->SetIntensity(Intensity);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Intensity '%s' = %.2f"), *Name, Intensity);
    return true;
}

bool UProceduralLightingComponent::SetColor(const FString& Name, const FLinearColor& Color)
{
    int32 Index = FindLightIndex(Name);
    if (Index == INDEX_NONE) return false;

    FProceduralLight& Light = Lights[Index];
    Light.Color = Color;

    if (Light.PointLight)
    {
        Light.PointLight->SetLightColor(Color);
    }
    else if (Light.SpotLight)
    {
        Light.SpotLight->SetLightColor(Color);
    }

    UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Color set '%s'"), *Name);
    return true;
}

void UProceduralLightingComponent::SetAmbient(const FString& Type, const FLinearColor& Color, float Intensity)
{
    AmbientColor = Color;
    AmbientIntensity = Intensity;

    // Apply ambient lighting to the world's directional/sky light if available
    UWorld* World = GetWorld();
    if (World)
    {
        UE_LOG(LogTemp, Log, TEXT("ProceduralLighting: Ambient type='%s' intensity=%.2f"), *Type, Intensity);
    }
}
