#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "UCinematicCameraComponent.generated.h"

USTRUCT(BlueprintType)
struct FCinematicKeyframe
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString KeyframeName;

    UPROPERTY(BlueprintReadOnly)
    FVector Position = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FRotator Rotation = FRotator::ZeroRotator;

    UPROPERTY(BlueprintReadOnly)
    FVector LookAt = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    float Duration = 2.0f;

    UPROPERTY(BlueprintReadOnly)
    bool bUseLookAt = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnCinematicSequenceFinished);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCinematicKeyframeReached, int32, KeyframeIndex);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UCinematicCameraComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UCinematicCameraComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void StartSequence();

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void StopSequence();

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void AddKeyframe(const FString& Name, const FVector& Pos, const FRotator& Rot, float Duration, bool bLookAt = false, const FVector& LookAtTarget = FVector::ZeroVector);

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    bool RemoveKeyframe(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void PlaySequence();

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void PauseSequence();

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void ResumeSequence();

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void ClearKeyframes();

    UFUNCTION(BlueprintCallable, Category = "Camera|Cinematic")
    void SetPlaybackSpeed(float Speed);

    UFUNCTION(BlueprintPure, Category = "Camera|Cinematic")
    bool IsPlaying() const { return bIsPlaying; }

    UFUNCTION(BlueprintPure, Category = "Camera|Cinematic")
    int32 GetCurrentKeyframeIndex() const { return CurrentKeyframeIndex; }

    UFUNCTION(BlueprintPure, Category = "Camera|Cinematic")
    float GetPlaybackProgress() const;

    UPROPERTY(BlueprintAssignable, Category = "Camera|Cinematic")
    FOnCinematicSequenceFinished OnSequenceFinished;

    UPROPERTY(BlueprintAssignable, Category = "Camera|Cinematic")
    FOnCinematicKeyframeReached OnKeyframeReached;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera|Cinematic")
    TArray<FCinematicKeyframe> Keyframes;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera|Cinematic")
    bool bIsPlaying = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera|Cinematic")
    bool bIsPaused = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera|Cinematic")
    int32 CurrentKeyframeIndex = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Cinematic")
    float PlaybackSpeed = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Cinematic")
    float InterpolationSpeed = 5.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Cinematic")
    bool bLoopSequence = false;

private:
    int32 FindKeyframeIndex(const FString& Name) const;
    void UpdateCinematicCamera(float DeltaTime);

    float KeyframeElapsedTime = 0.0f;
    FVector PreviousPosition = FVector::ZeroVector;
    FRotator PreviousRotation = FRotator::ZeroRotator;
};
