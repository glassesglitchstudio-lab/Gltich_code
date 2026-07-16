#include "UDarknessComponent.h"
#include "Engine/PointLight.h"
#include "Components/LightComponent.h"
#include "Components/SpotLightComponent.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "Components/PostProcessComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/AudioComponent.h"
#include "TimerManager.h"
#include "Camera/CameraComponent.h"

UDarknessComponent::UDarknessComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UDarknessComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Process active flickers
    for (int32 i = ActiveFlickers.Num() - 1; i >= 0; --i)
    {
        FFlickerState& Flicker = ActiveFlickers[i];
        if (!Flicker.bActive || !Flicker.TargetLight)
        {
            ActiveFlickers.RemoveAt(i);
            continue;
        }

        Flicker.ElapsedTime += DeltaTime;

        // Parse the pattern name and apply it
        if (Flicker.ElapsedTime >= Flicker.FlickerDuration)
        {
            // Restore light to original intensity when flicker ends
            Flicker.TargetLight->SetIntensity(Flicker.OriginalIntensity);
            Flicker.bActive = false;
            ActiveFlickers.RemoveAt(i);
            continue;
        }

        // Apply flicker pattern — toggle between 0 and original
        float NormalizedTime = Flicker.ElapsedTime / Flicker.FlickerDuration;
        bool bShouldBeOn = true;

        if (Flicker.FlickerDuration > 0.0f)
        {
            // Rapid flicker pattern
            float FlickerSpeed = 15.0f; // flickers per second
            if (Flicker.ElapsedTime < Flicker.FlickerDuration * 0.3f)
            {
                // Start slow
                FlickerSpeed = 5.0f;
            }
            else if (Flicker.ElapsedTime > Flicker.FlickerDuration * 0.7f)
            {
                // End with fast stutter
                FlickerSpeed = 25.0f;
            }

            float Phase = FMath::Fmod(Flicker.ElapsedTime * FlickerSpeed, 1.0f);
            bShouldBeOn = Phase > 0.3f;

            // Intensity varies with pattern
            float IntensityMultiplier = bShouldBeOn ?
                FMath::Lerp(0.2f, 0.7f, NormalizedTime) : 0.0f;

            Flicker.TargetLight->SetIntensity(Flicker.OriginalIntensity * IntensityMultiplier);
        }
    }
}

APointLight* UDarknessComponent::FindLightByName(const FString& LightName) const
{
    UWorld* World = GetWorld();
    if (!World) return nullptr;

    TArray<AActor*> AllLights;
    UGameplayStatics::GetAllActorsOfClass(World, APointLight::StaticClass(), AllLights);

    for (AActor* Actor : AllLights)
    {
        if (Actor && Actor->GetName() == LightName)
        {
            return Cast<APointLight>(Actor);
        }
    }

    return nullptr;
}

USpotLightComponent* UDarknessComponent::FindPlayerFlashlight() const
{
    UWorld* World = GetWorld();
    if (!World) return nullptr;

    APawn* PlayerPawn = UGameplayStatics::GetPlayerPawn(World, 0);
    if (!PlayerPawn) return nullptr;

    // Look for a SpotLightComponent attached to the player (conventional flashlight)
    return PlayerPawn->FindComponentByClass<USpotLightComponent>();
}

