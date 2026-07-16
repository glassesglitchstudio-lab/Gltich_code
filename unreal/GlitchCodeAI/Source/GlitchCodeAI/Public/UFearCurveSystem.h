#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UFearCurveSystem.generated.h"

class UCurveFloat;

UENUM(BlueprintType)
enum class EFearState : uint8
{
    Calm       UMETA(DisplayName = "Calm"),
    Uneasy     UMETA(DisplayName = "Uneasy"),
    Nervous    UMETA(DisplayName = "Nervous"),
    Scared     UMETA(DisplayName = "Scared"),
    Terrified  UMETA(DisplayName = "Terrified")
};

USTRUCT(BlueprintType)
struct FFearModifier
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    float Value = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    bool bActive = true;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFearLevelChanged, float, NewFearLevel);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFearStateChanged, const FString&, NewState);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UFearCurveSystem : public UActorComponent
{
    GENERATED_BODY()

public:
    UFearCurveSystem();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Fear")
    void SetFearLevel(float NewFearLevel);

    UFUNCTION(BlueprintPure, Category = "Fear")
    float GetFearLevel() const { return CurrentFearLevel; }

    UFUNCTION(BlueprintCallable, Category = "Fear")
    void AddFearModifier(const FString& ModifierName, float Value);

    UFUNCTION(BlueprintCallable, Category = "Fear")
    void RemoveFearModifier(const FString& ModifierName);

    UFUNCTION(BlueprintPure, Category = "Fear")
    FString GetFearState() const;

    UFUNCTION(BlueprintPure, Category = "Fear")
    float GetModifierValue(const FString& ModifierName) const;

    UFUNCTION(BlueprintCallable, Category = "Fear")
    void ResetFear();

    UFUNCTION(BlueprintPure, Category = "Fear")
    TArray<FFearModifier> GetAllModifiers() const { return FearModifiers; }

    UFUNCTION(BlueprintPure, Category = "Fear")
    float EvaluateCurve() const;

    UPROPERTY(BlueprintAssignable, Category = "Fear")
    FOnFearLevelChanged OnFearLevelChanged;

    UPROPERTY(BlueprintAssignable, Category = "Fear")
    FOnFearStateChanged OnFearStateChanged;

protected:
    // Main fear curve — maps normalized fear (0-1) to output effects
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear|Curve")
    UCurveFloat* FearResponseCurve;

    // Movement speed curve: fear level → walk speed multiplier
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear|Curve")
    UCurveFloat* MovementSpeedCurve;

    // Audio warp curve: fear level → pitch warp amount
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear|Curve")
    UCurveFloat* AudioWarpCurve;

    // Camera distortion curve: fear level → distortion strength
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear|Curve")
    UCurveFloat* CameraDistortionCurve;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    float CurrentFearLevel = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    float MinFearLevel = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    float MaxFearLevel = 100.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    float FearDecayRate = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fear")
    float FearDecayDelay = 5.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fear")
    float TimeSinceLastChange = 0.0f;

private:
    TArray<FFearModifier> FearModifiers;
    EFearState PreviousState = EFearState::Calm;

    float CalculateFinalFearLevel() const;
    EFearState GetFearStateFromLevel(float Level) const;
    FString FearStateToString(EFearState State) const;
    void ApplyFearEffects(float CurveValue);
};
