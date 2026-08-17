import { DialogSelect, type DialogSelectRef } from "../ui/dialog-select"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { onCleanup } from "solid-js"

export function DialogThemeList() {
  const theme = useTheme()
  const allKeys = Object.keys(theme.all())
  
  const featured = ["crafted", "glitch", "glitchcode"].filter((k) => allKeys.includes(k))
  const others = allKeys.filter((k) => !featured.includes(k)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  
  const formatTitle = (key: string) => {
    if (key === "crafted") return "✦ Crafted Minimal (New / Clean)"
    if (key === "glitch") return "✦ Glitch Classic (Neon / Animated)"
    if (key === "glitchcode") return "✦ Glitch Code (Standard)"
    return key
  }

  const options = [...featured, ...others].map((value) => ({
    title: formatTitle(value),
    value: value,
  }))
  const dialog = useDialog()
  let confirmed = false
  let ref: DialogSelectRef<string>
  const initial = theme.selected

  onCleanup(() => {
    if (!confirmed) theme.set(initial)
  })

  return (
    <DialogSelect
      title="Themes"
      options={options}
      current={initial}
      onMove={(opt) => {
        theme.set(opt.value)
      }}
      onSelect={(opt) => {
        theme.set(opt.value)
        confirmed = true
        dialog.clear()
      }}
      ref={(r) => {
        ref = r
      }}
      onFilter={(query) => {
        if (query.length === 0) {
          theme.set(initial)
          return
        }

        const first = ref.filtered[0]
        if (first) theme.set(first.value)
      }}
    />
  )
}
