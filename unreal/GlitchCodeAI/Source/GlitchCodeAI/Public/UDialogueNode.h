#pragma once

#include "CoreMinimal.h"
#include "UDialogueNode.generated.h"

USTRUCT(BlueprintType)
struct FDialogueChoice
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString ChoiceID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString Text;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString NextNodeID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bRequiresItem = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString RequiredItemID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bRequiresQuest = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString RequiredQuestID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bHidden = false;
};

UCLASS(BlueprintType)
class GLITCHCODEAI_API UDialogueNode : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString NodeID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString SpeakerName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (MultiLine = "true"))
    FString Text;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FDialogueChoice> Choices;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString AudioClipPath;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float DisplayDuration = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bIsEndNode = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString NextNodeID; // Auto-advance (no choices)
};
