using UnrealBuildTool;

public class GlitchCodeAI : ModuleRules
{
	public GlitchCodeAI(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"HTTP",
			"Json",
			"JsonUtilities",
			"Niagara",
			"NiagaraCore",
			"OnlineSubsystem",
			"OnlineSubsystemUtils",
			"UMG",
			"SlateCore",
			"Slate",
			"AudioMixer",
			"GameplayTags",
			"DeveloperSettings"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"NavigationSystem",
			"AIModule"
		});

		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
		}
	}
}
