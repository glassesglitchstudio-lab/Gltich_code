using UnrealBuildTool;

public class HorrorDemoEditor : TargetRules
{
    public HorrorDemoEditor(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
        ExtraModuleNames.Add("HorrorDemo");
    }
}
