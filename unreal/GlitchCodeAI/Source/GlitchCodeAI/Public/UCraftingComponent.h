#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/Character.h"
#include "Sound/SoundCue.h"
#include "Particles/ParticleSystemComponent.h"
#include "UCraftingComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnItemCrafted, const FString&, RecipeName);

USTRUCT(BlueprintType)
struct FCraftingRecipe
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting")
	FString RecipeName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting")
	TMap<FName, int32> Materials;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting")
	FName ResultItem;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting")
	int32 ResultQuantity = 1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting")
	bool bDiscovered = false;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UCraftingComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "Crafting")
	FOnItemCrafted OnItemCrafted;

	UCraftingComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Crafting")
	bool Craft(const FString& RecipeName);

	UFUNCTION(BlueprintCallable, Category = "Crafting")
	void AddRecipe(const FString& Name, const TMap<FName, int32>& Materials, FName Result, int32 ResultQuantity = 1);

	UFUNCTION(BlueprintCallable, Category = "Crafting")
	TArray<FString> ListRecipes() const;

	UFUNCTION(BlueprintCallable, Category = "Crafting")
	TArray<FString> ListDiscoveredRecipes() const;

	UFUNCTION(BlueprintCallable, Category = "Crafting")
	bool HasMaterials(const FString& RecipeName) const;

	UFUNCTION(BlueprintPure, Category = "Crafting")
	bool IsCrafting() const { return bIsCrafting; }

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting|Recipes")
	TArray<FCraftingRecipe> Recipes;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Crafting|Inventory")
	TMap<FName, int32> Inventory;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting|Effects")
	UAnimMontage* CraftingMontage = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting|Effects")
	USoundCue* CraftSound = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting|Effects")
	UParticleSystem* CraftParticle = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crafting|Timing")
	float CraftingDuration = 2.0f;

private:
	bool bIsCrafting = false;
	FTimerHandle CraftingTimerHandle;

	int32 FindRecipeIndex(const FString& Name) const;
	void FinishCrafting(const FString& RecipeName);
	ACharacter* GetOwnerCharacter() const;
	void PlayCraftingEffects(AActor* CraftingStation);
};
