/** Emit diagnostic details only when DEBUG_MODE=true is set at build/runtime. */
export function debugLog(...values: unknown[]) {
  if (process.env.NEXT_PUBLIC_DEBUG_MODE === "true") {
    console.debug("[debug]", ...values);
  }
}