void UDarknessComponent::BreakLight(const FString& LightName)
{
    APointLight* Light = FindLightByName(LightName);
    if (!Light) return;

    UPointLightComponent* LightComp = Light->GetLightComponent();
    if (!LightComp) return;

    // Save original intensity (we'll set to 0 permanently)
    float OriginalIntensity = LightComp->Intensity;

    // Turn off the light
    LightComp->SetIntensity(0.0f);
    LightComp->SetVisibility(false);

    // Spawn spark particles at the light location
    if (SparkSystem)
    {
        FVector SparkLoc = Light->GetActorLocation();
        UNiagaraFunctionLibrary::SpawnSystemAtLocation(
            GetWorld(), SparkSystem, SparkLoc,
            FRotator::ZeroRotator, FVector(1.0f), true,
            true, true);
    }

    // Play glass break sound at light location
    if (BreakSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(), BreakSound, Light->GetActorLocation(), 1.0f);
    }

    // Apply a brief light flicker to nearby lights to sell the effect
    TArray<AActor*> NearbyLights;
    UGameplayStatics::GetAllActorsOfClass(GetWorld(), APointLight::StaticClass(), NearbyLights);

    for (AActor* Actor : NearbyLights)
    {
        if (Actor == Light) continue;

        float Distance = FVector::Distance(Actor->GetActorLocation(), Light->GetActorLocation());
        if (Distance < 1000.0f)
        {
            APointLight* NearbyLight = Cast<APointLight>(Actor);
            if (NearbyLight && NearbyLight->GetLightComponent())
            {
                float NearIntensity = NearbyLight->GetLightComponent()->Intensity;
                float DropRatio = 1.0f - FMath::Clamp((1000.0f - Distance) / 1000.0f, 0.0f, 0.8f);
                NearbyLight->GetLightComponent()->SetIntensity(NearIntensity * DropRatio);

                // Restore after a short delay
                float Delay = FMath::RandRange(0.1f, 0.5f);
                float RestoreIntensity = NearIntensity;
                NearbyLight->GetLightComponent()->SetIntensity(0.0f);
                FTimerHandle RestoreHandle;
                GetWorld()->GetTimerManager().SetTimer(RestoreHandle,
                    [NearbyLight, RestoreIntensity]()
                    {
                        if (NearbyLight && NearbyLight->GetLightComponent())
                        {
                            NearbyLight->GetLightComponent()->SetIntensity(RestoreIntensity);
                        }
                    }, Delay, false);
            }
        }
    }
}

void UDarknessComponent::FlickerLight(const FString& LightName, const FString& Pattern)
{
    APointLight* Light = FindLightByName(LightName);
    if (!Light) return;

    UPointLightComponent* LightComp = Light->GetLightComponent();
    if (!LightComp) return;

    // Remove any existing flicker for this light
    for (int32 i = ActiveFlickers.Num() - 1; i >= 0; --i)
    {
        if (ActiveFlickers[i].TargetLight == LightComp)
        {
            ActiveFlickers.RemoveAt(i);
        }
    }

    FFlickerState NewFlicker;
    NewFlicker.TargetLight = LightComp;
    NewFlicker.OriginalIntensity = LightComp->Intensity;
    NewFlicker.ElapsedTime = 0.0f;
    NewFlicker.FlickerDuration = 5.0f; // 5 seconds of flickering
    NewFlicker.bActive = true;
    ActiveFlickers.Add(NewFlicker);

    // Play a flicker sound if available
    if (FlickerSounds.Num() > 0)
    {
        int32 SoundIdx = FMath::RandRange(0, FlickerSounds.Num() - 1);
        if (FlickerSounds[SoundIdx])
        {
            UGameplayStatics::PlaySoundAtLocation(
                GetWorld(), FlickerSounds[SoundIdx], Light->GetActorLocation(), 0.6f);
        }
    }
}

