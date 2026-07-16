#include "UQuestManager.h"

UQuestManager::UQuestManager()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UQuestManager::BeginPlay()
{
    Super::BeginPlay();
}

bool UQuestManager::AcceptQuest(const FString& QuestID)
{
    if (QuestStatusMap.Contains(QuestID))
    {
        EQuestStatus CurrentStatus = QuestStatusMap[QuestID];
        if (CurrentStatus == EQuestStatus::Active || CurrentStatus == EQuestStatus::Completed)
        {
            return false;
        }
    }

    UQuestData* QuestData = GetQuestData(QuestID);
    if (!QuestData)
    {
        return false;
    }

    if (!CheckPrerequisites(QuestID))
    {
        return false;
    }

    QuestStatusMap.Add(QuestID, EQuestStatus::Active);

    TArray<FQuestObjective> Objectives;
    for (const FQuestObjective& Obj : QuestData->Objectives)
    {
        FQuestObjective NewObj = Obj;
        NewObj.CurrentCount = 0;
        NewObj.bCompleted = false;
        Objectives.Add(NewObj);
    }
    QuestObjectivesMap.Add(QuestID, Objectives);

    OnQuestAccepted.Broadcast(QuestID);
    return true;
}

bool UQuestManager::AbandonQuest(const FString& QuestID)
{
    if (!QuestStatusMap.Contains(QuestID))
    {
        return false;
    }

    if (QuestStatusMap[QuestID] != EQuestStatus::Active)
    {
        return false;
    }

    QuestStatusMap[QuestID] = EQuestStatus::Available;
    QuestObjectivesMap.Remove(QuestID);
    return true;
}

bool UQuestManager::CompleteQuest(const FString& QuestID)
{
    if (!QuestStatusMap.Contains(QuestID) || QuestStatusMap[QuestID] != EQuestStatus::Active)
    {
        return false;
    }

    const TArray<FQuestObjective>* Objectives = QuestObjectivesMap.Find(QuestID);
    if (!Objectives)
    {
        return false;
    }

    for (const FQuestObjective& Obj : *Objectives)
    {
        if (!Obj.bOptional && !Obj.bCompleted)
        {
            return false;
        }
    }

    QuestStatusMap[QuestID] = EQuestStatus::Completed;
    OnQuestCompleted.Broadcast(QuestID);
    return true;
}

bool UQuestManager::UpdateObjective(const FString& QuestID, const FString& ObjectiveID, int32 Count)
{
    if (!QuestStatusMap.Contains(QuestID) || QuestStatusMap[QuestID] != EQuestStatus::Active)
    {
        return false;
    }

    FQuestObjective* Objective = FindObjective(QuestID, ObjectiveID);
    if (!Objective || Objective->bCompleted)
    {
        return false;
    }

    Objective->CurrentCount = FMath::Min(Objective->CurrentCount + Count, Objective->RequiredCount);

    if (Objective->CurrentCount >= Objective->RequiredCount)
    {
        Objective->bCompleted = true;
    }

    OnObjectiveUpdated.Broadcast(QuestID, ObjectiveID);
    return true;
}

bool UQuestManager::IsQuestCompleted(const FString& QuestID) const
{
    if (!QuestStatusMap.Contains(QuestID))
    {
        return false;
    }
    return QuestStatusMap[QuestID] == EQuestStatus::Completed;
}

EQuestStatus UQuestManager::GetQuestStatus(const FString& QuestID) const
{
    if (!QuestStatusMap.Contains(QuestID))
    {
        return EQuestStatus::Locked;
    }
    return QuestStatusMap[QuestID];
}

bool UQuestManager::CheckPrerequisites(const FString& QuestID) const
{
    const UQuestData* QuestData = GetQuestData(QuestID);
    if (!QuestData)
    {
        return false;
    }

    for (const FString& PrereqID : QuestData->PrerequisiteQuests)
    {
        if (!IsQuestCompleted(PrereqID))
        {
            return false;
        }
    }

    return true;
}

float UQuestManager::GetQuestProgress(const FString& QuestID) const
{
    const TArray<FQuestObjective>* Objectives = QuestObjectivesMap.Find(QuestID);
    if (!Objectives || Objectives->Num() == 0)
    {
        return 0.0f;
    }

    int32 TotalRequired = 0;
    int32 TotalCurrent = 0;

    for (const FQuestObjective& Obj : *Objectives)
    {
        TotalRequired += Obj.RequiredCount;
        TotalCurrent += Obj.CurrentCount;
    }

    if (TotalRequired == 0)
    {
        return 0.0f;
    }

    return static_cast<float>(TotalCurrent) / static_cast<float>(TotalRequired);
}

TArray<FString> UQuestManager::GetActiveQuests() const
{
    TArray<FString> ActiveQuests;
    for (const auto& Pair : QuestStatusMap)
    {
        if (Pair.Value == EQuestStatus::Active)
        {
            ActiveQuests.Add(Pair.Key);
        }
    }
    return ActiveQuests;
}

TArray<FString> UQuestManager::GetCompletedQuests() const
{
    TArray<FString> CompletedQuests;
    for (const auto& Pair : QuestStatusMap)
    {
        if (Pair.Value == EQuestStatus::Completed)
        {
            CompletedQuests.Add(Pair.Key);
        }
    }
    return CompletedQuests;
}

void UQuestManager::RegisterQuestData(UQuestData* QuestData)
{
    if (QuestData && !QuestData->QuestID.IsEmpty())
    {
        QuestDataMap.Add(QuestData->QuestID, QuestData);
        if (!QuestStatusMap.Contains(QuestData->QuestID))
        {
            QuestStatusMap.Add(QuestData->QuestID, EQuestStatus::Available);
        }
    }
}

UQuestData* UQuestManager::GetQuestData(const FString& QuestID) const
{
    return QuestDataMap.FindRef(QuestID);
}

FQuestObjective* UQuestManager::FindObjective(const FString& QuestID, const FString& ObjectiveID)
{
    TArray<FQuestObjective>* Objectives = QuestObjectivesMap.Find(QuestID);
    if (!Objectives)
    {
        return nullptr;
    }

    for (FQuestObjective& Obj : *Objectives)
    {
        if (Obj.ObjectiveID == ObjectiveID)
        {
            return &Obj;
        }
    }
    return nullptr;
}

const FQuestObjective* UQuestManager::FindObjective(const FString& QuestID, const FString& ObjectiveID) const
{
    const TArray<FQuestObjective>* Objectives = QuestObjectivesMap.Find(QuestID);
    if (!Objectives)
    {
        return nullptr;
    }

    for (const FQuestObjective& Obj : *Objectives)
    {
        if (Obj.ObjectiveID == ObjectiveID)
        {
            return &Obj;
        }
    }
    return nullptr;
}

void UQuestManager::MarkQuestFailed(const FString& QuestID)
{
    if (QuestStatusMap.Contains(QuestID) && QuestStatusMap[QuestID] == EQuestStatus::Active)
    {
        QuestStatusMap[QuestID] = EQuestStatus::Failed;
        OnQuestFailed.Broadcast(QuestID);
    }
}
