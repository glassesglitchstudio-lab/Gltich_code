import { useDialog } from "@tui/ui/dialog"
import { DialogSelect, type DialogSelectOption, type DialogSelectRef } from "@tui/ui/dialog-select"
import { isEditBufferRenderable } from "@opentui/core"
import {
  createContext,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"
import { useLanguage } from "@tui/context/language"
import { useTheme } from "@tui/context/theme"

const CATEGORY_KEYS: Record<string, string> = {
  session: "tui.command.category.session",
  agent: "tui.command.category.agent",
  provider: "tui.command.category.provider",
  system: "tui.command.category.system",
  prompt: "tui.command.category.prompt",
  internal: "tui.command.category.internal",
  external: "tui.command.category.external",
}

const CATEGORY_ICONS: Record<string, string> = {
  session: "📋",
  agent: "🤖",
  provider: "🔌",
  system: "⚙️",
  prompt: "💬",
  internal: "🔧",
  external: "🌐",
}

type Context = ReturnType<typeof init>
const ctx = createContext<Context>()

export type Slash = {
  name: string
  aliases?: string[]
}

export type CommandOption = DialogSelectOption<string> & {
  keybind?: string
  suggested?: boolean
  slash?: Slash
  hidden?: boolean
  enabled?: boolean
}

function init() {
  const root = getOwner()
  const [registrations, setRegistrations] = createSignal<Accessor<CommandOption[]>[]>([])
  const [suspendCount, setSuspendCount] = createSignal(0)
  const dialog = useDialog()
  const keybind = useKeybind()
  const lang = useLanguage()
  const renderer = useRenderer()
  const { theme } = useTheme()

  const localizeCategory = (category: string | undefined) => {
    if (!category) return category
    const key = CATEGORY_KEYS[category]
    if (key) return lang.t(key)
    return category
  }

  const deriveKeywords = (option: CommandOption) => {
    const tokens = [option.value, ...option.value.split(/[.\-_:]/)]
    if (option.slash) tokens.push(option.slash.name, ...(option.slash.aliases ?? []))
    return [...new Set([...(option.keywords ?? []), ...tokens].filter(Boolean))]
  }

  const entries = createMemo(() => {
    const all = registrations().flatMap((x) => x())
    return all.map((x) => ({
      ...x,
      category: localizeCategory(x.category),
      keywords: deriveKeywords(x),
      footer: x.keybind ? keybind.print(x.keybind) : undefined,
    }))
  })

  const isEnabled = (option: CommandOption) => option.enabled !== false
  const isVisible = (option: CommandOption) => isEnabled(option) && !option.hidden

  const visibleOptions = createMemo(() => entries().filter((option) => isVisible(option)))
  const suggestedOptions = createMemo(() =>
    visibleOptions()
      .filter((option) => option.suggested)
      .map((option) => ({
        ...option,
        value: `suggested:${option.value}`,
        category: lang.t("tui.command.palette.suggested"),
      })),
  )
  const suspended = () => suspendCount() > 0
  const isTextEditingKey = (evt: Parameters<typeof keybind.match>[1]) =>
    Object.keys(keybind.all).some(
      (name) =>
        (name.startsWith("input_") || name === "history_previous" || name === "history_next") &&
        keybind.match(name, evt),
    )

  useKeyboard((evt) => {
    if (suspended()) return
    if (dialog.stack.length > 0) return
    if (evt.defaultPrevented) return
    const textInputFocused = isEditBufferRenderable(renderer.currentFocusedRenderable)
    const textEditingKey = textInputFocused && isTextEditingKey(evt)
    for (const option of entries()) {
      if (!isEnabled(option)) continue
      if (textEditingKey && !option.keybind?.startsWith("input_")) continue
      if (option.keybind && keybind.match(option.keybind, evt)) {
        evt.preventDefault()
        option.onSelect?.(dialog)
        return
      }
    }
  })

  const result = {
    trigger(name: string) {
      for (const option of entries()) {
        if (option.value === name) {
          if (!isEnabled(option)) return
          option.onSelect?.(dialog)
          return
        }
      }
    },
    slashes() {
      return visibleOptions().flatMap((option) => {
        const slash = option.slash
        if (!slash) return []
        const description = option.description ?? option.title
        const onSelect = () => result.trigger(option.value)
        return [
          { display: "/" + slash.name, description, onSelect },
          ...(slash.aliases ?? []).map((alias) => ({
            display: "/" + alias,
            description,
            onSelect,
          })),
        ]
      })
    },
    keybinds(enabled: boolean) {
      setSuspendCount((count) => count + (enabled ? -1 : 1))
    },
    suspended,
    show() {
      dialog.replace(() => (
        <DialogCommandEnhanced
          options={visibleOptions()}
          suggestedOptions={suggestedOptions()}
        />
      ))
    },
    register(cb: () => CommandOption[]) {
      const owner = getOwner() ?? root
      if (!owner) return () => {}

      let list: Accessor<CommandOption[]> | undefined

      runWithOwner(owner, () => {
        list = createMemo(cb)
        const ref = list
        if (!ref) return
        setRegistrations((arr) => [ref, ...arr])
        onCleanup(() => {
          setRegistrations((arr) => arr.filter((x) => x !== ref))
        })
      })

      if (!list) return () => {}
      let done = false
      return () => {
        if (done) return
        done = true
        const ref = list
        if (!ref) return
        setRegistrations((arr) => arr.filter((x) => x !== ref))
      }
    },
  }
  return result
}

export function useCommandDialogEnhanced() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useCommandDialog must be used within a CommandProvider")
  }
  return value
}

export function CommandProviderEnhanced(props: ParentProps) {
  const value = init()
  const dialog = useDialog()
  const keybind = useKeybind()

  useKeyboard((evt) => {
    if (value.suspended()) return
    if (dialog.stack.length > 0) return
    if (evt.defaultPrevented) return
    if (keybind.match("command_list", evt)) {
      evt.preventDefault()
      value.show()
      return
    }
  })

  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

function DialogCommandEnhanced(props: {
  options: CommandOption[]
  suggestedOptions: CommandOption[]
}) {
  const lang = useLanguage()
  const { theme } = useTheme()
  let ref: DialogSelectRef<string>

  const list = () => {
    if (ref?.filter) return props.options
    return [...props.suggestedOptions, ...props.options]
  }

  return (
    <box gap={1} paddingBottom={1}>
      {/* Glitch Code branding header */}
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.primary} selectable={false}>
            ◆ <b>Glitch</b>Code Command Palette
          </text>
          <text fg={theme.textMuted} selectable={false}>
            ESC to close
          </text>
        </box>
      </box>

      {/* Command list */}
      <DialogSelect
        ref={(r) => (ref = r)}
        title=""
        options={list()}
        skipFilter={false}
        placeholder="Type to search commands..."
      />
    </box>
  )
}
