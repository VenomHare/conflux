import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "conflux",
    framework: "nextjs",
    env: ".env",
  },
});
