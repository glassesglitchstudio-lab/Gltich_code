using UnrealBuildTool;

public class HorrorDemoEditor : TargetRules
{
    public HorrorDemoEditor(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
        ExtraModuleNames.Add("HorrorDemo");
    }
}
