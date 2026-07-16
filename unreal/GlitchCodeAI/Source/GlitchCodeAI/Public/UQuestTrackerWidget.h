#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UQuestData.h"
#include "UQuestTrackerWidget.generated.h"

USTRUCT(BlueprintType)
struct FTrackedQuest
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString QuestID;

    UPROPERTY(BlueprintReadOnly)
    FString QuestTitle;

    UPROPERTY(BlueprintReadOnly)
    TArray<FQuestObjective> Objectives;

    UPROPERTY(BlueprintReadOnly)
    bool bCompleted = false;
};

UCLASS()
class GLITCHCODEAI_API UQuestTrackerWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "HUD|Quest")
    void ShowQuest(const FString& QuestID, const FString& Title, const TArray<FQuestObjective>& Objectives);

    UFUNCTION(BlueprintCallable, Category = "HUD|Quest")
    void UpdateObjective(const FString& QuestID, int32 ObjectiveIndex, int32 NewCount);

    UFUNCTION(BlueprintCallable, Category = "HUD|Quest")
    void CompleteQuest(const FString& QuestID);

    UFUNCTION(BlueprintCallable, Category = "HUD|Quest")
    void FadeOut(float Duration);

protected:
    UPROPERTY(meta = (BindWidget))
    class UVerticalBox* QuestList;

    UPROPERTY(meta = (BindWidgetOptional))
    class UTextBlock* TitleText;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Quest")
    float FadeOutDuration = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Quest")
    int32 MaxVisibleQuests = 5;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Quest")
    FLinearColor ActiveQuestColor = FLinearColor::White;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Quest")
    FLinearColor CompletedQuestColor = FLinearColor(0.0f, 1.0f, 0.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HUD|Quest")
    FLinearColor ObjectiveCompleteColor = FLinearColor(0.5f, 0.5f, 0.5f, 1.0f);

    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

private:
    TArray<FTrackedQuest> TrackedQuests;

    bool bIsFading = false;
    float FadeElapsed = 0.0f;
    float FadeDuration = 0.0f;
    float FadeStartAlpha = 1.0f;

    void RefreshQuestList();
};
