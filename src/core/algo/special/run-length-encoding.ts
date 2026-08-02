/**
 * run-length-encoding.ts – Run-Length Encoding (RLE)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Run-length encoding compresses a string by replacing consecutive equal
 * characters with (count, character) pairs. "aaabbbc" becomes "3a3b1c". It
 * is simple and works extremely well on data with long runs (simple images,
 * sensor logs), but can expand data without runs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) encode and decode
 *   Space: O(n) for the output
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The input characters are shown as cells.
 *   - The current run is highlighted.
 *   - The encoded pairs are shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The run-detection loop is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the input string.
 *
 * @param text The input.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return text.split("").map((char, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: char,
        value: char,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The RLE generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "aaabbbcddd";

    let step = 0;

    // Frame 0: the input.
    yield {
        stepNumber: step,
        entities: makeCells(text),
        edges: [],
        description: `Run-length encoding of "${text}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { length: text.length },
    };
    step += 1;

    // Detect runs.
    const encoded: string[] = [];
    let i = 0;
    while (i < text.length) {
        const char = text[i] as string;
        let runEnd = i;
        while (runEnd < text.length && text[runEnd] === char) {
            runEnd += 1;
        }
        const count = runEnd - i;
        encoded.push(`${count}${char}`);

        // Highlight the run.
        const states = new Map<number, EntityState>();
        for (let k = i; k < runEnd; k += 1) {
            states.set(k, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeCells(text, states),
            edges: [],
            description: `Run of ${count} × "${char}" → encoded as "${count}${char}".`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { encoded: encoded.join("") },
        };
        step += 1;

        i = runEnd;
    }

    const result = encoded.join("");
    yield {
        stepNumber: step,
        entities: makeCells(text),
        edges: [],
        description: `Encoded: "${text}" → "${result}" (${text.length} → ${result.length} characters).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { encoded: result },
    };
}

/** The Run-Length Encoding module, registered with the engine. */
const module: AlgorithmModule = {
    id: "run-length-encoding",
    name: "Run-Length Encoding",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "aaabbbcddd" },
    visualType: "grid",
    run,
};

export default module;
