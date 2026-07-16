#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UNoiseEmitterComponent.generated.h"

UENUM(BlueprintType)
enum class ENoiseType : uint8
{
    Footstep   UMETA(DisplayName = "Footstep"),
    Door       UMETA(DisplayName = "Door"),
    Gunshot    UMETA(DisplayName = "Gunshot"),
    Explosion  UMETA(DisplayName = "Explosion"),
    Whisper    UMETA(DisplayName = "Whisper"),
    Custom     UMETA(DisplayName = "Custom")
};

USTRUCT(BlueprintType)
struct FNoiseEvent
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    ENoiseType Type = ENoiseType::Footstep;

    UPROPERTY(BlueprintReadOnly)
    float Loudness = 0.5f;

    UPROPERTY(BlueprintReadOnly)
    FVector Origin = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    float Radius = 500.0f;

    UPROPERTY(BlueprintReadOnly)
    float Timestamp = 0.0f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnNoiseEmitted, const FNoiseEvent&, NoiseEvent);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UNoiseEmitterComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UNoiseEmitterComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    // Emit
    UFUNCTION(BlueprintCallable, Category = "Noise")
    FNoiseEvent EmitNoise(float Loudness, FVector Origin);

    UFUNCTION(BlueprintCallable, Category = "Noise")
    FNoiseEvent EmitNoiseAtOwner(float Loudness);

    // Configuration
    UFUNCTION(BlueprintCallable, Category = "Noise")
    void SetNoiseType(ENoiseType NewType);

    UFUNCTION(BlueprintCallable, Category = "Noise")
    void SetNoiseTypeFromString(const FString& TypeName);

    UFUNCTION(BlueprintCallable, Category = "Noise")
    void SetNoiseRadius(float NewRadius);

    // Queries
    UFUNCTION(BlueprintPure, Category = "Noise")
    float GetNoiseLevel() const;

    UFUNCTION(BlueprintPure, Category = "Noise")
    ENoiseType GetCurrentNoiseType() const;

    UFUNCTION(BlueprintPure, Category = "Noise")
    float GetNoiseRadius() const;

    // History
    UFUNCTION(BlueprintPure, Category = "Noise")
    TArray<FNoiseEvent> GetRecentNoiseEvents(float TimeWindow = 2.0f) const;

    UFUNCTION(BlueprintPure, Category = "Noise")
    bool HasEmittedRecently(float TimeWindow = 1.0f) const;

    // Events
    UPROPERTY(BlueprintAssignable, Category = "Noise")
    FOnNoiseEmitted OnNoiseEmitted;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Noise|Type")
    ENoiseType CurrentNoiseType = ENoiseType::Footstep;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Noise|Type")
    float NoiseRadius = 500.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Noise|Type")
    float BaseLoudness = 0.5f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Noise|State")
    float CurrentNoiseLevel = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Noise|State")
    float LastEmittedTime = 0.0f;

private:
    TArray<FNoiseEvent> NoiseHistory;
    float GetLoudnessForType(ENoiseType Type) const;
    ENoiseType ParseNoiseType(const FString& TypeName) const;
};
