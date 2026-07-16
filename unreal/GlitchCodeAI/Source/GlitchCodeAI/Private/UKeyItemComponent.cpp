#include "UKeyItemComponent.h"
#include "Engine/World.h"
#include "TimerManager.h"

UKeyItemComponent::UKeyItemComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.0f;
}

void UKeyItemComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UKeyItemComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}

ACharacter* UKeyItemComponent::GetOwnerCharacter() const
{
	return Cast<ACharacter>(GetOwner());
}

int32 UKeyItemComponent::FindKeyIndex(FName KeyName) const
{
	for (int32 i = 0; i < Keys.Num(); ++i)
	{
		if (Keys[i].KeyName == KeyName) return i;
	}
	return INDEX_NONE;
}

int32 UKeyItemComponent::FindLockIndex(FName LockID) const
{
	for (int32 i = 0; i < Locks.Num(); ++i)
	{
		if (Locks[i].LockID == LockID) return i;
	}
	return INDEX_NONE;
}

FName UKeyItemComponent::CreateKey(FName Name, EKeyType Type, FName AssociatedLockID)
{
	FKeyData NewKey;
	NewKey.KeyName = Name;
	NewKey.KeyType = Type;
	NewKey.AssociatedLockID = AssociatedLockID;
	NewKey.bUsed = false;
	NewKey.bInInventory = false;
	Keys.Add(NewKey);

	UE_LOG(LogTemp, Log, TEXT("KeyItem: Created key '%s' type=%d associated_lock='%s'"),
		*Name.ToString(), static_cast<int32>(Type), *AssociatedLockID.ToString());

	return Name;
}

bool UKeyItemComponent::GiveKey(AActor* Target, FName KeyName)
{
	if (!Target) return false;

	int32 KeyIndex = FindKeyIndex(KeyName);
	if (KeyIndex == INDEX_NONE)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Key '%s' not found"), *KeyName.ToString());
		return false;
	}

	FKeyData& Key = Keys[KeyIndex];
	Key.bInInventory = true;

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (OwnerChar)
	{
		USkeletalMeshComponent* Mesh = OwnerChar->GetMesh();
		if (Mesh && KeyMesh)
		{
			UE_LOG(LogTemp, Log, TEXT("KeyItem: Gave key '%s' to '%s' (socket: hand_r_socket)"),
				*KeyName.ToString(), *Target->GetName());
		}
	}

	UE_LOG(LogTemp, Log, TEXT("KeyItem: Key '%s' added to inventory"), *KeyName.ToString());
	return true;
}

bool UKeyItemComponent::UseKey(FName KeyName, FName LockID)
{
	int32 KeyIndex = FindKeyIndex(KeyName);
	if (KeyIndex == INDEX_NONE)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Key '%s' not found"), *KeyName.ToString());
		return false;
	}

	FKeyData& Key = Keys[KeyIndex];

	if (Key.bUsed)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Key '%s' already used"), *KeyName.ToString());
		return false;
	}

	if (!Key.bInInventory)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Key '%s' not in inventory"), *KeyName.ToString());
		return false;
	}

	int32 LockIndex = FindLockIndex(LockID);
	if (LockIndex == INDEX_NONE)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Lock '%s' not found"), *LockID.ToString());
		return false;
	}

	FLockData& Lock = Locks[LockIndex];

	if (Lock.bUnlocked)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Lock '%s' already unlocked"), *LockID.ToString());
		return false;
	}

	if (Key.KeyType != Lock.RequiredKeyType && Key.KeyType != EKeyType::Master)
	{
		UE_LOG(LogTemp, Warning, TEXT("KeyItem: Key '%s' type %d does not match lock '%s' required type %d"),
			*KeyName.ToString(), static_cast<int32>(Key.KeyType),
			*LockID.ToString(), static_cast<int32>(Lock.RequiredKeyType));
		return false;
	}

	Key.bUsed = true;
	Lock.bUnlocked = true;

	if (Lock.LockedActor)
	{
		UPrimitiveComponent* RootComp = Cast<UPrimitiveComponent>(Lock.LockedActor->GetRootComponent());
		if (RootComp)
		{
			RootComp->SetCollisionProfileName(TEXT("NoCollision"));
			RootComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		}

		UStaticMeshComponent* MeshComp = Lock.LockedActor->FindComponentByClass<UStaticMeshComponent>();
		if (MeshComp)
		{
			MeshComp->SetCollisionProfileName(TEXT("NoCollision"));
			MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		}

		UBoxComponent* BoxComp = Lock.LockedActor->FindComponentByClass<UBoxComponent>();
		if (BoxComp)
		{
			BoxComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		}
	}

	PlayUnlockEffects(Lock.LockedActor);

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (OwnerChar && UnlockMontage && OwnerChar->GetMesh() && OwnerChar->GetMesh()->GetAnimInstance())
	{
		OwnerChar->GetMesh()->GetAnimInstance()->Montage_Play(UnlockMontage, 1.0f);
	}

	UE_LOG(LogTemp, Log, TEXT("KeyItem: Used key '%s' on lock '%s' - SUCCESS"), *KeyName.ToString(), *LockID.ToString());
	return true;
}

