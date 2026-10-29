/**
 * Demo mode makes Grove explorable without email: one-click demo sign-in,
 * and the password-reset screen shows the link it would have emailed.
 * Turn it off (DEMO_MODE=false) for any real deployment.
 */
export const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "grove-demo-2026";

/** An employee whose password may be reset in the demo, for the reset flow. */
export const DEMO_RESET_EXAMPLE = "fatima.shaikh@northwindgrove.in";
