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
 * Visualization mapping
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
        meta: { encodedLen: result.length },
    };
}

/** The Run-Length Encoding module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Run-length encoding compresses data by replacing consecutive runs of the same symbol with a count-and-character pair. The string \"aaabbbc\" becomes \"3a3b1c\". It is simple and very effective on data with long runs, such as simple graphics, but it can enlarge data with few adjacent repeats.",
        "invariants": [
            "Each emitted pair represents a maximal run of one character.",
            "Runs are processed left to right and never overlap.",
            "Repeating each character its recorded count reconstructs the input exactly."
        ],
        "correctness": "Every character belongs to exactly one maximal run, so emitting a count and character for each run and decoding by repeating the character that many times rebuilds each run in order and hence the whole string. The demo reports the input versus output length.",
        "complexityRationale": "Encoding scans each character a constant number of times to find run ends, O(n), and decoding writes each output character once, also O(n). The output takes O(n) space in the worst case when there is no compression.",
        "uses": [
            "Bitmap and fax image compression (CCITT Group 3 and 4)",
            "Compressing simple graphics and icons",
            "Run detection in sensor and log data",
            "A preprocessing stage in gzip, bzip2 and video codecs"
        ],
        "references": [
            "Golomb, Run-Length Encodings, IEEE Transactions on Information Theory, 1966",
            "Sayood, Introduction to Data Compression, Chapter 3"
        ],
        "workedExample": "The text \"aaabbbcddd\" has runs aaa, bbb, c and ddd, encoded as 3a3b1c3d, shrinking ten characters to eight. Decoding expands each count-character pair back into its run and recovers \"aaabbbcddd\" exactly."
    },
    id: "run-length-encoding",
    name: "Run-Length Encoding",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "aaabbbcddd" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize scanning of input text characters",
        "count length of each run of equal characters",
        "emit count plus character for every run",
        "append encoding to the growing output",
        "track output length versus input length",
        "verify decoding reproduces the input",
        "done: compressed string with size comparison",
    ],
};

export default module;
