import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { batch, createContext, Show, useContext, type JSX, type ParentProps } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { MouseButton, Renderable, RGBA } from "@opentui/core"
import { createStore } from "solid-js/store"
import { useToast } from "@tui/ui/toast"
import { Flag } from "@/flag/flag"
import * as Selection from "@tui/util/selection"
import * as Clipboard from "@tui/util/clipboard"
import { useLanguage } from "@tui/context/language"

export function GlassmorphismDialog(
  props: ParentProps<{
    size?: "medium" | "large" | "xlarge"
    onClose: () => void
  }>,
) {
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const renderer = useRenderer()
  const toast = useToast()
  const t = useLanguage().t

  let dismiss = false
  const width = () => {
    if (props.size === "xlarge") return 116
    if (props.size === "large") return 88
    return 60
  }

  return (
    <box
      onMouseDown={() => {
        dismiss = !!renderer.getSelection()
      }}
      onMouseUp={() => {
        if (dismiss) {
          dismiss = false
          return
        }
        props.onClose?.()
      }}
      width={dimensions().width}
      height={dimensions().height}
      alignItems="center"
      position="absolute"
      zIndex={3000}
      paddingTop={dimensions().height / 4}
      left={0}
      top={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 180)}
    >
      <box
        onMouseUp={(e) => {
          dismiss = false
          if (!Flag.GLITCHCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT) {
            const text = renderer.getSelection()?.getSelectedText()
            if (text) {
              Clipboard.copy(text)
                .then(() => toast.show({ message: t("tui.toast.copied_to_clipboard"), variant: "info" }))
                .catch(toast.error)
            }
          }
          e.stopPropagation()
        }}
        width={width()}
        maxWidth={dimensions().width - 2}
        backgroundColor={theme.backgroundPanel}
        border={["top", "bottom", "left", "right"]}
        borderColor={theme.primary}
        paddingTop={1}
      >
        {props.children}
      </box>
    </box>
  )
}

// Dialog context for managing dialog stack
const dialogContext = createContext<{
  stack: Array<{ element: JSX.Element; id: string }>
  push: (element: JSX.Element) => string
  pop: () => void
  remove: (id: string) => void
}>()

export function useGlassmorphismDialog() {
  return useContext(dialogContext)
}

export function GlassmorphismDialogProvider(props: ParentProps) {
  const [store, setStore] = createStore({
    stack: [] as Array<{ element: JSX.Element; id: string }>,
  })

  let nextId = 0

  const push = (element: JSX.Element) => {
    const id = `dialog-${nextId++}`
    setStore("stack", (prev) => [...prev, { element, id }])
    return id
  }

  const pop = () => {
    setStore("stack", (prev) => prev.slice(0, -1))
  }

  const remove = (id: string) => {
    setStore("stack", (prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <dialogContext.Provider value={{ stack: store.stack, push, pop, remove }}>
      {props.children}
    </dialogContext.Provider>
  )
}
