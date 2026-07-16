#include "UInteractComponent.h"
#include "Engine/World.h"
#include "DrawDebugHelpers.h"
#include "Kismet/KismetSystemLibrary.h"

UInteractComponent::UInteractComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.0f;
}

void UInteractComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UInteractComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}

ACharacter* UInteractComponent::GetOwnerCharacter() const
{
	return Cast<ACharacter>(GetOwner());
}

UCameraComponent* UInteractComponent::GetPlayerCamera() const
{
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return nullptr;

	return OwnerChar->FindComponentByClass<UCameraComponent>();
}

void UInteractComponent::PerformLineTrace(FHitResult& OutHit)
{
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	UCameraComponent* Camera = GetPlayerCamera();
	FVector TraceStart;
	FVector TraceEnd;

	if (Camera)
	{
		TraceStart = Camera->GetComponentLocation();
		TraceEnd = TraceStart + Camera->GetForwardVector() * InteractRange;
	}
	else
	{
		TraceStart = OwnerChar->GetPawnViewLocation();
		TraceEnd = TraceStart + OwnerChar->GetActorForwardVector() * InteractRange;
	}

	FCollisionQueryParams QueryParams;
	QueryParams.AddIgnoredActor(OwnerChar);
	QueryParams.bTraceComplex = true;
	QueryParams.bReturnPhysicalMaterial = false;

	GetWorld()->LineTraceSingleByChannel(
		OutHit,
		TraceStart,
		TraceEnd,
		ECC_Visibility,
		QueryParams
	);

	DrawDebugLine(GetWorld(), TraceStart, TraceEnd, OutHit.bBlockingHit ? FColor::Green : FColor::Red, false, 0.5f, 0, 1.0f);
}

void UInteractComponent::Activate()
{
	FHitResult HitResult;
	PerformLineTrace(HitResult);

	if (HitResult.bBlockingHit)
	{
		AActor* HitActor = HitResult.GetActor();
		if (HitActor)
		{
			ActiveTarget = HitActor;

			bool bImplementsInteract = HitActor->GetClass()->ImplementsInterface(UInteractable::StaticClass());
			if (bImplementsInteract)
			{
				IInteractable::Execute_Interact(HitActor, GetOwner());
			}

			OnInteract.Broadcast(HitActor);

			UE_LOG(LogTemp, Log, TEXT("Interact: Activated '%s'"), *HitActor->GetName());
		}
	}
}

void UInteractComponent::Grab()
{
	FHitResult HitResult;
	PerformLineTrace(HitResult);

	if (!HitResult.bBlockingHit) return;

	AActor* HitActor = HitResult.GetActor();
	if (!HitActor) return;

	UPrimitiveComponent* HitComp = HitResult.GetComponent();
	if (HitComp && HitComp->IsSimulatingPhysics())
	{
		AttachObjectToHand(HitActor);
		OnGrab.Broadcast(HitActor);
		UE_LOG(LogTemp, Log, TEXT("Interact: Grabbed '%s'"), *HitActor->GetName());
	}
}

void UInteractComponent::AttachObjectToHand(AActor* Object)
{
	if (!Object || !GetOwner()) return;

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	UPrimitiveComponent* RootPrim = Cast<UPrimitiveComponent>(Object->GetRootComponent());
	if (RootPrim)
	{
		RootPrim->SetSimulatePhysics(false);
		RootPrim->SetCollisionEnabled(ECollisionEnabled::NoCollision);

		Object->AttachToComponent(
			OwnerChar->GetMesh(),
			FAttachmentTransformRules::SnapToTargetNotIncludingScale,
			TEXT("hand_r_socket")
		);
	}

	HeldObject = Object;
}

void UInteractComponent::Release()
{
	if (!HeldObject || !GetOwner()) return;

	ACharacter* OwnerChar = GetOwnerCharacter();

	HeldObject->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);

	UPrimitiveComponent* RootPrim = Cast<UPrimitiveComponent>(HeldObject->GetRootComponent());
	if (RootPrim)
	{
		RootPrim->SetSimulatePhysics(true);
		RootPrim->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);

		FVector ThrowDirection = FVector::ZeroVector;

		UCameraComponent* Camera = GetPlayerCamera();
		if (Camera)
		{
			ThrowDirection = Camera->GetForwardVector();
		}
		else if (OwnerChar)
		{
			ThrowDirection = OwnerChar->GetActorForwardVector();
		}

		RootPrim->SetPhysicsLinearVelocity(ThrowDirection * ThrowForce);
	}

	OnRelease.Broadcast();
	UE_LOG(LogTemp, Log, TEXT("Interact: Released '%s'"), *HeldObject->GetName());
	HeldObject = nullptr;
}

void UInteractComponent::Examine(AActor* Target)
{
	if (!Target) return;

	ActiveTarget = Target;
	ShowExamineWidget(Target);

	UE_LOG(LogTemp, Log, TEXT("Interact: Examining '%s'"), *Target->GetName());
}

void UInteractComponent::ShowExamineWidget(AActor* Target)
{
	HideExamineWidget();

	if (!Target || !InteractWidgetClass) return;

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	UWidgetComponent* WidgetComp = NewObject<UWidgetComponent>(Target);
	WidgetComp->SetWidgetClass(InteractWidgetClass);
	WidgetComp->SetDrawAtDesiredSize(true);
	WidgetComp->SetRelativeLocation(FVector(0.0f, 0.0f, 100.0f));
	WidgetComp->SetPivot(FVector2D(0.5f, 0.0f));
	WidgetComp->SetVisibility(true);
	WidgetComp->RegisterComponent();
	WidgetComp->AttachToComponent(Target->GetRootComponent(), FAttachmentTransformRules::KeepRelativeTransform);

	ActiveExamineWidget = WidgetComp;
}

void UInteractComponent::HideExamineWidget()
{
	if (ActiveExamineWidget)
	{
		ActiveExamineWidget->DestroyComponent();
		ActiveExamineWidget = nullptr;
	}
}

void UInteractComponent::UseItem(const FString& ItemName)
{
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	UE_LOG(LogTemp, Log, TEXT("Interact: Using item '%s'"), *ItemName);

	if (ItemName.Contains(TEXT("health"), ESearchCase::IgnoreCase))
	{
		UGameplayStatics::ApplyDamage(OwnerChar, -50.0f, nullptr, this, UDamageType::StaticClass());
	}
	else if (ItemName.Contains(TEXT("damage"), ESearchCase::IgnoreCase))
	{
		UE_LOG(LogTemp, Log, TEXT("Interact: Damage buff applied for '%s'"), *ItemName);
	}
}
