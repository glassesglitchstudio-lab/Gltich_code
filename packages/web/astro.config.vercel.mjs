// @ts-check
import { defineConfig } from "astro/config"
import vercel from "@astrojs/vercel/static"

export default defineConfig({
  output: "static",
  adapter: vercel(),
  server: {
    host: "0.0.0.0",
  },
})
