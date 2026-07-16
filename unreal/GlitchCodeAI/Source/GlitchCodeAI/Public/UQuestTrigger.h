#pragma once

#include "CoreMinimal.h"
#include "Components/BoxComponent.h"
#include "UQuestTrigger.generated.h"

class UQuestManager;

UCLASS(ClassGroup=(GlitchCodeAI), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UQuestTrigger : public UBoxComponent
{
    GENERATED_BODY()

public:
    UQuestTrigger();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Quest Trigger")
    FString QuestIDToGrant;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Quest Trigger")
    bool bTriggerOnce = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Quest Trigger")
    bool bAutoAccept = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Quest Trigger")
    FString RequiredTag = "Player";

    UPROPERTY(BlueprintReadOnly, Category = "Quest Trigger")
    bool bHasTriggered = false;

protected:
    virtual void BeginPlay() override;

    UFUNCTION()
    void OnOverlapBegin(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex,
        bool bFromSweep,
        const FHitResult& SweepResult
    );

private:
    UFUNCTION()
    void HandleQuestCompleted(const FString& CompletedQuestID);

    UQuestManager* FindQuestManager() const;
};
