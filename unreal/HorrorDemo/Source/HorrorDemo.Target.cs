using UnrealBuildTool;

public class HorrorDemo : TargetRules
{
    public HorrorDemo(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
        ExtraModuleNames.Add("HorrorDemo");
    }
}
