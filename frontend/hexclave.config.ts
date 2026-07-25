import { defineHexclaveConfig } from "@hexclave/next";

export const config = defineHexclaveConfig({
  apps: {
    installed: {
      "deployments-alpha": { enabled: true },
    },
  },
  auth: {
    allowSignUp: true,
  },
  "deployments-alpha": {
    services: {
      web: {
        type: "vercel",
        rootDirectory: "./",
        framework: "nextjs",
        installCommand: "npm ci",
        buildCommand: "npm run build",
        outputDirectory: ".next",
        env: {
          NEXT_PUBLIC_HEXCLAVE_PROJECT_ID: {
            type: "connection",
            value: "hexclave.projectId",
          },
        },
      },
    },
  },
});
