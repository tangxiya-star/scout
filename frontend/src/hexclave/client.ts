import { HexclaveClientApp } from "@hexclave/next";

/**
 * Public project id from the Hexclave dashboard (https://app.hexclave.com).
 * Until it's set, the app object stays null so the rest of Scout keeps
 * building and running normally — Hexclave activates automatically once you
 * add the keys in .env.local (see .env.local.example).
 */
const projectId =
  process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID ?? process.env.HEXCLAVE_PROJECT_ID;

export const hexclaveClientApp = projectId
  ? new HexclaveClientApp({
      tokenStore: "nextjs-cookie",
      urls: {
        default: {
          type: "hosted",
        },
      },
    })
  : null;
