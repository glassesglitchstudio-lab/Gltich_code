#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "UFirstPersonCameraComponent.generated.h"

class UCameraShakeBase;

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UFirstPersonCameraComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFirstPersonCameraComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void Enable();

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void Disable();

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void SetFOV(float FOV);

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void SetOffset(const FVector& Offset);

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void SetHeight(float Height);

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void StartCameraShake(TSubclassOf<UCameraShakeBase> ShakeClass, float Scale = 1.0f);

    UFUNCTION(BlueprintCallable, Category = "Camera|FirstPerson")
    void StopCameraShake();

    UFUNCTION(BlueprintPure, Category = "Camera|FirstPerson")
    bool IsActive() const { return bIsActive; }

protected:
    virtual void BeginPlay() override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera|FirstPerson")
    bool bIsActive = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson")
    float FieldOfView = 90.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson")
    FVector CameraOffset = FVector(0.0f, 0.0f, 64.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson")
    float CameraHeight = 64.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson|HeadBob")
    float BobSpeed = 12.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson|HeadBob")
    float BobAmount = 3.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson|HeadBob")
    bool bEnableHeadBob = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|FirstPerson|Shake")
    TSubclassOf<UCameraShakeBase> CameraShakeClass;

private:
    UPROPERTY()
    UCameraComponent* Camera = nullptr;

    UPROPERTY()
    ACharacter* OwnerCharacter = nullptr;

    UPROPERTY()
    APlayerController* OwnerController = nullptr;

    float BobTimer = 0.0f;
    FVector BaseOffset = FVector::ZeroVector;
};
