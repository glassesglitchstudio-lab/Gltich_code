#include "UCombatComponent.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Engine/World.h"
#include "TimerManager.h"

UCombatComponent::UCombatComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.0f;

	WeaponDataTable.Add(TEXT("unarmed"), FWeaponData{TEXT("unarmed"), 20.0f, 150.0f, 1.0f, nullptr});
	WeaponDataTable.Add(TEXT("sword"), FWeaponData{TEXT("sword"), 35.0f, 200.0f, 0.9f, nullptr});
	WeaponDataTable.Add(TEXT("axe"), FWeaponData{TEXT("axe"), 50.0f, 180.0f, 0.7f, nullptr});
	WeaponDataTable.Add(TEXT("dagger"), FWeaponData{TEXT("dagger"), 15.0f, 100.0f, 1.5f, nullptr});
	WeaponDataTable.Add(TEXT("hammer"), FWeaponData{TEXT("hammer"), 60.0f, 160.0f, 0.5f, nullptr});
}

void UCombatComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UCombatComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (bParryActive)
	{
		ParryTimer -= DeltaTime;
		if (ParryTimer <= 0.0f)
		{
			EndParryWindow();
		}
	}
}

float UCombatComponent::GetCurrentDamage() const
{
	const FWeaponData* Weapon = WeaponDataTable.Find(CurrentWeapon);
	return Weapon ? Weapon->BaseDamage : 20.0f;
}

ACharacter* UCombatComponent::GetOwnerCharacter() const
{
	return Cast<ACharacter>(GetOwner());
}

void UCombatComponent::Attack(AActor* Target, const FString& WeaponType)
{
	if (!Target || !GetOwner()) return;

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	const float CurrentTime = GetWorld()->GetTimeSeconds();
	if (CurrentTime - LastAttackTime < AttackCooldown) return;

	LastAttackTime = CurrentTime;

	if (CurrentWeapon != WeaponType)
	{
		SetWeapon(WeaponType);
	}

	const FWeaponData* Weapon = WeaponDataTable.Find(CurrentWeapon);
	const float BaseDamage = Weapon ? Weapon->BaseDamage : 20.0f;

	if (AttackMontage && OwnerChar->GetMesh() && OwnerChar->GetMesh()->GetAnimInstance())
	{
		const float MontageRate = Weapon ? Weapon->AttackSpeed : 1.0f;
		OwnerChar->GetMesh()->GetAnimInstance()->Montage_Play(AttackMontage, MontageRate);
	}

	const FVector OwnerLocation = OwnerChar->GetActorLocation();
	const FVector TargetLocation = Target->GetActorLocation();
	const float Distance = FVector::Dist(OwnerLocation, TargetLocation);
	const float MaxRange = Weapon ? Weapon->AttackRange : 150.0f;

	if (Distance <= MaxRange)
	{
		FHitResult HitResult;
		FCollisionQueryParams QueryParams;
		QueryParams.AddIgnoredActor(OwnerChar);

		const FVector TraceStart = OwnerChar->GetPawnViewLocation();
		const FVector TraceEnd = TraceStart + OwnerChar->GetActorForwardVector() * MaxRange;

		if (GetWorld()->LineTraceSingleByChannel(HitResult, TraceStart, TraceEnd, ECC_Pawn, QueryParams))
		{
			AActor* HitActor = HitResult.GetActor();
			if (HitActor && HitActor != OwnerChar)
			{
				HandleComboDamage(HitActor, BaseDamage);
				PlayHitEffects(HitActor, HitResult.ImpactPoint);
			}
		}
		else
		{
			HandleComboDamage(Target, BaseDamage);
			PlayHitEffects(Target, Target->GetActorLocation());
		}
	}

	ComboCount++;
	if (ComboCount > MaxComboSteps)
	{
		ComboCount = 1;
	}
}

void UCombatComponent::HandleComboDamage(AActor* Target, float BaseDamage)
{
	if (!Target || !GetOwner()) return;

	const float ComboMultiplier = 1.0f + (ComboCount * ComboDamageMultiplier);
	const float FinalDamage = BaseDamage * ComboMultiplier;

	AController* InstigatorController = nullptr;
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (OwnerChar)
	{
		InstigatorController = OwnerChar->GetController();
	}

	const FVector HitDirection = (Target->GetActorLocation() - GetOwner()->GetActorLocation()).GetSafeNormal();

	UGameplayStatics::ApplyDamage(
		Target,
		FinalDamage,
		InstigatorController,
		GetOwner(),
		UDamageType::StaticClass()
	);

	UGameplayStatics::ApplyPointDamage(
		Target,
		FinalDamage,
		HitDirection,
		FHitResult(),
		InstigatorController,
		GetOwner(),
		UDamageType::StaticClass()
	);
}

