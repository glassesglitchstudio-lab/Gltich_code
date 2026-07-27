import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import path from "path"
import { Logo } from "../component/logo"
import { logoThin, logos, type LogoKey } from "@/cli/logo"
import { StarryBackground } from "../component/starry-background"
import { BackgroundImage } from "../component/background-image"
import { useProject } from "../context/project"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { useKV } from "../context/kv"
import { useLanguage } from "@tui/context/language"
import { useTheme } from "../context/theme"
import { TuiPluginRuntime } from "../plugin"
import { Global } from "@/global"
import { isPlainTerminal } from "../util/terminal"
import { RGBA } from "@opentui/core"

const GLITCH_BANNER = [
  "   ██████╗ ██╗  ██╗ ██████╗ ███████╗",
  "  ██╔════╝ ██║  ██║ ██╔══██╗ ██╔════╝",
  "  ██║      ███████║ ██║  ██║ █████╗  ",
  "  ██║      ██╔══██║ ██║  ██║ ██╔══╝  ",
  "  ╚██████╗ ██║  ██║ ██████╔╝ ███████╗",
  "   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══════╝",
]

const GLITCH_TAGLINE = "  AI-Powered Software Engineering"
const GLITCH_SUBTITLE = "  Code · Debug · Refactor · Ship"

const BANNER_WIDTH = GLITCH_BANNER[0].length + 4
const ORBIT_FRAMES = ["◆", "◇", "◆", "◇"]

let once = false

