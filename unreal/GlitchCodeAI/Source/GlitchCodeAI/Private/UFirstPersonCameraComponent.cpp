#include "UFirstPersonCameraComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

UFirstPersonCameraComponent::UFirstPersonCameraComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UFirstPersonCameraComponent::BeginPlay()
{
    Super::BeginPlay();

    OwnerCharacter = Cast<ACharacter>(GetOwner());
    if (OwnerCharacter)
    {
        OwnerController = Cast<APlayerController>(OwnerCharacter->GetController());
    }
}

void UFirstPersonCameraComponent::Enable()
{
    if (!OwnerCharacter)
    {
        OwnerCharacter = Cast<ACharacter>(GetOwner());
        if (!OwnerCharacter)
        {
            UE_LOG(LogTemp, Error, TEXT("FirstPersonCam: Owner is not ACharacter"));
            return;
        }
        OwnerController = Cast<APlayerController>(OwnerCharacter->GetController());
    }

    // Find existing UCameraComponent on the character
    Camera = OwnerCharacter->FindComponentByClass<UCameraComponent>();

    // If no camera exists, create one and attach to the root
    if (!Camera)
    {
        Camera = NewObject<UCameraComponent>(OwnerCharacter, TEXT("FirstPersonCamera"));
        Camera->SetupAttachment(OwnerCharacter->GetRootComponent());
        Camera->RegisterComponent();
        Camera->SetRelativeLocation(CameraOffset);
    }

    // Set FOV
    Camera->SetFieldOfView(FieldOfView);

    // Set as view target for the player controller
    if (OwnerController)
    {
        OwnerController->SetViewTargetWithBlend(Camera, 0.0f);
    }

    // Enable camera logic
    Camera->Activate();
    bIsActive = true;
    BaseOffset = CameraOffset;

    UE_LOG(LogTemp, Log, TEXT("FirstPersonCam: Enabled, attached to '%s', FOV=%.0f"),
        *OwnerCharacter->GetName(), FieldOfView);
}

void UFirstPersonCameraComponent::Disable()
{
    if (Camera)
    {
        Camera->Deactivate();
    }

    // Restore view target to the character
    if (OwnerController && OwnerCharacter)
    {
        OwnerController->SetViewTargetWithBlend(OwnerCharacter, 0.0f);
    }

    bIsActive = false;
    UE_LOG(LogTemp, Log, TEXT("FirstPersonCam: Disabled"));
}

void UFirstPersonCameraComponent::SetFOV(float FOV)
{
    FieldOfView = FMath::Clamp(FOV, 60.0f, 120.0f);
    if (Camera)
    {
        Camera->SetFieldOfView(FieldOfView);
    }
}

void UFirstPersonCameraComponent::SetOffset(const FVector& Offset)
{
    CameraOffset = Offset;
    BaseOffset = Offset;
    if (Camera)
    {
        Camera->SetRelativeLocation(Offset);
    }
}

void UFirstPersonCameraComponent::SetHeight(float Height)
{
    CameraHeight = Height;
    CameraOffset.Z = Height;
    BaseOffset.Z = Height;
    if (Camera)
    {
        FVector Loc = Camera->GetRelativeLocation();
        Loc.Z = Height;
        Camera->SetRelativeLocation(Loc);
    }
}

void UFirstPersonCameraComponent::StartCameraShake(TSubclassOf<UCameraShakeBase> ShakeClass, float Scale)
{
    if (OwnerController && ShakeClass)
    {
        OwnerController->ClientStartCameraShake(ShakeClass, Scale);
    }
}

void UFirstPersonCameraComponent::StopCameraShake()
{
    if (OwnerController)
    {
        OwnerController->ClientStopAllCameraShakes(true);
    }
}

void UFirstPersonCameraComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bIsActive || !Camera || !OwnerCharacter)
    {
        return;
    }

    // Head bob via sine wave on Z offset
    if (bEnableHeadBob)
    {
        FVector Velocity = OwnerCharacter->GetVelocity();
        float Speed = Velocity.Size2D();

        if (Speed > 10.0f)
        {
            BobTimer += DeltaTime * BobSpeed * (Speed / MaxWalkSpeed);
            float BobOffset = FMath::Sin(BobTimer) * BobAmount;
            FVector NewLocation = BaseOffset;
            NewLocation.Z += BobOffset;
            Camera->SetRelativeLocation(NewLocation);
        }
        else
        {
            // Smoothly return to base offset when not moving
            FVector CurrentLoc = Camera->GetRelativeLocation();
            FVector TargetLoc = BaseOffset;
            Camera->SetRelativeLocation(FMath::VInterpTo(CurrentLoc, TargetLoc, DeltaTime, 10.0f));
            BobTimer = 0.0f;
        }
    }
}
