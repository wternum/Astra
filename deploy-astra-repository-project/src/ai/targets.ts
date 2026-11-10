/**
 * Which platform an optimized prompt is written for.
 *
 * - "arena": Arena (arena.ai) Code mode battles. Two anonymous models receive the
 *   same prompt, build a runnable web app in a sandbox, and voters compare the
 *   live previews on functionality, usability, fidelity and visual quality.
 * - "general": the original five-section prompt for any chat model.
 *
 * Engine calls default to "general" so existing callers keep their behaviour;
 * the workspace UI starts in TARGET_DEFAULTS.target.
 */
export type PromptTarget = "arena" | "general";

/** How Arena prompts describe the build environment. */
export type ArenaStack = "react" | "html" | "neutral";

/** "realistic": coherent fictional demo content. "labelled": mark demo content as replaceable. */
export type ArenaContentPolicy = "realistic" | "labelled";

export interface TargetDefaults {
  target: PromptTarget;
  arena: { stack: ArenaStack; content: ArenaContentPolicy; followUps: boolean };
}

/**
 * Product decisions for the Arena Code target (2026-11-10): Arena is the default
 * workspace target, Arena builds are multi-file React projects, demo content may
 * be realistic fiction, and copyable follow-up prompts are offered.
 */
export const TARGET_DEFAULTS: TargetDefaults = {
  target: "arena",
  arena: { stack: "react", content: "realistic", followUps: true },
};

export function normalizeTarget(value: unknown, fallback: PromptTarget = "general"): PromptTarget {
  return value === "arena" || value === "general" ? value : fallback;
}
