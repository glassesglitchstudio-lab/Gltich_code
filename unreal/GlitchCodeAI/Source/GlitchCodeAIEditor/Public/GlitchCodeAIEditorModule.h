#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class FGlitchCodeAIEditorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	static void OpenGlitchCodeAIPanel();

private:
	TSharedRef<SDockTab> SpawnGlitchCodeAITab(const FSpawnTabArgs& Args);

	static const FName GlitchCodeAITabId;
};
