import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VectorSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
})

export const ue5SpawnActorTool = tool({
  description:
    "Spawn an actor in the current UE5 level. Specify the actor class, optional location, rotation, and name. Uses the 'spawnactor' console command under the hood.",
  args: {
    actorClass: z.string().describe("Full class name of the actor to spawn (e.g. 'StaticMeshActor', 'Blueprint'/Game/Path/BP_MyActor')"),
    location: VectorSchema.default({ x: 0, y: 0, z: 0 }).describe("World location (x, y, z) to spawn the actor at"),
    rotation: VectorSchema.default({ x: 0, y: 0, z: 0 }).describe("Rotation in degrees (pitch, yaw, roll)"),
    name: z.string().optional().describe("Optional display name for the spawned actor"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const { x: lx, y: ly, z: lz } = args.location
    const { x: rx, y: ry, z: rz } = args.rotation
    const nameArg = args.name ? ` ${args.name}` : ""

    const command = `spawnactor ${args.actorClass} ${lx},${ly},${lz} ${rx},${ry},${rz}${nameArg}`
    const result = await connector.sendCommand(command, {
      actorClass: args.actorClass,
      location: args.location,
      rotation: args.rotation,
      name: args.name,
    })

    if (!result.success) {
      return { output: `Failed to spawn actor: ${result.error}`, metadata: { success: false } }
    }

    return {
      output: `Spawned ${args.actorClass} at (${lx}, ${ly}, ${lz})${args.name ? ` named "${args.name}"` : ""}`,
      metadata: {
        success: true,
        actorClass: args.actorClass,
        location: args.location,
        rotation: args.rotation,
        name: args.name,
      },
    }
  },
})
