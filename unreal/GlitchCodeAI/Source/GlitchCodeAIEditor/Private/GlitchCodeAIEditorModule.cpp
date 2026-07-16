#include "GlitchCodeAIEditorModule.h"
#include "GlitchCodeAIPanel.h"
#include "Widgets/Docking/SDockTab.h"
#include "Framework/Docking/TabManager.h"
#include "ToolMenus.h"
#include "Editor.h"

#define LOCTEXT_NAMESPACE "GlitchCodeAIEditorModule"

static const FName GlitchCodeAITabName("GlitchCodeAITab");

void FGlitchCodeAIEditorModule::StartupModule()
{
    // Register tab spawner
    FGlobalTabmanager::Get()->RegisterNomadTabSpawner(GlitchCodeAITabName,
        FOnSpawnTab::CreateRaw(this, &FGlitchCodeAIEditorModule::OnSpawnTab))
        .SetDisplayName(LOCTEXT("TabTitle", "GlitchCode AI"))
        .SetMenuType(ETabSpawnerMenuType::Hidden)
        .SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "Icons.Bot"));
    
    // Add toolbar button
    if (UToolMenus::IsToolMenuUIEnabled())
    {
        UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
        FToolMenuSection& Section = Menu->AddSection("GlitchCodeAI", LOCTEXT("MenuSection", "GlitchCode AI"));
        
        Section.AddMenuEntry(
            "OpenGlitchCodeAIPanel",
            LOCTEXT("MenuEntry", "GlitchCode AI Panel"),
            LOCTEXT("MenuEntryTip", "Open the GlitchCode AI assistant panel"),
            FSlateIcon(FAppStyle::GetAppStyleSetName(), "Icons.Bot"),
            FUIAction(FExecuteAction::CreateRaw(this, &FGlitchCodeAIEditorModule::OpenTab))
        );
    }
    
    UE_LOG(LogTemp, Log, TEXT("GlitchCodeAI Editor Module: Registered"));
}

void FGlitchCodeAIEditorModule::ShutdownModule()
{
    FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(GlitchCodeAITabName);
    
    if (UToolMenus::IsToolMenuUIEnabled())
    {
        UToolMenus::UnRegisterStartupCallback(this);
    }
    
    UE_LOG(LogTemp, Log, TEXT("GlitchCodeAI Editor Module: Unregistered"));
}

TSharedRef<SDockTab> FGlitchCodeAIEditorModule::OnSpawnTab(const FSpawnTabArgs& SpawnTabArgs)
{
    return SNew(SDockTab)
        .TabRole(ETabRole::NomadTab)
        [
            SNew(SGlitchCodeAIPanel)
        ];
}

void FGlitchCodeAIEditorModule::OpenTab()
{
    FGlobalTabmanager::Get()->TryInvokeTab(GlitchCodeAITabName);
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGlitchCodeAIEditorModule, GlitchCodeAIEditor)
