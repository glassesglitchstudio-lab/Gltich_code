using UnrealBuildTool;
using System.Collections.Generic;

public class GlitchCodeAIEditor Target : TargetRules
{
	public GlitchCodeAIEditor(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("GlitchCodeAI");
	}
}
