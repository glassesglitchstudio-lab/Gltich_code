#include "UTrapComponent.h"
#include "Engine/World.h"
#include "TimerManager.h"

UTrapComponent::UTrapComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.0f;
}

void UTrapComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UTrapComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}

int32 UTrapComponent::FindTrapIndex(const FString& Name) const
{
	for (int32 i = 0; i < Traps.Num(); ++i)
	{
		if (Traps[i].TrapName == Name) return i;
	}
	return INDEX_NONE;
}

AActor* UTrapComponent::SpawnTrapActor(const FVector& Location, const FString& Type)
{
	UWorld* World = GetWorld();
	if (!World) return nullptr;

	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	AActor* NewTrapActor = World->SpawnActor<AActor>(
		AActor::StaticClass(),
		FTransform(Location),
		SpawnParams
	);

	if (!NewTrapActor) return nullptr;

	UStaticMeshComponent* MeshComp = NewObject<UStaticMeshComponent>(NewTrapActor);
	MeshComp->RegisterComponent();
	MeshComp->AttachToComponent(NewTrapActor->GetRootComponent(), FAttachmentTransformRules::SnapToTargetNotIncludingScale);
	MeshComp->SetStaticMesh(TrapMesh);
	MeshComp->SetMobility(EComponentMobility::Movable);
	MeshComp->SetCollisionProfileName(TEXT("BlockAll"));
	NewTrapActor->SetRootComponent(MeshComp);

	UBoxComponent* TriggerComp = NewObject<UBoxComponent>(NewTrapActor);
	TriggerComp->RegisterComponent();
	TriggerComp->AttachToComponent(NewTrapActor->GetRootComponent(), FAttachmentTransformRules::SnapToTargetNotIncludingScale);
	TriggerComp->SetBoxExtent(FVector(100.0f, 100.0f, 50.0f));
	TriggerComp->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	TriggerComp->SetGenerateOverlapEvents(true);
	TriggerComp->SetCollisionObjectType(ECC_Pawn);
	TriggerComp->SetCollisionResponseToAllChannels(ECR_Overlap);
	TriggerComp->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);

	TriggerComp->OnComponentBeginOverlap.AddDynamic(this, &UTrapComponent::OnTrapOverlap);

	return NewTrapActor;
}

void UTrapComponent::OnTrapOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult)
{
	if (!OtherActor || OtherActor == GetOwner()) return;

	int32 TrapIdx = INDEX_NONE;
	for (int32 i = 0; i < Traps.Num(); ++i)
	{
		if (Traps[i].TriggerVolume == OverlappedComponent)
		{
			TrapIdx = i;
			break;
		}
	}

	if (TrapIdx == INDEX_NONE || !Traps[TrapIdx].bArmed || Traps[TrapIdx].bTriggered) return;

	FTrapData& Trap = Traps[TrapIdx];
	Trap.bTriggered = true;
	Trap.bArmed = false;

	AController* InstigatorController = nullptr;
	ACharacter* OwnerChar = Cast<ACharacter>(GetOwner());
	if (OwnerChar)
	{
		InstigatorController = OwnerChar->GetController();
	}

	UGameplayStatics::ApplyDamage(
		OtherActor,
		Trap.Damage,
		InstigatorController,
		GetOwner(),
		UDamageType::StaticClass()
	);

	PlayTrapEffects(Trap.TrapActor ? Trap.TrapActor->GetActorLocation() : OtherActor->GetActorLocation());

	UE_LOG(LogTemp, Log, TEXT("Trap: '%s' triggered on '%s' for %.1f damage"),
		*Trap.TrapName, *OtherActor->GetName(), Trap.Damage);
}

void UTrapComponent::PlayTrapEffects(const FVector& Location)
{
	if (TriggerSound)
	{
		UGameplayStatics::PlaySoundAtLocation(GetWorld(), TriggerSound, Location);
	}

	if (TrapParticle)
	{
		UGameplayStatics::SpawnEmitterAtLocation(
			GetWorld(),
			TrapParticle,
			Location,
			FRotator::ZeroRotator,
			FVector(1.0f),
			true,
			EPSCPoolMethod::AutoRelease,
			true
		);
	}
}

