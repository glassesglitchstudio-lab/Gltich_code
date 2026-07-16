import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const TextureScoutActionSchema = z.enum([
  "search",
  "download",
  "apply",
  "preview",
  "list-downloaded",
  "set-category",
  "import",
  "remove",
])

const TextureTypeSchema = z.enum([
  "diffuse",
  "normal",
  "roughness",
  "metallic",
  "ao",
  "height",
])

const CategorySchema = z.enum([
  "concrete",
  "wood",
  "metal",
  "fabric",
  "organic",
  "stone",
])

const ResolutionSchema = z.enum(["1k", "2k", "4k"])

export const ue5TextureScoutTool = tool({
  description:
    "Manage UE5 texture-scout system. Search for textures by query, download from asset libraries, apply to materials, preview in editor, manage downloaded textures, filter by category, and import custom textures. Uses the 'texture-scout' console command.",
  args: {
    action: TextureScoutActionSchema.describe("Texture-scout action to perform"),
    query: z.string().optional().describe("Search query for textures (e.g. 'cracked wall', 'rusty metal') — required for search/download"),
    textureType: TextureTypeSchema.optional().describe("Texture type (diffuse/normal/roughness/metallic/ao/height) — used to filter search or set import type"),
    category: CategorySchema.optional().describe("Texture category (concrete/wood/metal/fabric/organic/stone) — used to filter search or set category"),
    resolution: ResolutionSchema.optional().describe("Texture resolution (1k/2k/4k) — used for download and import"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.",
        metadata: { success: false },
      }
    }

    const { action, query, textureType, category, resolution } = args

    if (action === "search" && !query) {
      return {
        output: "Action 'search' requires a query parameter.",
        metadata: { success: false },
      }
    }

    if (action === "download" && !query) {
      return {
        output: "Action 'download' requires a query parameter.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "search": {
        command = `texture-scout search "${query}"`
        if (textureType) command += ` type=${textureType}`
        if (category) command += ` category=${category}`
        if (resolution) command += ` res=${resolution}`
        description = `Searching for textures: '${query}'`
        break
      }

      case "download": {
        command = `texture-scout download "${query}"`
        if (textureType) command += ` type=${textureType}`
        if (resolution) command += ` res=${resolution}`
        description = `Downloading texture: '${query}'`
        break
      }

      case "apply": {
        command = `texture-scout apply`
        if (query) command += ` "${query}"`
        description = query
          ? `Applied texture '${query}' to selected material`
          : "Applied texture to selected material"
        break
      }

      case "preview": {
        command = `texture-scout preview`
        if (query) command += ` "${query}"`
        description = query
          ? `Previewing texture '${query}'`
          : "Previewing texture"
        break
      }

      case "list-downloaded":
        command = `texture-scout list-downloaded`
        description = "Listed downloaded textures"
        break

      case "set-category": {
        if (!category) {
          return {
            output: "Action 'set-category' requires a category parameter (concrete/wood/metal/fabric/organic/stone).",
            metadata: { success: false },
          }
        }
        command = `texture-scout set-category ${category}`
        description = `Set texture category to ${category}`
        break
      }

      case "import": {
        command = `texture-scout import`
        if (textureType) command += ` type=${textureType}`
        if (resolution) command += ` res=${resolution}`
        description = "Imported custom texture"
        break
      }

      case "remove": {
        if (!query) {
          return {
            output: "Action 'remove' requires a query parameter (texture name or ID).",
            metadata: { success: false },
          }
        }
        command = `texture-scout remove "${query}"`
        description = `Removed texture '${query}'`
        break
      }

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      query,
      textureType,
      category,
      resolution,
    })

    if (!result.success) {
      return {
        output: `Texture scout command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        query,
        textureType,
        category,
        resolution,
        rawResult: result.result,
      },
    }
  },
})