void UDarknessComponent::SpawnDarknessArea(const FString& Area, FVector Center, float Radius)
{
    UWorld* World = GetWorld();
    if (!World) return;

    FDarknessArea NewArea;
    NewArea.AreaName = Area;
    NewArea.Center = Center;
    NewArea.Radius = Radius;
    NewArea.DarknessLevel = 1.0f;

    // Create exponential height fog at the location
    FActorSpawnParameters SpawnParams;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    AExponentialHeightFog* FogActor = World->SpawnActor<AExponentialHeightFog>(
        AExponentialHeightFog::StaticClass(), Center, FRotator::ZeroRotator, SpawnParams);

    if (FogActor)
    {
        UExponentialHeightFogComponent* FogComp = FogActor->GetComponent();
        if (FogComp)
        {
            FogComp->SetFogDensity(0.5f);
            FogComp->SetFogHeightFalloff(0.2f);
            FogComp->SetFogInscatteringColor(FLinearColor(0.01f, 0.01f, 0.02f));
        }
        NewArea.LocalFog = FogComp;
    }

    // Create post-process volume for dark vignette
    UPostProcessComponent* PPComp = NewObject<UPostProcessComponent>(FogActor);
    if (PPComp && DarknessPostProcessMaterial)
    {
        PPComp->SetupAttachment(FogActor->GetRootComponent());
        PPComp->Settings.bOverride_ColorGamma = true;
        PPComp->Settings.ColorGamma = FVector4(0.3f, 0.3f, 0.3f, 1.0f);
        PPComp->Settings.bOverride_MotionBlurAmount = true;
        PPComp->Settings.MotionBlurAmount = 0.0f;

        UMaterialInstanceDynamic* DynMat = UMaterialInstanceDynamic::Create(
            DarknessPostProcessMaterial, this);
        if (DynMat)
        {
            PPComp->Settings.AddBlendable(DynMat, 1.0f);
        }

        NewArea.PostProcessVolume = PPComp;
    }

    DarknessAreas.Add(NewArea);
}

void UDarknessComponent::FlashlightToggle()
{
    USpotLightComponent* Flashlight = FindPlayerFlashlight();
    if (!Flashlight) return;

    bFlashlightOn = !bFlashlightOn;
    Flashlight->SetVisibility(bFlashlightOn);

    // Also toggle any cone mesh or particle if attached
    USceneComponent* Parent = Flashlight->GetAttachParent();
    if (Parent)
    {
        Parent->SetVisibility(bFlashlightOn, true);
    }
}

void UDarknessComponent::SetDarknessLevel(const FString& Area, float Level)
{
    Level = FMath::Clamp(Level, 0.0f, 1.0f);
    AreaLevels.Add(Area, Level);

    // Find matching darkness area and update
    for (FDarknessArea& DA : DarknessAreas)
    {
        if (DA.AreaName == Area)
        {
            DA.DarknessLevel = Level;

            if (DA.LocalFog)
            {
                // More darkness = denser fog = darker
                DA.LocalFog->SetFogDensity(FMath::Lerp(0.0f, 1.0f, Level));
                DA.LocalFog->SetFogInscatteringColor(
                    FLinearColor::LerpUsingHSV(FLinearColor(0.5f, 0.5f, 0.5f),
                                                FLinearColor(0.01f, 0.01f, 0.02f), Level));
            }

            if (DA.PostProcessVolume)
            {
                // Adjust post-process darkness
                FVector4 DarkGamma = FMath::Lerp(
                    FVector4(1.0f, 1.0f, 1.0f, 1.0f),
                    FVector4(0.2f, 0.2f, 0.2f, 1.0f), Level);
                DA.PostProcessVolume->Settings.ColorGamma = DarkGamma;
            }

            break;
        }
    }
}

void UDarknessComponent::RestoreLight(const FString& LightName)
{
    APointLight* Light = FindLightByName(LightName);
    if (!Light) return;

    UPointLightComponent* LightComp = Light->GetLightComponent();
    if (!LightComp) return;

    LightComp->SetVisibility(true);
    LightComp->SetIntensity(LightComp->Intensity > 0.0f ? LightComp->Intensity : 1.0f);

    // Remove any active flicker for this light
    for (int32 i = ActiveFlickers.Num() - 1; i >= 0; --i)
    {
        if (ActiveFlickers[i].TargetLight == LightComp)
        {
            ActiveFlickers[i].TargetLight->SetIntensity(ActiveFlickers[i].OriginalIntensity);
            ActiveFlickers.RemoveAt(i);
        }
    }
}