FString UTrapComponent::PlaceTrap(const FString& Type, float Damage, const FVector& Location)
{
	FString NewName = FString::Printf(TEXT("Trap_%s_%d"), *Type, Traps.Num());

	AActor* NewTrapActor = SpawnTrapActor(Location, Type);
	if (!NewTrapActor)
	{
		UE_LOG(LogTemp, Error, TEXT("Trap: Failed to spawn trap actor at %s"), *Location.ToString());
		return FString();
	}

	FTrapData NewTrap;
	NewTrap.TrapName = NewName;
	NewTrap.TrapType = Type;
	NewTrap.Damage = Damage;
	NewTrap.bArmed = false;
	NewTrap.bTriggered = false;
	NewTrap.RadialDamageRadius = DefaultDamageRadius;
	NewTrap.TrapActor = NewTrapActor;

	UBoxComponent* TriggerComp = NewTrapActor->FindComponentByClass<UBoxComponent>();
	if (TriggerComp)
	{
		NewTrap.TriggerVolume = TriggerComp;
	}

	UStaticMeshComponent* MeshComp = NewTrapActor->FindComponentByClass<UStaticMeshComponent>();
	if (MeshComp)
	{
		NewTrap.TrapVisualMesh = MeshComp;
	}

	Traps.Add(NewTrap);

	if (ActivateSound)
	{
		UGameplayStatics::PlaySoundAtLocation(GetWorld(), ActivateSound, Location);
	}

	UE_LOG(LogTemp, Log, TEXT("Trap: Placed '%s' type='%s' dmg=%.1f at %s"),
		*NewName, *Type, Damage, *Location.ToString());

	return NewName;
}

bool UTrapComponent::ArmTrap(const FString& Name)
{
	int32 Index = FindTrapIndex(Name);
	if (Index == INDEX_NONE) return false;

	FTrapData& Trap = Traps[Index];
	Trap.bArmed = true;
	Trap.bTriggered = false;

	if (Trap.TriggerVolume)
	{
		Trap.TriggerVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
		Trap.TriggerVolume->SetGenerateOverlapEvents(true);
	}

	UE_LOG(LogTemp, Log, TEXT("Trap: Armed '%s'"), *Name);
	return true;
}

bool UTrapComponent::DisarmTrap(const FString& Name)
{
	int32 Index = FindTrapIndex(Name);
	if (Index == INDEX_NONE) return false;

	FTrapData& Trap = Traps[Index];
	Trap.bArmed = false;

	if (Trap.TriggerVolume)
	{
		Trap.TriggerVolume->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Trap.TriggerVolume->SetGenerateOverlapEvents(false);
	}

	UE_LOG(LogTemp, Log, TEXT("Trap: Disarmed '%s'"), *Name);
	return true;
}

bool UTrapComponent::TriggerTrap(const FString& Name)
{
	int32 Index = FindTrapIndex(Name);
	if (Index == INDEX_NONE || !Traps[Index].bArmed) return false;

	FTrapData& Trap = Traps[Index];
	Trap.bTriggered = true;
	Trap.bArmed = false;

	const FVector TrapLocation = Trap.TrapActor ? Trap.TrapActor->GetActorLocation() : GetOwner()->GetActorLocation();

	if (DamageTypeClass)
	{
		UGameplayStatics::ApplyRadialDamageWithFalloff(
			GetWorld(),
			Trap.Damage,
			Trap.Damage * 0.5f,
			TrapLocation,
			Trap.RadialDamageRadius * 0.5f,
			Trap.RadialDamageRadius,
			TrapFallOff,
			DamageTypeClass,
			TArray<AActor*>(),
			GetOwner(),
			GetOwner() ? Cast<AController>(Cast<ACharacter>(GetOwner())->GetController()) : nullptr,
			ECC_Pawn
		);
	}
	else
	{
		UGameplayStatics::ApplyRadialDamage(
			GetWorld(),
			Trap.Damage,
			TrapLocation,
			Trap.RadialDamageRadius,
			UDamageType::StaticClass(),
			TArray<AActor*>(),
			GetOwner(),
			GetOwner() ? Cast<AController>(Cast<ACharacter>(GetOwner())->GetController()) : nullptr,
			ECC_Pawn
		);
	}

	PlayTrapEffects(TrapLocation);

	UE_LOG(LogTemp, Log, TEXT("Trap: Triggered '%s' dmg=%.1f at %s (radius=%.1f)"),
		*Name, Trap.Damage, *TrapLocation.ToString(), Trap.RadialDamageRadius);
	return true;
}

bool UTrapComponent::RemoveTrap(const FString& Name)
{
	int32 Index = FindTrapIndex(Name);
	if (Index == INDEX_NONE) return false;

	FTrapData& Trap = Traps[Index];

	if (Trap.TrapActor)
	{
		Trap.TrapActor->Destroy();
	}

	Traps.RemoveAt(Index);

	UE_LOG(LogTemp, Log, TEXT("Trap: Removed '%s'"), *Name);
	return true;
}

TArray<FString> UTrapComponent::ListTraps() const
{
	TArray<FString> Names;
	for (const FTrapData& T : Traps)
	{
		Names.Add(T.TrapName);
	}
	return Names;
}

bool UTrapComponent::IsArmed(const FString& Name) const
{
	int32 Index = FindTrapIndex(Name);
	if (Index == INDEX_NONE) return false;
	return Traps[Index].bArmed;
}
