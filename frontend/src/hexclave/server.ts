import { HexclaveServerApp } from "@hexclave/next";
import { hexclaveClientApp } from "./client";

/**
 * Server-side Hexclave app. Server-only — never import from a client
 * component. Null until a project id is configured (mirrors the client app),
 * so a keyless checkout still builds. Uses HEXCLAVE_SECRET_SERVER_KEY.
 */
export const hexclaveServerApp = hexclaveClientApp
  ? new HexclaveServerApp({
      inheritsFrom: hexclaveClientApp,
    })
  : null;
