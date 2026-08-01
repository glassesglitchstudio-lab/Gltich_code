import { cmd } from "./cmd"
import { runSetupWizard } from "./setup"

export const SetupCommand = cmd({
  command: "setup",
  describe: "Ilk kurulum sihirbazi (provider, arama, hafiza, tema)",
  builder: (yargs) => yargs,
  handler: async () => {
    const root = process.cwd()
    await runSetupWizard(root)
  },
})
