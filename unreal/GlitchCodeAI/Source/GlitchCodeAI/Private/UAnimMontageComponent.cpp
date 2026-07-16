#include "UAnimMontageComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"

UAnimMontageComponent::UAnimMontageComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

USkeletalMeshComponent* UAnimMontageComponent::FindSkeletalMesh() const
{
    AActor* Owner = GetOwner();
    if (!Owner) return nullptr;
    return Owner->FindComponentByClass<USkeletalMeshComponent>();
}

void UAnimMontageComponent::PlayMontage(UAnimMontage* Montage, float Speed, const FName& StartSection)
{
    if (!Montage)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimMontage: Null montage provided"));
        return;
    }

    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (!Mesh)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimMontage: No SkeletalMeshComponent found"));
        return;
    }

    UAnimInstance* AnimInstance = Mesh->GetAnimInstance();
    if (!AnimInstance)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimMontage: No AnimInstance found"));
        return;
    }

    // Stop any currently playing montage first
    if (AnimInstance->Montage_IsPlaying(CurrentMontageRef))
    {
        AnimInstance->Montage_Stop(0.1f);
    }

    // Play the montage
    float MontageLength = AnimInstance->Montage_Play(Montage, Speed);
    if (MontageLength > 0.0f)
    {
        CurrentMontageRef = Montage;
        OwnerMesh = Mesh;

        // Jump to start section if specified
        if (StartSection != NAME_None)
        {
            AnimInstance->Montage_JumpToSection(StartSection, Montage);
        }

        // Bind delegates for blend out and end
        FOnMontageBlendingOutStarted BlendOutDelegate;
        BlendOutDelegate.BindUObject(this, &UAnimMontageComponent::OnMontageBlendingOut);
        AnimInstance->Montage_SetBlendingOutDelegate(BlendOutDelegate, Montage);

        FOnMontageEnded EndDelegate;
        EndDelegate.BindUObject(this, &UAnimMontageComponent::OnMontageEndedCallback);
        AnimInstance->Montage_SetEndDelegate(EndDelegate, Montage);

        UE_LOG(LogTemp, Log, TEXT("AnimMontage: Playing '%s' speed=%.1f section='%s'"),
            *Montage->GetName(), Speed, *StartSection.ToString());
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimMontage: Failed to play '%s'"), *Montage->GetName());
    }
}

void UAnimMontageComponent::StopMontage(float BlendOutTime)
{
    if (!CurrentMontageRef || !OwnerMesh) return;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    if (AnimInstance && AnimInstance->Montage_IsPlaying(CurrentMontageRef))
    {
        AnimInstance->Montage_Stop(BlendOutTime);
        UE_LOG(LogTemp, Log, TEXT("AnimMontage: Stopped '%s' (blend %.2fs)"),
            *CurrentMontageRef->GetName(), BlendOutTime);
    }

    CurrentMontageRef = nullptr;
}

void UAnimMontageComponent::PauseMontage()
{
    if (!CurrentMontageRef || !OwnerMesh) return;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->Montage_Pause(CurrentMontageRef);
        UE_LOG(LogTemp, Log, TEXT("AnimMontage: Paused"));
    }
}

void UAnimMontageComponent::ResumeMontage()
{
    if (!CurrentMontageRef || !OwnerMesh) return;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->Montage_Resume(CurrentMontageRef);
        UE_LOG(LogTemp, Log, TEXT("AnimMontage: Resumed"));
    }
}

void UAnimMontageComponent::SetSection(const FName& NextSection)
{
    if (!CurrentMontageRef || !OwnerMesh) return;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    if (AnimInstance)
    {
        // Get current section name
        FName CurrentSectionName = AnimInstance->Montage_GetCurrentSection(CurrentMontageRef);
        AnimInstance->Montage_SetNextSection(CurrentSectionName, NextSection, CurrentMontageRef);
        UE_LOG(LogTemp, Log, TEXT("AnimMontage: Section '%s' -> '%s'"),
            *CurrentSectionName.ToString(), *NextSection.ToString());
    }
}

void UAnimMontageComponent::SetNextSection(const FName& SectionName, const FName& NextSectionName)
{
    if (!CurrentMontageRef || !OwnerMesh) return;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    if (AnimInstance)
    {
        AnimInstance->Montage_SetNextSection(SectionName, NextSectionName, CurrentMontageRef);
        UE_LOG(LogTemp, Log, TEXT("AnimMontage: NextSection '%s' -> '%s'"),
            *SectionName.ToString(), *NextSectionName.ToString());
    }
}

void UAnimMontageComponent::SetPlayRate(float Rate)
{
    PlayRate = FMath::Max(Rate, 0.0f);

    if (CurrentMontageRef && OwnerMesh)
    {
        UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
        if (AnimInstance && AnimInstance->Montage_IsPlaying(CurrentMontageRef))
        {
            AnimInstance->Montage_SetPlayRate(CurrentMontageRef, PlayRate);
        }
    }
}

bool UAnimMontageComponent::IsPlaying() const
{
    if (!CurrentMontageRef || !OwnerMesh) return false;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    return AnimInstance && AnimInstance->Montage_IsPlaying(CurrentMontageRef);
}

UAnimMontage* UAnimMontageComponent::GetCurrentMontage() const
{
    return CurrentMontageRef;
}

float UAnimMontageComponent::GetMontagePosition() const
{
    if (!CurrentMontageRef || !OwnerMesh) return 0.0f;

    UAnimInstance* AnimInstance = OwnerMesh->GetAnimInstance();
    if (AnimInstance)
    {
        return AnimInstance->Montage_GetPosition(CurrentMontageRef);
    }
    return 0.0f;
}

void UAnimMontageComponent::OnMontageBlendingOut(UAnimMontage* Montage, bool bInterrupted)
{
    UE_LOG(LogTemp, Log, TEXT("AnimMontage: Blending out '%s' (interrupted=%s)"),
        *Montage->GetName(), bInterrupted ? TEXT("true") : TEXT("false"));

    OnMontageBlendOut.Broadcast(Montage);
}

void UAnimMontageComponent::OnMontageEndedCallback(UAnimMontage* Montage, bool bInterrupted)
{
    UE_LOG(LogTemp, Log, TEXT("AnimMontage: Ended '%s' (interrupted=%s)"),
        *Montage->GetName(), bInterrupted ? TEXT("true") : TEXT("false"));

    if (Montage == CurrentMontageRef)
    {
        CurrentMontageRef = nullptr;
    }

    OnMontageEnded.Broadcast(Montage);
}