void UCombatComponent::PlayHitEffects(AActor* Target, const FVector& HitLocation)
{
	if (HitSound)
	{
		UGameplayStatics::PlaySoundAtLocation(
			GetWorld(),
			HitSound,
			HitLocation,
			1.0f,
			FMath::FRandRange(0.9f, 1.1f)
		);
	}

	if (HitParticle)
	{
		UGameplayStatics::SpawnEmitterAtLocation(
			GetWorld(),
			HitParticle,
			HitLocation,
			Target ? Target->GetActorRotation() : FRotator::ZeroRotator,
			FVector(1.0f),
			true,
			EPSCPoolMethod::AutoRelease,
			true
		);
	}
}

void UCombatComponent::Block()
{
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	bIsBlocking = true;

	if (BlockMontage && OwnerChar->GetMesh() && OwnerChar->GetMesh()->GetAnimInstance())
	{
		OwnerChar->GetMesh()->GetAnimInstance()->Montage_Play(BlockMontage, 1.0f);
	}

	FTimerDelegate BlockDelegate;
	BlockDelegate.BindUObject(this, &UCombatComponent::EndBlock);
	GetWorld()->GetTimerManager().SetTimer(BlockTimerHandle, BlockDelegate, 2.0f, false);
}

void UCombatComponent::EndBlock()
{
	bIsBlocking = false;
}

void UCombatComponent::Dodge()
{
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	UCharacterMovementComponent* MovementComp = OwnerChar->GetCharacterMovement();
	if (!MovementComp) return;

	const FVector DodgeDirection = OwnerChar->GetActorForwardVector();
	const FVector LaunchVelocity = DodgeDirection * DodgeImpulseStrength;

	OwnerChar->Launch(LaunchVelocity);

	if (DodgeMontage && OwnerChar->GetMesh() && OwnerChar->GetMesh()->GetAnimInstance())
	{
		OwnerChar->GetMesh()->GetAnimInstance()->Montage_Play(DodgeMontage, 1.2f);
	}

	bIsInvincible = true;

	FTimerDelegate InvincibilityDelegate;
	InvincibilityDelegate.BindUObject(this, &UCombatComponent::EndInvincibility);
	GetWorld()->GetTimerManager().SetTimer(InvincibilityTimerHandle, InvincibilityDelegate, InvincibilityDuration, false);
}

void UCombatComponent::EndInvincibility()
{
	bIsInvincible = false;
}

void UCombatComponent::Parry()
{
	bParryActive = true;
	ParryTimer = ParryWindow;

	FTimerDelegate ParryDelegate;
	ParryDelegate.BindUObject(this, &UCombatComponent::EndParryWindow);
	GetWorld()->GetTimerManager().SetTimer(ParryTimerHandle, ParryDelegate, ParryWindow, false);
}

void UCombatComponent::EndParryWindow()
{
	bParryActive = false;
	ParryTimer = 0.0f;
	GetWorld()->GetTimerManager().ClearTimer(ParryTimerHandle);
}

void UCombatComponent::ComboStep()
{
	ComboCount++;
	if (ComboCount > MaxComboSteps)
	{
		ComboCount = 1;
	}

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (OwnerChar && AttackMontage && OwnerChar->GetMesh() && OwnerChar->GetMesh()->GetAnimInstance())
	{
		const FName SectionName = *FString::Printf(TEXT("Combo%d"), ComboCount);
		if (OwnerChar->GetMesh()->GetAnimInstance()->Montage_GetCurrentSection(AttackMontage) != SectionName)
		{
			OwnerChar->GetMesh()->GetAnimInstance()->Montage_JumpToSection(SectionName, AttackMontage);
		}
	}
}

void UCombatComponent::SetWeapon(const FString& WeaponType)
{
	ACharacter* OwnerChar = GetOwnerCharacter();
	if (!OwnerChar) return;

	CurrentWeapon = WeaponType;
	ComboCount = 0;

	const FWeaponData* Weapon = WeaponDataTable.Find(WeaponType);
	if (Weapon && Weapon->WeaponMesh)
	{
		USkeletalMeshComponent* MeshComp = OwnerChar->GetMesh();
		if (MeshComp)
		{
			MeshComp->SetStaticMesh(Weapon->WeaponMesh);
		}
	}
}
