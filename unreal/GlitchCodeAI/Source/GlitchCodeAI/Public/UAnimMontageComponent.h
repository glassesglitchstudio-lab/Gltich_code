#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "UAnimMontageComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMontageBlendOut, UAnimMontage*, Montage);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMontageEnded, UAnimMontage*, Montage);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAnimMontageComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAnimMontageComponent();

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void PlayMontage(UAnimMontage* Montage, float Speed = 1.0f, const FName& StartSection = NAME_None);

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void StopMontage(float BlendOutTime = 0.2f);

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void PauseMontage();

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void ResumeMontage();

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void SetSection(const FName& NextSection);

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void SetNextSection(const FName& SectionName, const FName& NextSectionName);

    UFUNCTION(BlueprintCallable, Category = "Animation|Montage")
    void SetPlayRate(float Rate);

    UFUNCTION(BlueprintPure, Category = "Animation|Montage")
    bool IsPlaying() const;

    UFUNCTION(BlueprintPure, Category = "Animation|Montage")
    UAnimMontage* GetCurrentMontage() const;

    UFUNCTION(BlueprintPure, Category = "Animation|Montage")
    float GetMontagePosition() const;

    UPROPERTY(BlueprintAssignable, Category = "Animation|Montage")
    FOnMontageBlendOut OnMontageBlendOut;

    UPROPERTY(BlueprintAssignable, Category = "Animation|Montage")
    FOnMontageEnded OnMontageEnded;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|Montage")
    float PlayRate = 1.0f;

private:
    UPROPERTY()
    UAnimMontage* CurrentMontageRef = nullptr;

    UPROPERTY()
    USkeletalMeshComponent* OwnerMesh = nullptr;

    UFUNCTION()
    void OnMontageBlendingOut(UAnimMontage* Montage, bool bInterrupted);

    UFUNCTION()
    void OnMontageEndedCallback(UAnimMontage* Montage, bool bInterrupted);

    USkeletalMeshComponent* FindSkeletalMesh() const;
};
