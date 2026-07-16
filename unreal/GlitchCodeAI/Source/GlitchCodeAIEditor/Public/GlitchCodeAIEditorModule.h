#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class FGlitchCodeAIEditorModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
    
private:
    TSharedRef<SDockTab> OnSpawnTab(const FSpawnTabArgs& SpawnTabArgs);
    void OpenTab();
};
