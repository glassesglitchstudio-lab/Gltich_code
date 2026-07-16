#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "UDialogueNode.h"
#include "UDialogueData.generated.h"

UCLASS(BlueprintType)
class GLITCHCODEAI_API UDialogueData : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString DialogueID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString DialogueName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString StartNodeID;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<UDialogueNode*> Nodes;

    UFUNCTION(BlueprintCallable, Category = "Dialogue")
    UDialogueNode* FindNode(const FString& NodeID) const;

    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("DialogueData", FName(*DialogueID));
    }
};
