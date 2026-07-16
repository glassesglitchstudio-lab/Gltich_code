#include "UEnemyWaveManager.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"

UEnemyWaveManager::UEnemyWaveManager()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.05f;
}

void UEnemyWaveManager::BeginPlay()
{
	Super::BeginPlay();
}

void UEnemyWaveManager::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!bWaveActive || bWavesPaused || bAllComplete)
	{
		return;
	}

	// Wait between waves
	if (WaveTimer > 0.0f)
	{
		WaveTimer -= DeltaTime;
		return;
	}

	// Spawn enemies gradually
	const FWaveConfig* Config = WaveConfigs.Find(CurrentWave);
	if (!Config)
	{
		return;
	}

	SpawnTimer -= DeltaTime;
	if (SpawnTimer <= 0.0f && EnemiesSpawnedThisBatch < Config->EnemyCount)
	{
		SpawnNextEnemy();
		SpawnTimer = Config->SpawnDelay;
	}

	// Check if all enemies in this wave are spawned and dead
	if (EnemiesSpawnedThisBatch >= Config->EnemyCount && RemainingEnemies <= 0)
	{
		OnWaveComplete.Broadcast(CurrentWave);

		if (CurrentWave >= TotalWaves)
		{
			bAllComplete = true;
			bWaveActive = false;
			OnAllWavesComplete.Broadcast();
		}
		else
		{
			CurrentWave++;
			WaveTimer = TimeBetweenWaves;
			SpawnTimer = 0.0f;
			EnemiesSpawnedThisBatch = 0;
			SpawnedEnemiesThisWave.Empty();
		}
	}
}

void UEnemyWaveManager::StartWaves(int32 InTotalWaves)
{
	TotalWaves = FMath::Max(1, InTotalWaves);
	CurrentWave = 1;
	bWaveActive = true;
	bAllComplete = false;
	bWavesPaused = false;
	WaveTimer = 0.0f;
	SpawnTimer = 0.0f;
	EnemiesSpawnedThisBatch = 0;
	SpawnedEnemiesThisWave.Empty();

	// Generate default configs for any waves not explicitly configured
	for (int32 i = 1; i <= TotalWaves; ++i)
	{
		if (!WaveConfigs.Contains(i))
		{
			WaveConfigs.Add(i, GenerateDefaultWave(i));
		}
	}

	const FWaveConfig* Config = WaveConfigs.Find(CurrentWave);
	if (Config)
	{
		RemainingEnemies = Config->EnemyCount;
	}
}

void UEnemyWaveManager::StopWaves()
{
	bWaveActive = false;
	bAllComplete = false;
	CurrentWave = 0;
	RemainingEnemies = 0;
	EnemiesSpawnedThisBatch = 0;
	SpawnedEnemiesThisWave.Empty();
}

void UEnemyWaveManager::PauseWaves()
{
	bWavesPaused = true;
}

void UEnemyWaveManager::ResumeWaves()
{
	bWavesPaused = false;
}

void UEnemyWaveManager::SpawnWave(int32 WaveNumber)
{
	if (WaveNumber < 1 || WaveNumber > TotalWaves)
	{
		return;
	}

	CurrentWave = WaveNumber;
	bWaveActive = true;
	bWavesPaused = false;
	WaveTimer = 0.0f;
	SpawnTimer = 0.0f;
	EnemiesSpawnedThisBatch = 0;
	SpawnedEnemiesThisWave.Empty();

	const FWaveConfig* Config = WaveConfigs.Find(CurrentWave);
	if (Config)
	{
		RemainingEnemies = Config->EnemyCount;
	}
}

void UEnemyWaveManager::SetWaveConfig(int32 WaveNumber, const TArray<FWaveSpawnPoint>& SpawnPoints, int32 InEnemyCount, const TArray<FString>& EnemyTypes)
{
	FWaveConfig Config;
	Config.WaveNumber = WaveNumber;
	Config.SpawnPoints = SpawnPoints;
	Config.EnemyCount = FMath::Min(InEnemyCount, MaxEnemiesPerWave);
	Config.EnemyTypes = EnemyTypes;
	Config.DifficultyMultiplier = FMath::Pow(DifficultyScaling, WaveNumber - 1);

	WaveConfigs.Add(WaveNumber, Config);
}