export function Home() {
  const sync = useSync()
  const project = useProject()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const kv = useKV()
  const t = useLanguage().t
  const { theme } = useTheme()
  const plainTerminal = isPlainTerminal()
  const bgImagePath = createMemo(() => {
    const filename = kv.get("background_image")
    if (!filename || typeof filename !== "string") return undefined
    return path.join(Global.Path.config, "backgrounds", filename)
  })
  const logoKey = createMemo(() => {
    const key = kv.get("logo_design")
    return typeof key === "string" && key in logos ? (key as LogoKey) : "thin"
  })
  const showMeteor = () => true
  const placeholder = {
    get normal() {
      return [
        t("tui.home.placeholder.example.todo"),
        t("tui.home.placeholder.example.stack"),
        t("tui.home.placeholder.example.tests"),
      ]
    },
    shell: ["ls -la", "git status", "pwd"],
  }
  let sent = false

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  const [orbitFrame, setOrbitFrame] = createSignal(0)
  const [pulsePhase, setPulsePhase] = createSignal(0)
  let orbitInterval: ReturnType<typeof setInterval> | undefined
  let pulseInterval: ReturnType<typeof setInterval> | undefined

  onMount(() => {
    orbitInterval = setInterval(() => setOrbitFrame((f) => (f + 1) % ORBIT_FRAMES.length), 600)
    pulseInterval = setInterval(() => setPulsePhase((f) => (f + 1) % 6), 800)
  })
  onCleanup(() => {
    if (orbitInterval) clearInterval(orbitInterval)
    if (pulseInterval) clearInterval(pulseInterval)
  })

  const pulseBrightness = () => {
    const phases = [1.0, 0.6, 0.3, 0.6, 1.0, 0.8]
    return phases[pulsePhase()]
  }

  const pulsePrimary = () => RGBA.fromValues(
    Math.round(theme.primary.r * pulseBrightness()),
    Math.round(theme.primary.g * pulseBrightness()),
    Math.round(theme.primary.b * pulseBrightness()),
    theme.primary.a,
  )

  return (
    <>
      <Show when={!plainTerminal}>
        <Show when={bgImagePath()} fallback={<StarryBackground meteor={showMeteor} />}>
          {(p) => <BackgroundImage path={p()} />}
        </Show>
      </Show>
      <box flexGrow={1} alignItems="center" paddingLeft={8} paddingRight={8} zIndex={1}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />

        {/* Main content area */}
        <box flexShrink={0} flexDirection="column" alignItems="center" gap={0}>
          {/* Glitch Code ASCII Banner with neon glow feel */}
          <Show
            when={plainTerminal}
            fallback={
              <TuiPluginRuntime.Slot name="home_logo" mode="replace">
                <box flexDirection="column" alignItems="center" gap={1}>
                  {/* Top accent line with orbit ornaments */}
                  <box flexDirection="row" gap={1} alignItems="center">
                    <text fg={pulsePrimary()} selectable={false}>{ORBIT_FRAMES[orbitFrame()]}</text>
                    <box width={BANNER_WIDTH} height={1} backgroundColor={pulsePrimary()} />
                    <text fg={pulsePrimary()} selectable={false}>{ORBIT_FRAMES[(orbitFrame() + 2) % ORBIT_FRAMES.length]}</text>
                  </box>
                  {GLITCH_BANNER.map((line) => (
                    <box flexDirection="row" gap={2} alignItems="center">
                      <text fg={theme.backgroundPanel} selectable={false}>║</text>
                      <text fg={theme.primary} selectable={false}>
                        <b>{line}</b>
                      </text>
                      <text fg={theme.backgroundPanel} selectable={false}>║</text>
                    </box>
                  ))}
                  {/* Bottom accent line with orbit ornaments */}
                  <box flexDirection="row" gap={1} alignItems="center">
                    <text fg={pulsePrimary()} selectable={false}>{ORBIT_FRAMES[(orbitFrame() + 1) % ORBIT_FRAMES.length]}</text>
                    <box width={BANNER_WIDTH} height={1} backgroundColor={pulsePrimary()} />
                    <text fg={pulsePrimary()} selectable={false}>{ORBIT_FRAMES[(orbitFrame() + 3) % ORBIT_FRAMES.length]}</text>
                  </box>
                  {/* Tagline */}
                  <box flexDirection="row" gap={2} alignItems="center" paddingTop={1}>
                    <text fg={theme.textMuted} selectable={false}>└</text>
                    <text fg={theme.textMuted} selectable={false}>{GLITCH_TAGLINE}</text>
                    <text fg={theme.textMuted} selectable={false}>┘</text>
                  </box>
                  <text fg={theme.textMuted} selectable={false}>
                    {GLITCH_SUBTITLE}
                  </text>
                </box>
              </TuiPluginRuntime.Slot>
            }
          >
            <box flexDirection="column" flexShrink={0}>
              {logoThin.left.slice(2).map((line, index) => (
                <box flexDirection="row" gap={1} flexShrink={0}>
                  <text selectable={false}>{line}</text>
                  <text selectable={false}>{logoThin.right[index + 2] ?? ""}</text>
                </box>
              ))}
            </box>
          </Show>
        </box>

        <box height={3} minHeight={0} flexShrink={1} />

        {/* Prompt area with animated border */}
        <box
          width="100%"
          maxWidth={80}
          zIndex={1000}
          paddingTop={1}
          flexShrink={0}
          border={["left"]}
          borderColor={pulsePrimary()}
        >
          <Show
            when={plainTerminal}
            fallback={
              <TuiPluginRuntime.Slot
                name="home_prompt"
                mode="replace"
                workspace_id={project.workspace.current()}
                ref={bind}
              >
                <Prompt
                  ref={bind}
                  workspaceID={project.workspace.current()}
                  right={<TuiPluginRuntime.Slot name="home_prompt_right" workspace_id={project.workspace.current()} />}
                  placeholders={placeholder}
                />
              </TuiPluginRuntime.Slot>
            }
          >
            <Prompt
              ref={bind}
              workspaceID={project.workspace.current()}
              placeholders={placeholder}
            />
          </Show>
        </box>

        <Show when={plainTerminal}>
          <box paddingTop={1} flexShrink={0}>
            <text selectable={false}>{t("tui.tips.plain_terminal")}</text>
          </box>
        </Show>
        <Show when={!plainTerminal}>
          <TuiPluginRuntime.Slot name="home_bottom" />
        </Show>
        <box flexGrow={1} minHeight={0} />
        <Toast />
      </box>
      <Show when={!plainTerminal}>
        <box width="100%" flexShrink={0}>
          <TuiPluginRuntime.Slot name="home_footer" mode="single_winner" />
        </box>
      </Show>
    </>
  )
}
