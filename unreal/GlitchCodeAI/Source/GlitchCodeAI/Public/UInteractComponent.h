#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/BoxComponent.h"
#include "Components/SphereComponent.h"
#include "Components/WidgetComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/CameraComponent.h"
#include "UInteractComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnInteract, AActor*, Target);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnGrab, AActor*, GrabbedObject);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnRelease);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UInteractComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UInteractComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Interaction")
	void Activate();

	UFUNCTION(BlueprintCallable, Category = "Interaction")
	void Grab();

	UFUNCTION(BlueprintCallable, Category = "Interaction")
	void Release();

	UFUNCTION(BlueprintCallable, Category = "Interaction")
	void Examine(AActor* Target);

	UFUNCTION(BlueprintCallable, Category = "Interaction")
	void UseItem(const FString& ItemName);

	UPROPERTY(BlueprintAssignable, Category = "Interaction|Events")
	FOnInteract OnInteract;

	UPROPERTY(BlueprintAssignable, Category = "Interaction|Events")
	FOnGrab OnGrab;

	UPROPERTY(BlueprintAssignable, Category = "Interaction|Events")
	FOnRelease OnRelease;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Interaction|Config")
	float InteractRange = 300.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Interaction|Config")
	float ThrowForce = 1000.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Interaction|Config")
	TSubclassOf<UUserWidget> InteractWidgetClass;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Interaction|State")
	AActor* HeldObject = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Interaction|State")
	AActor* ActiveTarget = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Interaction|State")
	UWidgetComponent* ActiveExamineWidget = nullptr;

private:
	void PerformLineTrace(FHitResult& OutHit);
	ACharacter* GetOwnerCharacter() const;
	UCameraComponent* GetPlayerCamera() const;
	void AttachObjectToHand(AActor* Object);
	void DetachObjectFromHand();
	void ShowExamineWidget(AActor* Target);
	void HideExamineWidget();
};
