using UnrealBuildTool;

public class HorrorDemo : ModuleRules
{
    public HorrorDemo(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "GlitchCodeAI"
        });
    }
}
