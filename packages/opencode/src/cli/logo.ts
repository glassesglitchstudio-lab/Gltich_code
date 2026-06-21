export const logo = {
  left: [
    "                                               GLITCH",
    "                                                       ",
    "                                                       ",
    "                                                       ",
    "                                                       ",
    "                                                       ",
    "                                                       ",
    "                                                       ",
  ],
  right: [
    "                                       ",
    "                                       ",
    " ██████╗  ██████╗  ██████╗  ███████╗",
    "██╔════╝ ██╔═══██╗ ██╔══██╗ ██╔════╝",
    "██║      ██║   ██║ ██║  ██║ █████╗  ",
    "██║      ██║   ██║ ██║  ██║ ██╔══╝  ",
    "╚██████╗ ╚██████╔╝ ██████╔╝ ███████╗",
    " ╚═════╝  ╚═════╝  ╚═════╝  ╚══════╝",
  ],
}

export const logoThin = {
  left: [
    "                                ",
    "                                ",
    "                                ",
    "                                ",
    "                                ",
  ],
  right: [
    "  GLITCH                        ",
    "                                ",
    "  █▀▀ █▀▀█ █▀▀▄ █▀▀▀",
    "  █   █  █ █  █ █▀▀ ",
    "  ▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀▀",
  ],
}

export const logos = {
  thin: logoThin,
  classic: logo,
} as const

export type LogoKey = keyof typeof logos

export const go = {
  left: ["    ", "█▀▀█", "█  █", "▀▀▀▀"],
  right: ["    ", "█▀▀▀", "█ __", "▀▀▀▀"],
}

export const marks = "_^~,"
