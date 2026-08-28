/**
 * The single import boundary between the interface and the domain engine.
 *
 * Screens import from here, never from the engine directly.
 *
 * TO SWITCH TO THE REAL ENGINE: change "./engine.mock.ts" below to
 * "@stockless/backend" and delete engine.mock.ts. Nothing else changes.
 */
export * from "./engine.mock.ts";
