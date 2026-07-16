#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "UThirdPersonCameraComponent.generated.h"

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UThirdPersonCameraComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UThirdPersonCameraComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void Enable();

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void Disable();

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void SetDistance(float Distance);

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void SetHeight(float Height);

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void SetOrbitAngle(float Pitch, float Yaw);

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void LockView();

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void UnlockView();

    UFUNCTION(BlueprintCallable, Category = "Camera|ThirdPerson")
    void SetCameraLag(bool bEnabled, float LagSpeed = 10.0f);

    UFUNCTION(BlueprintPure, Category = "Camera|ThirdPerson")
    bool IsActive() const { return bIsActive; }

    UFUNCTION(BlueprintPure, Category = "Camera|ThirdPerson")
    USpringArmComponent* GetSpringArm() const { return SpringArm; }

    UFUNCTION(BlueprintPure, Category = "Camera|ThirdPerson")
    UCameraComponent* GetCamera() const { return Camera; }

protected:
    virtual void BeginPlay() override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    float CameraDistance = 400.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    float CameraHeight = 200.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    float CameraPitch = -15.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    float CameraYaw = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    bool bEnableCameraLag = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    float CameraLagSpeed = 10.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    bool bUsePawnControlRotation = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    bool bDoCollisionTest = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    float ProbeSize = 12.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|ThirdPerson")
    TEnumAsByte<ECollisionChannel> ProbeChannel = ECC_Camera;

private:
    UPROPERTY()
    USpringArmComponent* SpringArm = nullptr;

    UPROPERTY()
    UCameraComponent* Camera = nullptr;

    UPROPERTY()
    ACharacter* OwnerCharacter = nullptr;

    bool bIsActive = false;
};
