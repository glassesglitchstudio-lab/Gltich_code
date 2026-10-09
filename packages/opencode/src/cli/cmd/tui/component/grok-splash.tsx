import { BoxRenderable, TextRenderable, RGBA, Timeline, createTimeline } from "@opentui/core"
import { createSignal, onMount, onCleanup, type JSX } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"

const LOGO = [
  "  ▄████  ██▓     ▄████▄    ██████ ",
  " ██▒ ▀█▒▓██▒    ▒██▀ ▀█  ▒██    ▒ ",
  "▒██░▄▄▄░▒██░    ▒▓█    ▄ ░ ▓██▄   ",
  "░▓█  ██▓▒██░    ▒▓▓▄ ▄██▒  ▒   ██▒",
  "░▒▓███▀▒░██████▒▒ ▓███▀ ░▒██████▒▒",
  " ░▒   ▒ ░ ▒░▓  ░░ ░▒ ▒  ░▒ ▒▓▒ ▒ ░",
  "  ░   ░ ░ ░ ▒  ░  ░  ▒  ░ ░▒  ░ ░",
  "░ ░   ░   ░ ░  ░        ░  ░  ░  ",
  "      ░     ░  ░ ░            ░  ",
]

const TAGLINE = "Terminal-Native AI Coding Assistant"

const PARTICLE_COUNT = 12

interface Particle {
  x: number
  y: number
  char: string
  vx: number
  vy: number
  delay: number
}

function makeParticles(width: number, height: number): Particle[] {
  const chars = ["·", "∙", "˙", "•", "∘", "○"]
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      char: chars[Math.floor(Math.random() * chars.length)]!,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.4,
      delay: Math.random() * 800,
    })
  }
  return particles
}

export function GrokSplash(props: { onDone?: () => void } = {}) {
  const { theme } = useTheme()
  const [phase, setPhase] = createSignal<"charge" | "reveal" | "hold" | "done">("charge")
  const [progress, setProgress] = createSignal(0)
  const [particles, setParticles] = createSignal<Particle[]>([])
  const [logoOpacity, setLogoOpacity] = createSignal(0)
  const [taglineWidth, setTaglineWidth] = createSignal(0)
  const [cursorVisible, setCursorVisible] = createSignal(true)
  const [pulse, setPulse] = createSignal(0)

  let timeline: Timeline | undefined
  let cursorTimer: ReturnType<typeof setInterval> | undefined
  let particleTimer: ReturnType<typeof setInterval> | undefined
  let pulseTimer: ReturnType<typeof setInterval> | undefined

  const width = 44
  const height = 9

  onMount(() => {
    setParticles(makeParticles(width, height))

    timeline = createTimeline({ duration: 3200, loop: false })
    timeline
      .add({ value: 0 }, { value: 1, duration: 1200, ease: "inOutQuad" }, 0)
      .add({}, { duration: 0 }, 1200)

    // Animasyon fazlari
    setTimeout(() => setPhase("reveal"), 1200)
    setTimeout(() => setPhase("hold"), 2200)
    setTimeout(() => {
      setPhase("done")
      props.onDone?.()
    }, 3200)

    // Logo reveal animasyonu (satir satir)
    const logoLines = LOGO.length
    for (let i = 0; i < logoLines; i++) {
      setTimeout(() => setLogoOpacity(i + 1), 1200 + i * 80)
    }

    // Tagline typewriter
    let charIdx = 0
    const typeTimer = setInterval(() => {
      if (charIdx <= TAGLINE.length) {
        setTaglineWidth(charIdx)
        charIdx++
      } else {
        clearInterval(typeTimer)
      }
    }, 40)
    setTimeout(() => clearInterval(typeTimer), 2200)

    // Progress bar
    const progTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progTimer)
          return 100
        }
        return p + 2
      })
    }, 30)

    // Cursor blink
    cursorTimer = setInterval(() => setCursorVisible((v) => !v), 530)

    // Particle drift
    particleTimer = setInterval(() => {
      setParticles((list) =>
        list.map((p) => ({
          ...p,
          x: (p.x + p.vx + width) % width,
          y: Math.max(0, Math.min(height - 1, p.y + p.vy)),
        })),
      )
    }, 100)

    // Pulse
    let t = 0
    pulseTimer = setInterval(() => {
      t += 0.08
      setPulse(Math.sin(t) * 0.5 + 0.5)
    }, 50)
  })

  onCleanup(() => {
    if (cursorTimer) clearInterval(cursorTimer)
    if (particleTimer) clearInterval(particleTimer)
    if (pulseTimer) clearInterval(pulseTimer)
    timeline?.pause()
  })

  const accent = () => theme.primary
  const secondary = () => theme.secondary

  const renderProgressBar = (): string => {
    const barWidth = 30
    const filled = Math.floor((progress() / 100) * barWidth)
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
    return bar
  }

  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" height={height + 12}>
      {/* Parcaciklar */}
      <box position="absolute" top={0} left={0} width={width} height={height} zIndex={0}>
        {particles().map((p, i) => (
          <text
            position="absolute"
            top={Math.floor(p.y)}
            left={Math.floor(p.x)}
            fg={tint(theme.background, theme.textMuted, 0.15 + (i % 3) * 0.05)}
            selectable={false}
          >
            {p.char}
          </text>
        ))}
      </box>

      {/* Logo - satir satir reveal */}
      <box flexDirection="column" alignItems="center" zIndex={1}>
        {LOGO.map((line, i) => (
          <text
            fg={
              phase() === "charge"
                ? theme.background
                : i < logoOpacity()
                  ? tint(theme.background, accent(), 0.85 + (i / LOGO.length) * 0.15)
                  : theme.background
            }
            attributes={1}
            selectable={false}
          >
            {line}
          </text>
        ))}
      </box>

      {/* Ayirici cizgi - pulse animasyonu */}
      <box marginTop={1} zIndex={1}>
        <text fg={tint(theme.background, secondary(), 0.3 + pulse() * 0.4)} selectable={false}>
          {"─".repeat(38)}
        </text>
      </box>

      {/* Tagline - typewriter */}
      <box marginTop={1} flexDirection="row" zIndex={1}>
        <text fg={theme.text} selectable={false}>
          {TAGLINE.substring(0, taglineWidth())}
        </text>
        {cursorVisible() && taglineWidth() < TAGLINE.length ? (
          <text fg={accent()} selectable={false}>
            ▌
          </text>
        ) : null}
        {taglineWidth() >= TAGLINE.length ? (
          <text fg={tint(theme.background, theme.textMuted, 0.3 + pulse() * 0.3)} selectable={false}>
            {"  ✓"}
          </text>
        ) : null}
      </box>

      {/* Progress bar */}
      <box marginTop={1} flexDirection="column" alignItems="center" zIndex={1}>
        <text fg={secondary()} selectable={false}>
          {renderProgressBar()}
        </text>
        <text fg={theme.textMuted} selectable={false}>
          {`  ${progress()}%  `}
          {phase() === "done" ? "hazir" : "yukleniyor..."}
        </text>
      </box>

      {/* Versiyon bilgisi */}
      <box marginTop={1} zIndex={1}>
        <text fg={tint(theme.background, theme.textMuted, 0.2 + pulse() * 0.15)} selectable={false}>
          v1.0.0 — Kaggle-only
        </text>
      </box>
    </box>
  )
}
