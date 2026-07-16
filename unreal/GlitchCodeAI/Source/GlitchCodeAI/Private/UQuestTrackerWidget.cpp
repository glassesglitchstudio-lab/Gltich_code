#include "UQuestTrackerWidget.h"
#include "Components/VerticalBox.h"
#include "Components/TextBlock.h"

void UQuestTrackerWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);

    if (bIsFading)
    {
        FadeElapsed += InDeltaTime;
        float Alpha = FMath::Lerp(FadeStartAlpha, 0.0f, FMath::Clamp(FadeElapsed / FadeDuration, 0.0f, 1.0f));

        if (QuestList)
        {
            QuestList->SetRenderOpacity(Alpha);
        }

        if (FadeElapsed >= FadeDuration)
        {
            bIsFading = false;
            SetVisibility(ESlateVisibility::Collapsed);
        }
    }
}

void UQuestTrackerWidget::ShowQuest(const FString& QuestID, const FString& Title, const TArray<FQuestObjective>& Objectives)
{
    FTrackedQuest NewQuest;
    NewQuest.QuestID = QuestID;
    NewQuest.QuestTitle = Title;
    NewQuest.Objectives = Objectives;
    NewQuest.bCompleted = false;

    // Replace existing quest with same ID
    TrackedQuests.RemoveAll([&QuestID](const FTrackedQuest& Q)
    {
        return Q.QuestID == QuestID;
    });

    // Keep only the most recent quests
    TrackedQuests.Add(NewQuest);
    if (TrackedQuests.Num() > MaxVisibleQuests)
    {
        TrackedQuests.RemoveAt(0);
    }

    RefreshQuestList();

    if (GetVisibility() != ESlateVisibility::Visible)
    {
        SetVisibility(ESlateVisibility::Visible);
    }
}

void UQuestTrackerWidget::UpdateObjective(const FString& QuestID, int32 ObjectiveIndex, int32 NewCount)
{
    for (FTrackedQuest& Quest : TrackedQuests)
    {
        if (Quest.QuestID == QuestID && ObjectiveIndex >= 0 && ObjectiveIndex < Quest.Objectives.Num())
        {
            Quest.Objectives[ObjectiveIndex].CurrentCount = NewCount;
            Quest.Objectives[ObjectiveIndex].bCompleted =
                NewCount >= Quest.Objectives[ObjectiveIndex].RequiredCount;
            break;
        }
    }

    RefreshQuestList();
}

void UQuestTrackerWidget::CompleteQuest(const FString& QuestID)
{
    for (FTrackedQuest& Quest : TrackedQuests)
    {
        if (Quest.QuestID == QuestID)
        {
            Quest.bCompleted = true;
            break;
        }
    }

    RefreshQuestList();
}

void UQuestTrackerWidget::FadeOut(float Duration)
{
    bIsFading = true;
    FadeElapsed = 0.0f;
    FadeDuration = FMath::Max(0.1f, Duration);
    FadeStartAlpha = QuestList ? QuestList->GetRenderOpacity() : 1.0f;
}

void UQuestTrackerWidget::RefreshQuestList()
{
    // Placeholder for rebuilding the quest list UI
    // In a real implementation, this would populate QuestList
    // with widget entries for each tracked quest and its objectives
}
