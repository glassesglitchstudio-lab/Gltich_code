#include "UCraftingComponent.h"
#include "Engine/World.h"
#include "TimerManager.h"

UCraftingComponent::UCraftingComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.0f;
}

void UCraftingComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UCraftingComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}

ACharacter* UCraftingComponent::GetOwnerCharacter() const
{
	return Cast<ACharacter>(GetOwner());
}

int32 UCraftingComponent::FindRecipeIndex(const FString& Name) const
{
	for (int32 i = 0; i < Recipes.Num(); ++i)
	{
		if (Recipes[i].RecipeName == Name) return i;
	}
	return INDEX_NONE;
}

bool UCraftingComponent::Craft(const FString& RecipeName)
{
	if (bIsCrafting)
	{
		UE_LOG(LogTemp, Warning, TEXT("Crafting: Already crafting, cannot start '%s'"), *RecipeName);
		return false;
	}

	int32 Index = FindRecipeIndex(RecipeName);
	if (Index == INDEX_NONE)
	{
		UE_LOG(LogTemp, Warning, TEXT("Crafting: Recipe '%s' not found"), *RecipeName);
		return false;
	}

	const FCraftingRecipe& Recipe = Recipes[Index];

	// Check all materials
	for (const auto& Pair : Recipe.Materials)
	{
		if (Pair.Value <= 0) continue;

		const int32* HaveAmount = Inventory.Find(Pair.Key);
		if (!HaveAmount || *HaveAmount < Pair.Value)
		{
			UE_LOG(LogTemp, Warning, TEXT("Crafting: Missing material '%s' (need %d) for recipe '%s'"),
				*Pair.Key.ToString(), Pair.Value, *RecipeName);
			return false;
		}
	}

	// Remove materials
	for (const auto& Pair : Recipe.Materials)
	{
		int32* Amount = Inventory.Find(Pair.Key);
		if (Amount)
		{
			*Amount -= Pair.Value;
			if (*Amount <= 0)
			{
				Inventory.Remove(Pair.Key);
			}
		}
	}

	bIsCrafting = true;

	ACharacter* OwnerChar = GetOwnerCharacter();
	if (OwnerChar && CraftingMontage && OwnerChar->GetMesh() && OwnerChar->GetMesh()->GetAnimInstance())
	{
		OwnerChar->GetMesh()->GetAnimInstance()->Montage_Play(CraftingMontage, 1.0f);
	}

	if (CraftSound)
	{
		UGameplayStatics::PlaySoundAtLocation(GetWorld(), CraftSound, GetOwner()->GetActorLocation());
	}

	if (CraftParticle)
	{
		UGameplayStatics::SpawnEmitterAtLocation(
			GetWorld(),
			CraftParticle,
			GetOwner()->GetActorLocation(),
			FRotator::ZeroRotator,
			FVector(1.0f),
			true,
			EPSCPoolMethod::AutoRelease,
			true
		);
	}

	FTimerDelegate CraftDelegate;
	CraftDelegate.BindUObject(this, &UCraftingComponent::FinishCrafting, RecipeName);
	GetWorld()->GetTimerManager().SetTimer(CraftingTimerHandle, CraftDelegate, CraftingDuration, false);

	UE_LOG(LogTemp, Log, TEXT("Crafting: Started crafting '%s' -> '%s'"), *RecipeName, *Recipe.ResultItem.ToString());
	return true;
}

void UCraftingComponent::FinishCrafting(const FString& RecipeName)
{
	bIsCrafting = false;

	int32 Index = FindRecipeIndex(RecipeName);
	if (Index != INDEX_NONE)
	{
		const FCraftingRecipe& Recipe = Recipes[Index];
		UE_LOG(LogTemp, Log, TEXT("Crafting: Completed '%s' -> %s x%d"),
			*RecipeName, *Recipe.ResultItem.ToString(), Recipe.ResultQuantity);
	}
}

void UCraftingComponent::AddRecipe(const FString& Name, const TMap<FName, int32>& Materials, FName Result, int32 ResultQuantity)
{
	FCraftingRecipe NewRecipe;
	NewRecipe.RecipeName = Name;
	NewRecipe.Materials = Materials;
	NewRecipe.ResultItem = Result;
	NewRecipe.ResultQuantity = ResultQuantity;
	NewRecipe.bDiscovered = true;
	Recipes.Add(NewRecipe);

	UE_LOG(LogTemp, Log, TEXT("Crafting: Added recipe '%s'"), *Name);
}

TArray<FString> UCraftingComponent::ListRecipes() const
{
	TArray<FString> Names;
	for (const FCraftingRecipe& R : Recipes)
	{
		Names.Add(R.RecipeName);
	}
	return Names;
}

TArray<FString> UCraftingComponent::ListDiscoveredRecipes() const
{
	TArray<FString> Names;
	for (const FCraftingRecipe& R : Recipes)
	{
		if (R.bDiscovered)
		{
			Names.Add(R.RecipeName);
		}
	}
	return Names;
}

bool UCraftingComponent::HasMaterials(const FString& RecipeName) const
{
	int32 Index = FindRecipeIndex(RecipeName);
	if (Index == INDEX_NONE) return false;

	const FCraftingRecipe& Recipe = Recipes[Index];

	for (const auto& Pair : Recipe.Materials)
	{
		if (Pair.Value <= 0) continue;

		const int32* HaveAmount = Inventory.Find(Pair.Key);
		if (!HaveAmount || *HaveAmount < Pair.Value)
		{
			return false;
		}
	}

	return true;
}

void UCraftingComponent::PlayCraftingEffects(AActor* CraftingStation)
{
	if (!CraftingStation) return;

	if (CraftSound)
	{
		UGameplayStatics::PlaySoundAtLocation(GetWorld(), CraftSound, CraftingStation->GetActorLocation());
	}

	if (CraftParticle)
	{
		UGameplayStatics::SpawnEmitterAtLocation(
			GetWorld(),
			CraftParticle,
			CraftingStation->GetActorLocation(),
			FRotator::ZeroRotator,
			FVector(1.0f),
			true,
			EPSCPoolMethod::AutoRelease,
			true
		);
	}
}
