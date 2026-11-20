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
 * and the whole visualizer works with zero further changes.
 */

import type { LayoutType, VisualFrame } from "./visual";

/** Algorithm categories, in the order they appear in the sidebar. */
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
    | "data-structures"
    | "ml-ai"
    | "cryptography-security"
    | "parallel-distributed"
    | "numerical-optimization"
    | "quantum"
    | "statistics-probability"
    | "production-systems";

/** Asymptotic complexity expressed as display strings, e.g. "O(n log n)". */
export interface AlgorithmComplexity {
    /** Time complexity in Big-O notation. */
    time: string;
    /** Space complexity in Big-O notation. */
    space: string;
}

/**
 * Structured educational writeup for an algorithm.
 *
 * Optional on AlgorithmModule so the existing library keeps compiling; a
 * separate content workstream fills it in module by module. All prose is
 * written in American English.
 */
export interface AlgorithmEducation {
    /** Plain-language explanation of the core idea. */
    intuition: string;
    /** Properties that remain true after each step of the algorithm. */
    invariants: string[];
    /** A correctness argument or proof sketch. */
    correctness: string;
    /** Why the stated time and space bounds hold. */
    complexityRationale: string;
    /** Concrete situations where the algorithm is used in practice. */
    uses: string[];
    /** Citations or suggested further reading, one entry per item. */
    references: string[];
    /** A short hand-worked example on a small input. */
    workedExample: string;
}

/**
 * The contract every algorithm module must fulfill.
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
    /**
     * Textbook pseudocode, one entry per line, displayed in PseudocodePanel.
     * Each frame's `codeLineNumber` is an index into this array. Every module
     * must supply it: 5-12 lines, imperative textbook style
     * (e.g. "for j ← 0 to n-2-i"), AP CSP + university level. The first line
     * (index 0) describes setup/initial state; the last line describes the
     * finished result.
     */
    pseudocode?: string[];
    /**
     * Structured educational writeup (intuition, invariants, correctness,
     * complexity rationale, uses, references, worked example). Optional while
     * the content library is being filled in.
     */
    education?: AlgorithmEducation;
}
