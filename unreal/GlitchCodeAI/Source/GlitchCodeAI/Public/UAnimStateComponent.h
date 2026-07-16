#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "UAnimStateComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStateChanged, const FString&, NewState);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UAnimStateComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAnimStateComponent();

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void SetState(const FString& Name);

    UFUNCTION(BlueprintPure, Category = "Animation|State")
    FString GetState() const { return CurrentState; }

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void BlendToState(const FString& Name, float BlendTime);

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void AddState(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void RemoveState(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void SetFloatParameter(const FString& ParamName, float Value);

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void SetBoolParameter(const FString& ParamName, bool Value);

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void SetIntParameter(const FString& ParamName, int32 Value);

    UFUNCTION(BlueprintCallable, Category = "Animation|State")
    void SetBlendSpaceInput(const FString& ParamName, float X, float Y);

    UFUNCTION(BlueprintPure, Category = "Animation|State")
    UAnimInstance* GetAnimInstance() const;

    UPROPERTY(BlueprintAssignable)
    FOnStateChanged OnStateChanged;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Animation|State")
    FString CurrentState = TEXT("idle");

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Animation|State")
    TArray<FString> AvailableStates;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|State")
    float DefaultBlendTime = 0.2f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation|State")
    UAnimMontage* DefaultBlendMontage = nullptr;

private:
    UAnimInstance* FindAnimInstance() const;
};
