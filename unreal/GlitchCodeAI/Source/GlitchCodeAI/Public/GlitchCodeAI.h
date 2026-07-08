#pragma once

#include "CoreMinimal.h"

DECLARE_LOG_CATEGORY_EXTERN(LogGlitchCodeAI, Log, All);

GLITCHCODEAI_API DECLARE_MULTICAST_DELEGATE_OneParam(FOnGlitchCodeResponse, const FString&);

class GLITCHCODEAI_API FGlitchCodeAIModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;
};
