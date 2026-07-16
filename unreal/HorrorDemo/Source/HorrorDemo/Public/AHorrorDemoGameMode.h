#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "AHorrorDemoGameMode.generated.h"

UCLASS()
class AHorrorDemoGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHorrorDemoGameMode();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category = "HorrorDemo")
    void SpawnHorrorRoom();

    UFUNCTION(BlueprintCallable, Category = "HorrorDemo")
    void StartHorrorEvent();

    UFUNCTION(BlueprintCallable, Category = "HorrorDemo")
    void ResetDemo();

protected:
    UPROPERTY(EditDefaultsOnly, Category = "HorrorDemo")
    TSubclassOf<AActor> EnemyClass;

    UPROPERTY(EditDefaultsOnly, Category = "HorrorDemo")
    TSubclassOf<AActor> DoorClass;

    UPROPERTY(EditDefaultsOnly, Category = "HorrorDemo")
    TArray<TSubclassOf<AActor>> PropClasses;
};