void UKeyItemComponent::PlayUnlockEffects(AActor* LockedActor)
{
	FVector EffectLocation = LockedActor ? LockedActor->GetActorLocation() : GetOwner()->GetActorLocation();

	if (UnlockSound)
	{
		UGameplayStatics::PlaySoundAtLocation(GetWorld(), UnlockSound, EffectLocation);
	}
}

bool UKeyItemComponent::RemoveKey(FName KeyName)
{
	int32 Index = FindKeyIndex(KeyName);
	if (Index == INDEX_NONE) return false;

	Keys.RemoveAt(Index);

	UE_LOG(LogTemp, Log, TEXT("KeyItem: Removed key '%s'"), *KeyName.ToString());
	return true;
}

void UKeyItemComponent::RegisterLock(FName LockID, EKeyType RequiredType, AActor* LockedActor)
{
	FLockData NewLock;
	NewLock.LockID = LockID;
	NewLock.RequiredKeyType = RequiredType;
	NewLock.bUnlocked = false;
	NewLock.LockedActor = LockedActor;
	Locks.Add(NewLock);

	UE_LOG(LogTemp, Log, TEXT("KeyItem: Registered lock '%s' type=%d actor='%s'"),
		*LockID.ToString(), static_cast<int32>(RequiredType),
		LockedActor ? *LockedActor->GetName() : TEXT("none"));
}

void UKeyItemComponent::UnlockLock(FName LockID)
{
	int32 Index = FindLockIndex(LockID);
	if (Index == INDEX_NONE) return;

	FLockData& Lock = Locks[Index];
	Lock.bUnlocked = true;

	if (Lock.LockedActor)
	{
		UPrimitiveComponent* RootComp = Cast<UPrimitiveComponent>(Lock.LockedActor->GetRootComponent());
		if (RootComp)
		{
			RootComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		}

		UStaticMeshComponent* MeshComp = Lock.LockedActor->FindComponentByClass<UStaticMeshComponent>();
		if (MeshComp)
		{
			MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		}
	}

	PlayUnlockEffects(Lock.LockedActor);

	UE_LOG(LogTemp, Log, TEXT("KeyItem: Unlocked lock '%s'"), *LockID.ToString());
}

TArray<FName> UKeyItemComponent::ListKeys() const
{
	TArray<FName> Names;
	for (const FKeyData& K : Keys)
	{
		Names.Add(K.KeyName);
	}
	return Names;
}

bool UKeyItemComponent::HasKey(FName KeyName) const
{
	return FindKeyIndex(KeyName) != INDEX_NONE;
}

bool UKeyItemComponent::IsLockUnlocked(FName LockID) const
{
	int32 Index = FindLockIndex(LockID);
	if (Index == INDEX_NONE) return false;
	return Locks[Index].bUnlocked;
}
