#include "UThirdPersonCameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

UThirdPersonCameraComponent::UThirdPersonCameraComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UThirdPersonCameraComponent::BeginPlay()
{
    Super::BeginPlay();

    OwnerCharacter = Cast<ACharacter>(GetOwner());
}

void UThirdPersonCameraComponent::Enable()
{
    if (!OwnerCharacter)
    {
        OwnerCharacter = Cast<ACharacter>(GetOwner());
        if (!OwnerCharacter)
        {
            UE_LOG(LogTemp, Error, TEXT("ThirdPersonCam: Owner is not ACharacter"));
            return;
        }
    }

    // Create Spring Arm (boom arm)
    if (!SpringArm)
    {
        SpringArm = NewObject<USpringArmComponent>(OwnerCharacter, TEXT("CameraBoom"));
        SpringArm->SetupAttachment(OwnerCharacter->GetRootComponent());
        SpringArm->RegisterComponent();

        // Configure spring arm
        SpringArm->TargetArmLength = CameraDistance;
        SpringArm->SocketOffset = FVector(0.0f, 0.0f, CameraHeight);
        SpringArm->bUsePawnControlRotation = bUsePawnControlRotation;
        SpringArm->bInheritPitch = true;
        SpringArm->bInheritYaw = true;
        SpringArm->bInheritRoll = true;

        // Camera lag
        SpringArm->bEnableCameraLag = bEnableCameraLag;
        SpringArm->CameraLagSpeed = CameraLagSpeed;

        // Collision
        SpringArm->bDoCollisionTest = bDoCollisionTest;
        SpringArm->ProbeSize = ProbeSize;
        SpringArm->ProbeChannel = ProbeChannel;
    }

    // Create Camera
    if (!Camera)
    {
        Camera = NewObject<UCameraComponent>(OwnerCharacter, TEXT("ThirdPersonCamera"));
        Camera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
        Camera->RegisterComponent();
        Camera->bUsePawnControlRotation = false;
        Camera->Activate();
    }

    // Apply initial rotation
    SpringArm->SetRelativeRotation(FRotator(CameraPitch, CameraYaw, 0.0f));

    // Set as view target
    APlayerController* PC = Cast<APlayerController>(OwnerCharacter->GetController());
    if (PC)
    {
        PC->SetViewTargetWithBlend(Camera, 0.0f);
    }

    bIsActive = true;

    UE_LOG(LogTemp, Log, TEXT("ThirdPersonCam: Enabled, arm=%.0f, height=%.0f"),
        CameraDistance, CameraHeight);
}

void UThirdPersonCameraComponent::Disable()
{
    if (Camera)
    {
        Camera->Deactivate();
    }

    // Restore view target
    if (OwnerCharacter)
    {
        APlayerController* PC = Cast<APlayerController>(OwnerCharacter->GetController());
        if (PC)
        {
            PC->SetViewTargetWithBlend(OwnerCharacter, 0.0f);
        }
    }

    bIsActive = false;

    UE_LOG(LogTemp, Log, TEXT("ThirdPersonCam: Disabled"));
}

void UThirdPersonCameraComponent::SetDistance(float Distance)
{
    CameraDistance = FMath::Clamp(Distance, 100.0f, 2000.0f);
    if (SpringArm)
    {
        SpringArm->TargetArmLength = CameraDistance;
    }
}

void UThirdPersonCameraComponent::SetHeight(float Height)
{
    CameraHeight = Height;
    if (SpringArm)
    {
        SpringArm->SocketOffset.Z = CameraHeight;
    }
}

void UThirdPersonCameraComponent::SetOrbitAngle(float Pitch, float Yaw)
{
    CameraPitch = Pitch;
    CameraYaw = Yaw;

    if (SpringArm)
    {
        SpringArm->SetRelativeRotation(FRotator(CameraPitch, CameraYaw, 0.0f));
    }
}

void UThirdPersonCameraComponent::LockView()
{
    if (SpringArm)
    {
        SpringArm->bUsePawnControlRotation = false;
    }
}

void UThirdPersonCameraComponent::UnlockView()
{
    if (SpringArm)
    {
        SpringArm->bUsePawnControlRotation = bUsePawnControlRotation;
    }
}

void UThirdPersonCameraComponent::SetCameraLag(bool bEnabled, float LagSpeed)
{
    bEnableCameraLag = bEnabled;
    CameraLagSpeed = LagSpeed;

    if (SpringArm)
    {
        SpringArm->bEnableCameraLag = bEnableCameraLag;
        SpringArm->CameraLagSpeed = CameraLagSpeed;
    }
}

void UThirdPersonCameraComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bIsActive || !SpringArm || !Camera)
    {
        return;
    }

    // Apply lag smoothing manually if engine lag is not used
    if (!bEnableCameraLag && SpringArm)
    {
        FVector TargetLocation = SpringArm->GetComponentLocation();
        FVector CurrentLocation = Camera->GetComponentLocation();
        FVector SmoothedLocation = FMath::VInterpTo(CurrentLocation, TargetLocation, DeltaTime, CameraLagSpeed);
        // The spring arm handles this, but we can add extra smoothing here if needed
    }
}