void UEnemyWaveManager::SetWaveSpawnDelay(int32 WaveNumber, float Delay)
{
	FWaveConfig* Config = WaveConfigs.Find(WaveNumber);
	if (Config)
	{
		Config->SpawnDelay = FMath::Max(0.1f, Delay);
	}
}

float UEnemyWaveManager::GetWaveProgress() const
{
	const FWaveConfig* Config = WaveConfigs.Find(CurrentWave);
	if (!Config || Config->EnemyCount == 0)
	{
		return 0.0f;
	}

	int32 Killed = Config->EnemyCount - RemainingEnemies;
	return static_cast<float>(Killed) / static_cast<float>(Config->EnemyCount);
}

void UEnemyWaveManager::SpawnNextEnemy()
{
	FWaveConfig* Config = WaveConfigs.Find(CurrentWave);
	if (!Config || Config->SpawnPoints.Num() == 0)
	{
		return;
	}

	// Pick spawn point cyclically
	int32 SpawnPointIndex = TotalSpawnedThisWave % Config->SpawnPoints.Num();
	const FWaveSpawnPoint& SpawnPoint = Config->SpawnPoints[SpawnPointIndex];

	if (!SpawnPoint.bIsActive)
	{
		TotalSpawnedThisWave++;
		EnemiesSpawnedThisBatch++;
		return;
	}

	// Pick enemy type cyclically
	FString EnemyType = TEXT("DefaultEnemy");
	if (Config->EnemyTypes.Num() > 0)
	{
		int32 TypeIndex = TotalSpawnedThisWave % Config->EnemyTypes.Num();
		EnemyType = Config->EnemyTypes[TypeIndex];
	}

	// Spawn the enemy via console command (handled by game logic)
	AActor* Owner = GetOwner();
	if (Owner)
	{
		UWorld* World = GetWorld();
		if (World)
		{
			// Use deferred spawn — actual class resolution happens in game code
			FActorSpawnParameters SpawnParams;
			SpawnParams.Owner = Owner;

			// For now, log the spawn; actual spawning handled by game-specific code
			UE_LOG(LogTemp, Log, TEXT("Wave %d: Spawning %s at %s"), CurrentWave, *EnemyType, *SpawnPoint.Location.ToString());
		}
	}

	TotalSpawnedThisWave++;
	EnemiesSpawnedThisBatch++;
}

void UEnemyWaveManager::OnEnemyKilled()
{
	if (RemainingEnemies > 0)
	{
		RemainingEnemies--;
	}
}

FWaveConfig UEnemyWaveManager::GenerateDefaultWave(int32 WaveNumber) const
{
	FWaveConfig Config;
	Config.WaveNumber = WaveNumber;
	Config.EnemyCount = FMath::Min(3 + (WaveNumber * 2), MaxEnemiesPerWave);
	Config.SpawnDelay = FMath::Max(0.2f, 1.0f - (WaveNumber * 0.05f));
	Config.DifficultyMultiplier = FMath::Pow(DifficultyScaling, WaveNumber - 1);
	Config.EnemyTypes.Add(TEXT("BasicEnemy"));

	// Generate 4 default spawn points in a circle
	float Radius = 1000.0f;
	for (int32 i = 0; i < 4; ++i)
	{
		float Angle = (i * 90.0f) * (PI / 180.0f);
		FWaveSpawnPoint Point;
		Point.Location = FVector(FMath::Cos(Angle) * Radius, FMath::Sin(Angle) * Radius, 0.0f);
		Point.Rotation = FRotator(0.0f, FMath::RadiansToDegrees(Angle) + 180.0f, 0.0f);
		Point.bIsActive = true;
		Config.SpawnPoints.Add(Point);
	}

	return Config;
}
