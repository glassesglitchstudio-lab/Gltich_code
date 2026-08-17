import { RGBA } from "@opentui/core"

/**
 * Crafted Developer Theme Tokens
 * Bespoke, industrial minimal styling for Glitch Code power-tools.
 * Avoids AI slop (no exaggerated pink/purple gradients or generic cards).
 */
export const CraftedTheme = {
  bg: RGBA.fromHex("#0c0d10"),
  bgElevated: RGBA.fromHex("#13151a"),
  bgSubtle: RGBA.fromHex("#1a1d24"),
  
  border: RGBA.fromHex("#27272a"),
  borderFocused: RGBA.fromHex("#3f3f46"),
  borderHighlight: RGBA.fromHex("#22c55e"),

  text: RGBA.fromHex("#f4f4f5"),
  textMuted: RGBA.fromHex("#71717a"),
  textDim: RGBA.fromHex("#52525b"),

  success: RGBA.fromHex("#22c55e"),
  warning: RGBA.fromHex("#f59e0b"),
  danger: RGBA.fromHex("#ef4444"),
  info: RGBA.fromHex("#06b6d4"),
  accent: RGBA.fromHex("#3b82f6"),

  // Diff Specific Tokens
  diff: {
    addedBg: RGBA.fromHex("#062817"),
    addedFg: RGBA.fromHex("#4ade80"),
    addedGutter: RGBA.fromHex("#22c55e"),
    
    removedBg: RGBA.fromHex("#2b0d0e"),
    removedFg: RGBA.fromHex("#f87171"),
    removedGutter: RGBA.fromHex("#ef4444"),
    
    gutterBg: RGBA.fromHex("#111317"),
    gutterFg: RGBA.fromHex("#52525b"),
    lineNumber: RGBA.fromHex("#3f3f46"),
  },

  // Box Drawing Glyphs
  box: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
    dividerLeft: "├",
    dividerRight: "┤",
    cross: "┼",
    dotActive: "●",
    dotInactive: "○",
  },
} as const
