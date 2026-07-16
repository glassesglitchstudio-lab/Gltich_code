import type { Plugin } from "../../packages/plugin/src/index.js"
import { ue5ConsoleTool } from "./ue5-console.js"
import { ue5SpawnActorTool } from "./ue5-spawn-actor.js"
import { ue5ListActorsTool } from "./ue5-list-actors.js"
import { ue5EditBlueprintTool } from "./ue5-edit-blueprint.js"
import { ue5CompileTool } from "./ue5-compile.js"
import { ue5ScreenshotTool } from "./ue5-screenshot.js"
import { ue5DeleteActorTool } from "./ue5-delete-actor.js"
import { ue5MoveActorTool } from "./ue5-move-actor.js"
import { ue5SetMaterialTool } from "./ue5-set-material.js"
import { ue5OpenLevelTool } from "./ue5-open-level.js"
import { ue5PlayTool } from "./ue5-play.js"
import { ue5StopTool } from "./ue5-stop.js"
import { ue5SelectActorTool } from "./ue5-select-actor.js"
import { ue5UndoTool } from "./ue5-undo.js"
import { ue5RedoTool } from "./ue5-redo.js"
import { ue5ContextTool } from "./ue5-context.js"
import { ue5InventoryTool } from "./ue5-inventory.js"
import { ue5ItemSpawnTool } from "./ue5-item-spawn.js"
import { ue5DialogueTool } from "./ue5-dialogue.js"
import { ue5DialogueCreateTool } from "./ue5-dialogue-create.js"
import { ue5QuestTool } from "./ue5-quest.js"
import { ue5QuestDialogueTool } from "./ue5-quest-dialogue.js"
import { ue5AIPerceptionTool } from "./ue5-ai-perception.js"
import { ue5EnemyWaveTool } from "./ue5-enemy-wave.js"
import { ue5PatrolTool } from "./ue5-patrol.js"
import { ue5StealthTool } from "./ue5-stealth.js"
import { ue5NoiseTool } from "./ue5-noise.js"
import { ue5AmbientSoundTool } from "./ue5-ambient-sound.js"
import { ue5JumpScareTool } from "./ue5-jumpscare.js"
import { ue5FearTool } from "./ue5-fear.js"
import { ue5AtmosphereTool } from "./ue5-atmosphere.js"
import { ue5LightFlickerTool } from "./ue5-light-flicker.js"
import { ue5ProcRoomTool } from "./ue5-proc-room.js"
import { ue5ProcCorridorTool } from "./ue5-proc-corridor.js"
import { ue5ProcDoorTool } from "./ue5-proc-door.js"
import { ue5ProcLightingTool } from "./ue5-proc-lighting.js"
import { ue5ProcPropsTool } from "./ue5-proc-props.js"
import { ue5ProcSpawnTool } from "./ue5-proc-spawn.js"
import { ue5AnimStateTool } from "./ue5-anim-state.js"
import { ue5AnimBlendTool } from "./ue5-anim-blend.js"
import { ue5AnimRagdollTool } from "./ue5-anim-ragdoll.js"
import { ue5AnimIKTool } from "./ue5-anim-ik.js"
import { ue5AnimMontageTool } from "./ue5-anim-montage.js"
import { ue5AnimNotifyTool } from "./ue5-anim-notify.js"
import { ue5AnimLocomotionTool } from "./ue5-anim-locomotion.js"
import { ue5CameraFirstTool } from "./ue5-camera-first.js"
import { ue5CameraThirdTool } from "./ue5-camera-third.js"
import { ue5CameraCinematicTool } from "./ue5-camera-cinematic.js"
import { ue5CameraShakeTool } from "./ue5-camera-shake.js"
import { ue5CameraFollowTool } from "./ue5-camera-follow.js"
import { ue5UniqueAISpawnTool } from "./ue5-unique-ai-spawn.js"
import { ue5UniqueHorrorEventTool } from "./ue5-unique-horror-event.js"
import { ue5UniqueFearAuraTool } from "./ue5-unique-fear-aura.js"
import { ue5UniqueSanityTool } from "./ue5-unique-sanity.js"
import { ue5UniqueJumpscareZoneTool } from "./ue5-unique-jumpscare-zone.js"
import { ue5UniqueDarknessTool } from "./ue5-unique-darkness.js"
import { ue5UniqueSoundTriggerTool } from "./ue5-unique-sound-trigger.js"
import { ue5TextureScoutTool } from "./ue5-texture-scout.js"
import { ue5VfxParticleTool } from "./ue5-vfx-particle.js"
import { ue5VfxPostprocessTool } from "./ue5-vfx-postprocess.js"
import { ue5VfxLightingTool } from "./ue5-vfx-lighting.js"
import { ue5VfxFogTool } from "./ue5-vfx-fog.js"
import { ue5VfxWeatherTool } from "./ue5-vfx-weather.js"
import { ue5VfxDecalTool } from "./ue5-vfx-decal.js"
import { ue5VfxNiagaraTool } from "./ue5-vfx-niagara.js"
import { ue5VfxLumenTool } from "./ue5-vfx-lumen.js"
import { ue5VfxNaniteTool } from "./ue5-vfx-nanite.js"
import { ue5HealthTool } from "./ue5-health.js"
import { ue5StaminaTool } from "./ue5-stamina.js"
import { ue5CombatTool } from "./ue5-combat.js"
import { ue5InteractTool } from "./ue5-interact.js"
import { ue5CraftingTool } from "./ue5-crafting.js"
import { ue5InventoryUpgradeTool } from "./ue5-inventory-upgrade.js"
import { ue5DamageTool } from "./ue5-damage.js"
import { ue5HealingTool } from "./ue5-healing.js"
import { ue5PuzzleTool } from "./ue5-puzzle.js"
import { ue5TrapTool } from "./ue5-trap.js"
import { ue5KeyItemTool } from "./ue5-key-item.js"
import { ue5TutorialTool } from "./ue5-tutorial.js"
import { ue5DifficultyTool } from "./ue5-difficulty.js"
import { ue5PlatformInputTool } from "./ue5-platform-input.js"
import { ue5PlatformPerfTool } from "./ue5-platform-perf.js"
import { ue5PlatformResolveTool } from "./ue5-platform-resolve.js"
import { ue5PlatformQualityTool } from "./ue5-platform-quality.js"
import { ue5BuildCookTool } from "./ue5-build-cook.js"
import { ue5BuildPackageTool } from "./ue5-build-package.js"
import { ue5BuildShaderTool } from "./ue5-build-shader.js"
import { ue5BuildCooktimeTool } from "./ue5-build-cooktime.js"
import { ue5BuildAssetTool } from "./ue5-build-asset.js"
import { ue5NetReplicateTool } from "./ue5-net-replicate.js"
import { ue5NetSessionTool } from "./ue5-net-session.js"
import { ue5NetChatTool } from "./ue5-net-chat.js"
import { ue5NetLobbyTool } from "./ue5-net-lobby.js"
import { ue5NetMatchTool } from "./ue5-net-match.js"
import { ue5NetLeaderboardTool } from "./ue5-net-leaderboard.js"
import { ue5PluginSettingsTool } from "./ue5-plugin-settings.js"
import { ue5PluginLogsTool } from "./ue5-plugin-logs.js"
import { ue5PluginAnalyticsTool } from "./ue5-plugin-analytics.js"
import { ue5PluginTelemetryTool } from "./ue5-plugin-telemetry.js"
import { ue5PluginErrorTool } from "./ue5-plugin-error.js"
import { ue5PluginRecoveryTool } from "./ue5-plugin-recovery.js"
import { ue5PluginUpdateTool } from "./ue5-plugin-update.js"
import { ue5PluginConfigTool } from "./ue5-plugin-config.js"

