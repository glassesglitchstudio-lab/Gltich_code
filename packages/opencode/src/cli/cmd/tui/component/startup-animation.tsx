import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, type JSX } from "solid-js"
import { useTheme } from "../context/theme"
import { InstallationVersion } from "@/installation/version"
import { logo } from "@/cli/logo"

const GAP = 1
const GLITCH_LOGO = logo.left.map((line, i) => line + " ".repeat(GAP) + logo.right[i])

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const WAVE = ["▁", "▃", "▅", "▇", "█", "▇", "▅", "▃"]
const PARTICLE = ["·", "∙", "˙", "•", "∘"]

export function StartupAnimation(props: { ready: () => boolean }) {
  const { theme } = useTheme()
  const [show, setShow] = createSignal(false)
  const [frame, setFrame] = createSignal(0)
  const [step, setStep] = createSignal(0)
  const [logoVisible, setLogoVisible] = createSignal(0)
  const [glitchLine, setGlitchLine] = createSignal(-1)
  const [glitchChars, setGlitchChars] = createSignal<number[]>([])
  const [wavePhase, setWavePhase] = createSignal(0)
  const [pulse, setPulse] = createSignal(0)
  const [particles, setParticles] = createSignal<Array<{ x: number; y: number; char: string }>>([])
  const [cursor, setCursor] = createSignal(true)
  let interval: ReturnType<typeof setInterval> | undefined
  let stepTimer: ReturnType<typeof setInterval> | undefined
  let glitchTimer: ReturnType<typeof setInterval> | undefined
  let waveTimer: ReturnType<typeof setInterval> | undefined
  let pulseTimer: ReturnType<typeof setInterval> | undefined
  let particleTimer: ReturnType<typeof setInterval> | undefined
  let cursorTimer: ReturnType<typeof setInterval> | undefined

  const steps = [
    "Initializing Glitch Code...",
    "Loading plugins...",
    "Connecting to provider...",
    "Preparing workspace...",
    "Ready!",
  ]

  const width = GLITCH_LOGO[0]?.length ?? 40
  const height = GLITCH_LOGO.length

  const displayLogo = createMemo(() => {
    return GLITCH_LOGO.slice(0, logoVisible()).map((line, lineIdx) => {
      if (lineIdx !== glitchLine()) return line
      const chars = line.split("")
      const glitchIndices = glitchChars()
      glitchIndices.forEach((idx) => {
        if (idx < chars.length) {
          chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        }
      })
      return chars.join("")
    })
  })

  onMount(() => {
    setTimeout(() => setShow(true), 300)

    let logoTimer: ReturnType<typeof setInterval> | undefined
    logoTimer = setInterval(() => {
      setLogoVisible((v) => {
        if (v >= GLITCH_LOGO.length) {
          clearInterval(logoTimer)
          return v
        }
        return v + 1
      })
    }, 120)

    interval = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)

    stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, steps.length - 1))
    }, 600)

    glitchTimer = setInterval(() => {
      if (logoVisible() === 0) return
      const lineIdx = Math.floor(Math.random() * logoVisible())
      setGlitchLine(lineIdx)
      const numGlitches = Math.floor(2 + Math.random() * 4)
      const indices: number[] = []
      for (let i = 0; i < numGlitches; i++) {
        indices.push(Math.floor(Math.random() * GLITCH_LOGO[0].length))
      }
      setGlitchChars(indices)
      setTimeout(() => setGlitchLine(-1), 90)
    }, 350)

    // Grok tarzi dalga animasyonu
    waveTimer = setInterval(() => setWavePhase((p) => (p + 1) % (WAVE.length * 4)), 90)

    // Pulse (nefes alma)
    let t = 0
    pulseTimer = setInterval(() => {
      t += 0.08
      setPulse(Math.sin(t) * 0.5 + 0.5)
    }, 50)

    // Parcaciklar
    const initParticles = Array.from({ length: 10 }, () => ({
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      char: PARTICLE[Math.floor(Math.random() * PARTICLE.length)]!,
    }))
    setParticles(initParticles)
    particleTimer = setInterval(() => {
      setParticles((list) =>
        list.map((p) => ({
          ...p,
          x: (p.x + 1) % width,
          y: Math.max(0, Math.min(height - 1, p.y + (Math.random() - 0.5))),
        })),
      )
    }, 150)

    // Cursor blink
    cursorTimer = setInterval(() => setCursor((v) => !v), 530)
  })

  createEffect(() => {
    if (props.ready()) {
      setStep(steps.length - 1)
      setTimeout(() => setShow(false), 1200)
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (stepTimer) clearInterval(stepTimer)
    if (glitchTimer) clearInterval(glitchTimer)
    if (waveTimer) clearInterval(waveTimer)
    if (pulseTimer) clearInterval(pulseTimer)
    if (particleTimer) clearInterval(particleTimer)
    if (cursorTimer) clearInterval(cursorTimer)
  })

  const renderWave = () => {
    const waveWidth = 20
    const chars: JSX.Element[] = []
    for (let i = 0; i < waveWidth; i++) {
      const idx = (wavePhase() + i) % (WAVE.length * 4)
      const waveIdx = idx < WAVE.length ? idx : (WAVE.length * 2 - 1 - idx) % WAVE.length
      const intensity = 1 - Math.abs(i - waveWidth / 2) / (waveWidth / 2)
      chars.push(
        <text
          fg={
            intensity > 0.5
              ? theme.primary
              : intensity > 0.2
                ? theme.secondary
                : theme.borderSubtle
          }
          selectable={false}
        >
          {WAVE[waveIdx]}
        </text>,
      )
    }
    return <>{chars}</>
  }

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
        {/* Parcaciklar */}
        <box position="absolute" top={0} left={0} width={width} height={height} zIndex={0}>
          {particles().map((p) => (
            <text position="absolute" top={p.y} left={p.x} fg={theme.borderSubtle} selectable={false}>
              {p.char}
            </text>
          ))}
        </box>

        <box
          flexDirection="column"
          alignItems="center"
          gap={1}
          zIndex={1}
        >
          {/* Logo Animation with Glitch */}
          <box flexDirection="column" alignItems="center" gap={0}>
            {displayLogo().map((line) => (
              <text fg={glitchLine() >= 0 ? theme.warning : theme.primary} selectable={false}>
                {line}
              </text>
            ))}
          </box>

          {/* Subtitle + cursor */}
          <Show when={logoVisible() >= GLITCH_LOGO.length}>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted} selectable={false}>
                AI-Powered CLI for Software Engineering
              </text>
              <Show when={cursor()}>
                <text fg={theme.primary} selectable={false}>
                  ▌
                </text>
              </Show>
            </box>
          </Show>

          {/* Grok tarzi dalga spinner */}
          <box flexDirection="row" gap={1} marginTop={1} alignItems="center">
            <text fg={theme.primary} selectable={false}>
              {FRAMES[frame()]}
            </text>
            <box flexDirection="row">{renderWave()}</box>
            <text fg={theme.text} selectable={false}>
              {steps[step()]}
            </text>
          </box>

          {/* Progress Bar — gradyanli */}
          <box flexDirection="column" marginTop={1} width={40}>
            <box flexDirection="row" gap={0}>
              {Array.from({ length: 30 }).map((_, i) => {
                const progress = (step() / (steps.length - 1)) * 30
                const isFilled = i < progress
                const isEdge = i === Math.floor(progress) - 1
                return (
                  <text
                    fg={
                      isEdge
                        ? theme.primary
                        : isFilled
                          ? theme.secondary
                          : theme.borderSubtle
                    }
                    selectable={false}
                  >
                    {isEdge ? "█" : isFilled ? "▓" : "░"}
                  </text>
                )
              })}
            </box>
          </box>

          {/* Version — pulse */}
          <text fg={theme.textMuted} selectable={false}>
            v{InstallationVersion} {pulse() > 0.5 ? "•" : " "}
          </text>
        </box>
      </box>
    </Show>
  )
}
