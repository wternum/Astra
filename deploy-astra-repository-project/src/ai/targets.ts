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

/**
 * First-turn scope. "core": only the core loop (3–5 features), the rest is a
 * backlog added in later rounds. "full": core and backlog in the first turn.
 */
export type ArenaScope = "core" | "full";

export interface TargetDefaults {
  target: PromptTarget;
  arena: { stack: ArenaStack; content: ArenaContentPolicy; scope: ArenaScope };
}

/**
 * Product decisions for the Arena Code target (2026-11-10): Arena is the default
 * workspace target, Arena builds are multi-file React projects, demo content may
 * be realistic fiction, and the first turn builds the core loop so later rounds
 * can fix, polish, harden and extend the same project.
 */
export const TARGET_DEFAULTS: TargetDefaults = {
  target: "arena",
  arena: { stack: "react", content: "realistic", scope: "core" },
};

export function normalizeScope(value: unknown, fallback: ArenaScope = TARGET_DEFAULTS.arena.scope): ArenaScope {
  return value === "core" || value === "full" ? value : fallback;
}

export function normalizeTarget(value: unknown, fallback: PromptTarget = "general"): PromptTarget {
  return value === "arena" || value === "general" ? value : fallback;
}
