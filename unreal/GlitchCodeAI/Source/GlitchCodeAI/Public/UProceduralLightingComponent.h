#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UProceduralLightingComponent.generated.h"

class UPointLightComponent;
class USpotLightComponent;
class UStaticMeshComponent;

USTRUCT(BlueprintType)
struct FProceduralLight
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString LightName;

    UPROPERTY(BlueprintReadOnly)
    FString LightType;

    UPROPERTY(BlueprintReadOnly)
    float Intensity = 1.0f;

    UPROPERTY(BlueprintReadOnly)
    FLinearColor Color = FLinearColor::White;

    UPROPERTY(BlueprintReadOnly)
    bool bFlickering = false;

    UPROPERTY(BlueprintReadOnly)
    UPointLightComponent* PointLight = nullptr;

    UPROPERTY(BlueprintReadOnly)
    USpotLightComponent* SpotLight = nullptr;

    UPROPERTY(BlueprintReadOnly)
    AActor* LightActor = nullptr;

    UPROPERTY(BlueprintReadOnly)
    float AttenuationRadius = 1000.0f;

    UPROPERTY(BlueprintReadOnly)
    float SourceRadius = 10.0f;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UProceduralLightingComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UProceduralLightingComponent();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category = "Procedural|Lighting")
    FString GenerateLighting(const FString& Type, const FVector& Location, float Intensity, const FLinearColor& Color, float AttenuationRadius, float SourceRadius);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Lighting")
    bool RemoveLighting(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Lighting")
    bool SetFlicker(const FString& Name, bool bEnabled, float MinInterval, float MaxInterval);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Lighting")
    bool SetIntensity(const FString& Name, float Intensity);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Lighting")
    bool SetColor(const FString& Name, const FLinearColor& Color);

    UFUNCTION(BlueprintCallable, Category = "Procedural|Lighting")
    void SetAmbient(const FString& Type, const FLinearColor& Color, float Intensity);

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Procedural|Lighting")
    TArray<FProceduralLight> Lights;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Lighting")
    FLinearColor AmbientColor = FLinearColor(0.05f, 0.05f, 0.1f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Procedural|Lighting")
    float AmbientIntensity = 0.3f;

private:
    int32 FindLightIndex(const FString& Name) const;
    void ToggleFlickerLight(int32 LightIndex);
    FTimerHandle GetFlickerTimerHandle(const FString& LightName) const;
    TMap<FString, FTimerHandle> FlickerTimers;
};
