using UnrealBuildTool;

public class GlitchCodeAIEditor : ModuleRules
{
	public GlitchCodeAIEditor(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"Slate",
			"SlateCore",
			"GlitchCodeAI"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"EditorStyle",
			"UnrealEd",
			"ToolMenus",
			"InputCore"
		});
	}
}
