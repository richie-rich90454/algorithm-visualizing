/**
 * algo.ts – The AlgorithmModule contract.
 *
 * Every algorithm in the engine – Bubble Sort, Dijkstra, KMP, you name it – is
 * a plain TypeScript module that exports a default object matching this
 * interface. The step engine does not know *anything* about the algorithms
 * themselves; it only knows how to exhaust a generator and replay the frames.
 *
 * This separation is what makes the engine so easy to extend: add a new file
 * to the right category folder, implement `run`, register it in the registry,
 * and the whole visualiser works with zero further changes.
 */

import type { LayoutType, VisualFrame } from "./visual";

/** The thirteen algorithm categories, in the order they appear in the sidebar. */
export type AlgorithmCategory =
    | "sorting"
    | "searching"
    | "graph"
    | "shortest-path"
    | "mst"
    | "flow"
    | "tree"
    | "string"
    | "math"
    | "dynamic-programming"
    | "game"
    | "geometry"
    | "data-structures";

/** Asymptotic complexity expressed as display strings, e.g. "O(n log n)". */
export interface AlgorithmComplexity {
    /** Time complexity in Big-O notation. */
    time: string;
    /** Space complexity in Big-O notation. */
    space: string;
}

/**
 * The contract every algorithm module must fulfil.
 *
 * `run` is a generator function: each `yield` produces one `VisualFrame`.
 * The engine calls `run(defaultInput)` once when the algorithm is loaded and
 * drains the generator synchronously, precomputing every frame so playback is
 * instant and deterministic.
 */
export interface AlgorithmModule {
    /** Kebab-case unique identifier, e.g. "bubble-sort". */
    id: string;
    /** Human-readable display name, e.g. "Bubble Sort". */
    name: string;
    /** One of the thirteen predefined categories. */
    category: AlgorithmCategory;
    /** Big-O complexity for the sidebar and info panel. */
    complexity: AlgorithmComplexity;
    /** The deterministic input used the first time the algorithm is opened. */
    defaultInput: unknown;
    /** The layout engine that positions this algorithm's entities. */
    visualType: LayoutType;
    /**
     * Generator that turns an input into a sequence of visual frames.
     * Must never throw; the input may be a shallow copy, so the generator is
     * responsible for deep-copying before it mutates anything.
     */
    run: (input: unknown) => Generator<VisualFrame, void, unknown>;
}
