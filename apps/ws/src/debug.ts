/** Emit collaboration-service diagnostics only when DEBUG_MODE=true. */
export function debugLog(...values: unknown[]) {
  if (process.env.DEBUG_MODE === "true") {
    console.debug("[debug]", ...values);
  }
}
