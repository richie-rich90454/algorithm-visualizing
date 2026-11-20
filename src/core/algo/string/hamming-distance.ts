/**
 * hamming-distance.ts - Count the positions where two strings differ.
 *
 * The Hamming distance is defined for equal-length strings and is the number
 * of positions at which the corresponding characters are different. Here an
 * unmatched tail is counted as extra differences so the visualization also
 * handles inputs of unequal length gracefully.
 *
 *   Time:  O(n)
 *   Space: O(1) beyond the emitted frames
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeRows(a: string, b: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const text = row === 0 ? a : b;
        for (let col = 0; col < text.length; col += 1) {
            const char = text[col] ?? "";
            out.push({
                id: `char-${row}-${col}`,
                type: "cell" as const,
                label: char,
                value: char,
                state: states.get(col) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, char },
            });
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "GATTACA";
    const b = task.b ?? "GATCAGA";
    let step = 0;
    const frame = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(a.length, b.length), ...meta },
    });

    const n = Math.max(a.length, b.length);
    if (n === 0) {
        yield frame([], "Both strings are empty, so the Hamming distance is zero.", 0, {
            distance: 0,
            compared: 0,
            mismatches: [],
        });
        return;
    }
    yield frame(makeRows(a, b), `Comparing "${a}" with "${b}" position by position.`, 0);
    step += 1;
    let distance = 0;
    const mismatches: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const ca = a[i] ?? "";
        const cb = b[i] ?? "";
        const differs = ca !== cb;
        if (differs) {
            distance += 1;
            mismatches.push(i);
        }
        const states = new Map<number, EntityState>();
        for (let k = 0; k <= i; k += 1) {
            states.set(k, mismatches.includes(k) ? "error" : "sorted");
        }
        states.set(i, differs ? "comparing" : "sorted");
        yield frame(
            makeRows(a, b, states),
            `Position ${i}: "${ca}" versus "${cb}" ${differs ? "differs" : "matches"}.`,
            differs ? 2 : 1,
            { position: i, distance, mismatches: [...mismatches] },
        );
        step += 1;
    }
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) finalStates.set(i, mismatches.includes(i) ? "error" : "sorted");
    yield frame(
        makeRows(a, b, finalStates),
        `Hamming distance is ${distance} over ${n} compared position(s).`,
        3,
        { distance, mismatches, compared: n },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Hamming distance measures how many slots two strings disagree in when they are lined up side by side. Walk a single index across both strings and add one every time the characters at that index are different. It is the simplest measure of string difference and only makes sense when the strings have the same length.",
        invariants: [
            "After scanning position i, the running count equals the number of differences among positions 0 through i.",
            "Each position is visited exactly once, so a character is never counted twice.",
            "Matched positions add zero and mismatched positions add exactly one.",
        ],
        correctness:
            "The definition of Hamming distance is the cardinality of the set of indices where the two strings differ. The loop tests that predicate independently at every index in the overlapping range and accumulates exactly one for each true case, so the final count is that cardinality. Counting an unmatched tail character as a difference simply extends the same predicate with an empty character.",
        complexityRationale:
            "The loop makes one constant-time character comparison per position, so time is O(n) where n is the longer length. Only a counter and a mismatch list are kept, so auxiliary space is O(1) apart from the frames emitted for visualization.",
        uses: [
            "Comparing equal-length error-correcting code words",
            "Counting differing bits in coding theory and cryptography",
            "Quick similarity checks on fixed-length identifiers",
        ],
        references: [
            "Hamming, Error Detecting and Error Correcting Codes, Bell System Technical Journal 29 (1950)",
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.6.2",
        ],
        workedExample:
            'Comparing "GATTACA" with "GATCAGA" position by position, the characters differ at indices 4 and 5 and agree everywhere else, so the Hamming distance is 2.',
    },
    id: "hamming-distance",
    name: "Hamming Distance",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { a: "GATTACA", b: "GATCAGA" },
    visualType: "grid",
    run,
    pseudocode: [
        "let distance be zero",
        "for each position i up to the length of the strings",
        "compare the character of the first string with the second",
        "when they differ: add one to distance",
        "record the index of every mismatch",
        "done: distance is the count of differing positions",
    ],
};

export default module;
