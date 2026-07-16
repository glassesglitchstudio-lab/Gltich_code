#pragma once

#include "CoreMinimal.h"
#include "Components/BoxComponent.h"
#include "UDialogueTrigger.generated.h"

class UDialogueManager;

UCLASS(ClassGroup=(GlitchCodeAI), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UDialogueTrigger : public UBoxComponent
{
    GENERATED_BODY()

public:
    UDialogueTrigger();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue Trigger")
    FString DialogueIDToStart;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue Trigger")
    bool bTriggerOnce = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue Trigger")
    bool bAutoStart = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue Trigger")
    FString RequiredTag = "Player";

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue Trigger")
    FString InteractPrompt = "Press E to talk";

    UPROPERTY(BlueprintReadOnly, Category = "Dialogue Trigger")
    bool bHasTriggered = false;

    UPROPERTY(BlueprintReadOnly, Category = "Dialogue Trigger")
    bool bPlayerInRange = false;

    UPROPERTY(BlueprintReadOnly, Category = "Dialogue Trigger")
    bool bPromptVisible = false;

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION()
    void OnOverlapBegin(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex,
        bool bFromSweep,
        const FHitResult& SweepResult
    );

    UFUNCTION()
    void OnOverlapEnd(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex
    );

    UFUNCTION()
    void OnDialogueEnded(const FString& EndedDialogueID);

private:
    UPROPERTY()
    AActor* OverlappingActor = nullptr;

    UFUNCTION()
    void TryStartDialogue();

    UDialogueManager* FindDialogueManager() const;
};
