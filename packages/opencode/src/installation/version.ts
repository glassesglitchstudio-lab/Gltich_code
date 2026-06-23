declare global {
  const GLITCH_VERSION: string
  const GLITCH_CHANNEL: string
}

export const InstallationVersion = typeof GLITCH_VERSION === "string" ? GLITCH_VERSION : "local"
export const InstallationChannel = typeof GLITCH_CHANNEL === "string" ? GLITCH_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
