#include "UDialogueData.h"

UDialogueNode* UDialogueData::FindNode(const FString& NodeID) const
{
    for (UDialogueNode* Node : Nodes)
    {
        if (Node && Node->NodeID == NodeID)
        {
            return Node;
        }
    }
    return nullptr;
}