export { UE5Connector, getUE5Connector } from "./ue5-connector.js"
export type { UE5CommandResponse, UE5Event } from "./ue5-connector.js"

export const UE5ToolsPlugin: Plugin = async (_ctx) => {
  return {
    tool: {
      "ue5-console": ue5ConsoleTool,
      "ue5-spawn-actor": ue5SpawnActorTool,
      "ue5-list-actors": ue5ListActorsTool,
      "ue5-edit-blueprint": ue5EditBlueprintTool,
      "ue5-compile": ue5CompileTool,
      "ue5-screenshot": ue5ScreenshotTool,
      "ue5-delete-actor": ue5DeleteActorTool,
      "ue5-move-actor": ue5MoveActorTool,
      "ue5-set-material": ue5SetMaterialTool,
      "ue5-open-level": ue5OpenLevelTool,
      "ue5-play": ue5PlayTool,
      "ue5-stop": ue5StopTool,
      "ue5-select-actor": ue5SelectActorTool,
      "ue5-undo": ue5UndoTool,
      "ue5-redo": ue5RedoTool,
      "ue5-context": ue5ContextTool,
      "ue5-inventory": ue5InventoryTool,
      "ue5-item-spawn": ue5ItemSpawnTool,
      "ue5-dialogue": ue5DialogueTool,
      "ue5-dialogue-create": ue5DialogueCreateTool,
      "ue5-quest": ue5QuestTool,
      "ue5-quest-dialogue": ue5QuestDialogueTool,
      "ue5-ai-perception": ue5AIPerceptionTool,
      "ue5-enemy-wave": ue5EnemyWaveTool,
      "ue5-patrol": ue5PatrolTool,
      "ue5-stealth": ue5StealthTool,
      "ue5-noise": ue5NoiseTool,
      "ue5-ambient-sound": ue5AmbientSoundTool,
      "ue5-jumpscare": ue5JumpScareTool,
      "ue5-fear": ue5FearTool,
      "ue5-atmosphere": ue5AtmosphereTool,
      "ue5-light-flicker": ue5LightFlickerTool,
      "ue5-proc-room": ue5ProcRoomTool,
      "ue5-proc-corridor": ue5ProcCorridorTool,
      "ue5-proc-door": ue5ProcDoorTool,
      "ue5-proc-lighting": ue5ProcLightingTool,
      "ue5-proc-props": ue5ProcPropsTool,
      "ue5-proc-spawn": ue5ProcSpawnTool,
      "ue5-anim-state": ue5AnimStateTool,
      "ue5-anim-blend": ue5AnimBlendTool,
      "ue5-anim-ragdoll": ue5AnimRagdollTool,
      "ue5-anim-ik": ue5AnimIKTool,
      "ue5-anim-montage": ue5AnimMontageTool,
      "ue5-anim-notify": ue5AnimNotifyTool,
      "ue5-anim-locomotion": ue5AnimLocomotionTool,
      "ue5-camera-first": ue5CameraFirstTool,
      "ue5-camera-third": ue5CameraThirdTool,
      "ue5-camera-cinematic": ue5CameraCinematicTool,
      "ue5-camera-shake": ue5CameraShakeTool,
      "ue5-camera-follow": ue5CameraFollowTool,
      "ue5-unique-ai-spawn": ue5UniqueAISpawnTool,
      "ue5-unique-horror-event": ue5UniqueHorrorEventTool,
      "ue5-unique-fear-aura": ue5UniqueFearAuraTool,
      "ue5-unique-sanity": ue5UniqueSanityTool,
      "ue5-unique-jumpscare-zone": ue5UniqueJumpscareZoneTool,
      "ue5-unique-darkness": ue5UniqueDarknessTool,
      "ue5-unique-sound-trigger": ue5UniqueSoundTriggerTool,
      "ue5-texture-scout": ue5TextureScoutTool,
      "ue5-vfx-particle": ue5VfxParticleTool,
      "ue5-vfx-postprocess": ue5VfxPostprocessTool,
      "ue5-vfx-lighting": ue5VfxLightingTool,
      "ue5-vfx-fog": ue5VfxFogTool,
      "ue5-vfx-weather": ue5VfxWeatherTool,
      "ue5-vfx-decal": ue5VfxDecalTool,
      "ue5-vfx-niagara": ue5VfxNiagaraTool,
      "ue5-vfx-lumen": ue5VfxLumenTool,
      "ue5-vfx-nanite": ue5VfxNaniteTool,
      "ue5-health": ue5HealthTool,
      "ue5-stamina": ue5StaminaTool,
      "ue5-combat": ue5CombatTool,
      "ue5-interact": ue5InteractTool,
      "ue5-crafting": ue5CraftingTool,
      "ue5-inventory-upgrade": ue5InventoryUpgradeTool,
      "ue5-damage": ue5DamageTool,
      "ue5-healing": ue5HealingTool,
      "ue5-puzzle": ue5PuzzleTool,
      "ue5-trap": ue5TrapTool,
      "ue5-key-item": ue5KeyItemTool,
      "ue5-tutorial": ue5TutorialTool,
      "ue5-difficulty": ue5DifficultyTool,
      "ue5-platform-input": ue5PlatformInputTool,
      "ue5-platform-perf": ue5PlatformPerfTool,
      "ue5-platform-resolve": ue5PlatformResolveTool,
      "ue5-platform-quality": ue5PlatformQualityTool,
      "ue5-build-cook": ue5BuildCookTool,
      "ue5-build-package": ue5BuildPackageTool,
      "ue5-build-shader": ue5BuildShaderTool,
      "ue5-build-cooktime": ue5BuildCooktimeTool,
      "ue5-build-asset": ue5BuildAssetTool,
      "ue5-net-replicate": ue5NetReplicateTool,
      "ue5-net-session": ue5NetSessionTool,
      "ue5-net-chat": ue5NetChatTool,
      "ue5-net-lobby": ue5NetLobbyTool,
      "ue5-net-match": ue5NetMatchTool,
      "ue5-net-leaderboard": ue5NetLeaderboardTool,
      "ue5-plugin-settings": ue5PluginSettingsTool,
      "ue5-plugin-logs": ue5PluginLogsTool,
      "ue5-plugin-analytics": ue5PluginAnalyticsTool,
      "ue5-plugin-telemetry": ue5PluginTelemetryTool,
      "ue5-plugin-error": ue5PluginErrorTool,
      "ue5-plugin-recovery": ue5PluginRecoveryTool,
      "ue5-plugin-update": ue5PluginUpdateTool,
      "ue5-plugin-config": ue5PluginConfigTool,
    },
  }
}

export default UE5ToolsPlugin
