#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UEnemyWaveManager.generated.h"

USTRUCT(BlueprintType)
struct FWaveSpawnPoint
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	FVector Location = FVector::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	FRotator Rotation = FRotator::ZeroRotator;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	bool bIsActive = true;
};

USTRUCT(BlueprintType)
struct FWaveConfig
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	int32 WaveNumber = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TArray<FWaveSpawnPoint> SpawnPoints;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	int32 EnemyCount = 5;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TArray<FString> EnemyTypes;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	float SpawnDelay = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	float DifficultyMultiplier = 1.0f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWaveComplete, int32, WaveNumber);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAllWavesComplete);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UEnemyWaveManager : public UActorComponent
{
	GENERATED_BODY()

public:
	UEnemyWaveManager();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Wave Control
	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void StartWaves(int32 TotalWaves);

	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void StopWaves();

	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void PauseWaves();

	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void ResumeWaves();

	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void SpawnWave(int32 WaveNumber);

	// Wave Configuration
	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void SetWaveConfig(int32 WaveNumber, const TArray<FWaveSpawnPoint>& SpawnPoints, int32 EnemyCount, const TArray<FString>& EnemyTypes);

	UFUNCTION(BlueprintCallable, Category = "Enemy Wave")
	void SetWaveSpawnDelay(int32 WaveNumber, float Delay);

	// Queries
	UFUNCTION(BlueprintPure, Category = "Enemy Wave")
	int32 GetCurrentWave() const { return CurrentWave; }

	UFUNCTION(BlueprintPure, Category = "Enemy Wave")
	int32 GetTotalWaves() const { return TotalWaves; }

	UFUNCTION(BlueprintPure, Category = "Enemy Wave")
	bool IsWaveActive() const { return bWaveActive; }

	UFUNCTION(BlueprintPure, Category = "Enemy Wave")
	int32 GetRemainingEnemies() const { return RemainingEnemies; }

	UFUNCTION(BlueprintPure, Category = "Enemy Wave")
	float GetWaveProgress() const;

	// Events
	UPROPERTY(BlueprintAssignable, Category = "Enemy Wave")
	FOnWaveComplete OnWaveComplete;

	UPROPERTY(BlueprintAssignable, Category = "Enemy Wave")
	FOnAllWavesComplete OnAllWavesComplete;

	// Properties
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy Wave")
	float TimeBetweenWaves = 5.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy Wave")
	float DifficultyScaling = 1.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Enemy Wave")
	int32 MaxEnemiesPerWave = 20;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TMap<int32, FWaveConfig> WaveConfigs;

	int32 CurrentWave = 0;
	int32 TotalWaves = 0;
	int32 RemainingEnemies = 0;
	int32 TotalSpawnedThisWave = 0;

	bool bWaveActive = false;
	bool bWavesPaused = false;
	bool bAllComplete = false;

	float WaveTimer = 0.0f;
	float SpawnTimer = 0.0f;
	int32 CurrentSpawnIndex = 0;
	int32 EnemiesSpawnedThisBatch = 0;

	void SpawnNextEnemy();
	void OnEnemyKilled();
	FWaveConfig GenerateDefaultWave(int32 WaveNumber) const;

	UPROPERTY()
	TArray<AActor*> SpawnedEnemiesThisWave;
};
