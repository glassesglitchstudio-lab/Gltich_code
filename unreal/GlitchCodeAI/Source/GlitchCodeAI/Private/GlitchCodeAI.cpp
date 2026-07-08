#include "GlitchCodeAI.h"

DEFINE_LOG_CATEGORY(LogGlitchCodeAI);

#define LOCTEXT_NAMESPACE "FGlitchCodeAIModule"

void FGlitchCodeAIModule::StartupModule()
{
	UE_LOG(LogGlitchCodeAI, Log, TEXT("GlitchCodeAI module started"));
}

void FGlitchCodeAIModule::ShutdownModule()
{
	UE_LOG(LogGlitchCodeAI, Log, TEXT("GlitchCodeAI module shut down"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGlitchCodeAIModule, GlitchCodeAI)
