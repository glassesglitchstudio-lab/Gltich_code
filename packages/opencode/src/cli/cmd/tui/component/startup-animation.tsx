import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"

const GLITCH_LOGO = [
  "  ██████╗ ██╗  ██╗ ██████╗ ███████╗",
  " ██╔════╝ ██║  ██║ ██╔══██╗ ██╔════╝",
  " ██║      ███████║ ██║  ██║ █████╗  ",
  " ██║      ██╔══██║ ██║  ██║ ██╔══╝  ",
  " ╚██████╗ ██║  ██║ ██████╔╝ ███████╗",
  "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══════╝",
]

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function StartupAnimation(props: { ready: () => boolean }) {
  const { theme } = useTheme()
  const [show, setShow] = createSignal(false)
  const [frame, setFrame] = createSignal(0)
  const [step, setStep] = createSignal(0)
  const [logoVisible, setLogoVisible] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let stepTimer: ReturnType<typeof setInterval> | undefined

  const steps = [
    "Initializing Glitch Code...",
    "Loading plugins...",
    "Connecting to provider...",
    "Preparing workspace...",
    "Ready!",
  ]

  onMount(() => {
    // Show after short delay
    setTimeout(() => setShow(true), 300)

    // Animate logo reveal
    let logoTimer: ReturnType<typeof setInterval> | undefined
    logoTimer = setInterval(() => {
      setLogoVisible((v) => {
        if (v >= GLITCH_LOGO.length) {
          clearInterval(logoTimer)
          return v
        }
        return v + 1
      })
    }, 100)

    // Animate spinner
    interval = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)

    // Step through loading messages
    stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, steps.length - 1))
    }, 600)
  })

  createEffect(() => {
    if (props.ready()) {
      setStep(steps.length - 1)
      setTimeout(() => setShow(false), 1500)
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (stepTimer) clearInterval(stepTimer)
  })

  return (
    <Show when={show()}>
      <box
        position="absolute"
        zIndex={5000}
        left={0}
        right={0}
        top={0}
        bottom={0}
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
        backgroundColor={theme.background}
      >
        <box
          flexDirection="column"
          alignItems="center"
          gap={1}
        >
          {/* Logo Animation */}
          <box flexDirection="column" alignItems="center" gap={0}>
            {GLITCH_LOGO.slice(0, logoVisible()).map((line) => (
              <text fg={theme.primary} selectable={false}>
                {line}
              </text>
            ))}
          </box>

          {/* Loading Spinner */}
          <box flexDirection="row" gap={1} marginTop={1}>
            <text fg={theme.primary} selectable={false}>
              {FRAMES[frame()]}
            </text>
            <text fg={theme.text} selectable={false}>
              {steps[step()]}
            </text>
          </box>

          {/* Progress Bar */}
          <box flexDirection="column" marginTop={1} width={40}>
            <box flexDirection="row" gap={0}>
              {Array.from({ length: 30 }).map((_, i) => (
                <text
                  fg={i < (step() / (steps.length - 1)) * 30 ? theme.primary : theme.borderSubtle}
                  selectable={false}
                >
                  ▓
                </text>
              ))}
            </box>
          </box>
        </box>
      </box>
    </Show>
  )
}
