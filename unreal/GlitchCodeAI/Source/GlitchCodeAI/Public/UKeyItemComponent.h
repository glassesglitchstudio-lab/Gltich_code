#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Components/BoxComponent.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundCue.h"
#include "UKeyItemComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnKeyUsed, const FString&, KeyName, AActor*, LockTarget);

UENUM(BlueprintType)
enum class EKeyType : uint8
{
	None		UMETA(DisplayName = "None"),
	Standard	UMETA(DisplayName = "Standard"),
	Master		UMETA(DisplayName = "Master"),
	Special		UMETA(DisplayName = "Special"),
	Boss		UMETA(DisplayName = "Boss")
};

USTRUCT(BlueprintType)
struct FKeyData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem")
	FName KeyName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem")
	EKeyType KeyType = EKeyType::Standard;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem")
	FName AssociatedLockID;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "KeyItem")
	bool bUsed = false;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "KeyItem")
	bool bInInventory = false;
};

USTRUCT(BlueprintType)
struct FLockData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem")
	FName LockID;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem")
	EKeyType RequiredKeyType = EKeyType::Standard;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "KeyItem")
	bool bUnlocked = false;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "KeyItem")
	AActor* LockedActor = nullptr;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UKeyItemComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "KeyItem")
	FOnKeyUsed OnKeyUsed;

	UKeyItemComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "KeyItem")
	FName CreateKey(FName Name, EKeyType Type, FName AssociatedLockID);

	UFUNCTION(BlueprintCallable, Category = "KeyItem")
	bool GiveKey(AActor* Target, FName KeyName);

	UFUNCTION(BlueprintCallable, Category = "KeyItem")
	bool UseKey(FName KeyName, FName LockID);

	UFUNCTION(BlueprintCallable, Category = "KeyItem")
	bool RemoveKey(FName KeyName);

	UFUNCTION(BlueprintCallable, Category = "KeyItem")
	void RegisterLock(FName LockID, EKeyType RequiredType, AActor* LockedActor);

	UFUNCTION(BlueprintCallable, Category = "KeyItem")
	void UnlockLock(FName LockID);

	UFUNCTION(BlueprintPure, Category = "KeyItem")
	TArray<FName> ListKeys() const;

	UFUNCTION(BlueprintPure, Category = "KeyItem")
	bool HasKey(FName KeyName) const;

	UFUNCTION(BlueprintPure, Category = "KeyItem")
	bool IsLockUnlocked(FName LockID) const;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem|Data")
	TArray<FKeyData> Keys;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem|Data")
	TArray<FLockData> Locks;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem|Effects")
	USoundCue* UnlockSound = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem|Effects")
	UStaticMesh* KeyMesh = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem|Effects")
	UStaticMesh* LockMesh = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "KeyItem|Animation")
	UAnimMontage* UnlockMontage = nullptr;

private:
	int32 FindKeyIndex(FName KeyName) const;
	int32 FindLockIndex(FName LockID) const;
	ACharacter* GetOwnerCharacter() const;
	void PlayUnlockEffects(AActor* LockedActor);
};
