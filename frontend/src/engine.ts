/**
 * The single import boundary between the interface and the domain engine.
 *
 * Screens import from here, never from the engine directly.
 *
 * The frontend consumes the browser-safe domain package through this one
 * boundary so screen code never duplicates the domain rules.
 */
export * from "@stockless/backend";
