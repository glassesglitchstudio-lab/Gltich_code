#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UJumpScareManager.generated.h"

class USoundBase;
class UCameraShakeBase;

UENUM(BlueprintType)
enum class EJumpScareType : uint8
{
    Audio    UMETA(DisplayName = "Audio"),
    Visual   UMETA(DisplayName = "Visual"),
    Physical UMETA(DisplayName = "Physical"),
    Full     UMETA(DisplayName = "Full")
};

USTRUCT(BlueprintType)
struct FJumpScareConfig
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    FString ScareType;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    USoundBase* ScareSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    float Duration = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    float Intensity = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    TSubclassOf<UCameraShakeBase> CameraShake;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    float ExposureOverride = 10.0f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnJumpScareTriggered, const FString&, ScareType, FVector, Location, float, Intensity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnJumpScareCooldownExpired);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UJumpScareManager : public UActorComponent
{
    GENERATED_BODY()

public:
    UJumpScareManager();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "JumpScare")
    void TriggerJumpScare(const FString& ScareType, FVector Location, float Intensity);

    UFUNCTION(BlueprintCallable, Category = "JumpScare")
    void SetCooldown(float NewCooldown);

    UFUNCTION(BlueprintPure, Category = "JumpScare")
    bool CanTrigger() const;

    UFUNCTION(BlueprintCallable, Category = "JumpScare")
    void SetScareConfig(const FString& ScareType, USoundBase* Sound, float Duration, float Intensity, TSubclassOf<UCameraShakeBase> CameraShake);

    UFUNCTION(BlueprintCallable, Category = "JumpScare")
    void SetEnabled(bool bNewEnabled);

    UFUNCTION(BlueprintPure, Category = "JumpScare")
    bool IsEnabled() const { return bEnabled; }

    UFUNCTION(BlueprintPure, Category = "JumpScare")
    float GetGlobalIntensity() const { return GlobalIntensity; }

    UFUNCTION(BlueprintCallable, Category = "JumpScare")
    void SetGlobalIntensity(float NewIntensity);

    UPROPERTY(BlueprintAssignable, Category = "JumpScare")
    FOnJumpScareTriggered OnJumpScareTriggered;

    UPROPERTY(BlueprintAssignable, Category = "JumpScare")
    FOnJumpScareCooldownExpired OnJumpScareCooldownExpired;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    float CooldownBetweenScares = 3.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    float GlobalIntensity = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "JumpScare")
    bool bEnabled = true;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JumpScare")
    float TimeSinceLastScare = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "JumpScare")
    bool bOnCooldown = false;

    // Screen flash state
    UPROPERTY()
    bool bScreenFlashActive = false;

    UPROPERTY()
    float ScreenFlashTime = 0.0f;

    UPROPERTY()
    float ScreenFlashDuration = 0.0f;

    UPROPERTY()
    float OriginalExposureCompensation = 0.0f;

private:
    TMap<FString, FJumpScareConfig> ScareConfigs;

    void PlayScareAudio(USoundBase* Sound, float Intensity);
    void PlayScareVisual(FVector Location, float Intensity, float Duration);
    void PlayScarePhysical(APlayerController* PC, TSubclassOf<UCameraShakeBase> CameraShake, float Intensity);
    void ApplyScreenFlash(float Duration);
    void ResetScreenFlash();
};
