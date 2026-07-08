#include "GlitchCodeAIEditorModule.h"
#include "GlitchCodeAIPanel.h"
#include "Framework/Docking/TabManager.h"
#include "Widgets/Docking/SDockTab.h"

#define LOCTEXT_NAMESPACE "FGlitchCodeAIEditorModule"

const FName FGlitchCodeAIEditorModule::GlitchCodeAITabId("GlitchCodeAITab");

void FGlitchCodeAIEditorModule::StartupModule()
{
	FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
		GlitchCodeAITabId,
		FOnSpawnTab::CreateRaw(this, &FGlitchCodeAIEditorModule::SpawnGlitchCodeAITab)
	)
	.SetDisplayName(LOCTEXT("TabTitle", "GlitchCode AI"))
	.SetTooltipText(LOCTEXT("TabTooltip", "Open the GlitchCode AI chat panel"))
	.SetIcon(FSlateIcon(
		FAppStyle::GetAppStyleSetName(),
		"ClassIcon.Actor"
	));

	UE_LOG(LogTemp, Log, TEXT("GlitchCodeAIEditor module registered"));
}

void FGlitchCodeAIEditorModule::ShutdownModule()
{
	FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(GlitchCodeAITabId);
	UE_LOG(LogTemp, Log, TEXT("GlitchCodeAIEditor module shut down"));
}

void FGlitchCodeAIEditorModule::OpenGlitchCodeAIPanel()
{
	FGlobalTabmanager::Get()->TryInvokeTab(GlitchCodeAITabId);
}

TSharedRef<SDockTab> FGlitchCodeAIEditorModule::SpawnGlitchCodeAITab(const FSpawnTabArgs& Args)
{
	return SNew(SDockTab)
		.TabRole(ETabRole::NomadTab)
		[
			SNew(SGlitchCodeAIPanel)
		];
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGlitchCodeAIEditorModule, GlitchCodeAIEditor)
