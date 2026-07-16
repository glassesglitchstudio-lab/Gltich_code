using UnrealBuildTool;

public class HorrorDemo : TargetRules
{
    public HorrorDemo(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
        ExtraModuleNames.Add("HorrorDemo");
    }
}
