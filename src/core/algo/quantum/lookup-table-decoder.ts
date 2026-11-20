/**
 * lookup-table-decoder.ts - Lookup Table Decoder for a Small Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A lookup table decoder precomputes the best correction for every syndrome a
 * small code can produce, then decodes each observed syndrome with a single
 * table access. It is the simplest exact decoder: the table is built once by
 * exhaustively enumerating error patterns and keeping the lightest pattern for
 * each syndrome.
 *
 * ---------------------------------------------------------------------------
 * Limits of the simulation
 * ---------------------------------------------------------------------------
 *   - Three-qubit bit-flip repetition code, so only four distinct syndromes.
 *   - Independent X errors with equal probability; no correlated or measurement noise.
 *   - Ties between equal-weight patterns are resolved by lowest binary value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) once to build the table, O(1) per syndrome lookup
 *   Space: O(2^n) for the exhaustive table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DecoderInput {
    syndromes?: number[][];
}

const DATA_QUBITS = 3;

/** Check bits for a three-qubit bit-flip repetition code. */
function syndromeOf(errors: number[]): [number, number] {
    return [(errors[0] ?? 0) ^ (errors[1] ?? 0), (errors[1] ?? 0) ^ (errors[2] ?? 0)];
}

/** Exhaustively build syndrome -> minimum-weight correction. */
function buildTable(): Map<string, number[]> {
    const table = new Map<string, number[]>();
    for (let mask = 0; mask < 1 << DATA_QUBITS; mask += 1) {
        const errors = [0, 1, 2].map((q) => (mask >> q) & 1);
        const key = syndromeOf(errors).join("");
        const weight = errors.reduce((sum, bit) => sum + bit, 0);
        const existing = table.get(key);
        if (existing === undefined || weight < existing.reduce((sum, bit) => sum + bit, 0)) {
            table.set(key, errors);
        }
    }
    return table;
}

function makeCells(
    syndromes: number[][],
    table: Map<string, number[]>,
    active: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < syndromes.length; row += 1) {
        const key = syndromes[row]!.join("");
        const correction = table.get(key) ?? [];
        const values = [key, ...correction.map(String)];
        for (let col = 0; col < 4; col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: values[col] ?? "",
                value: values[col] ?? "",
                state: done ? "sorted" : row === active ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, field: col === 0 ? "syndrome" : "correction" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DecoderInput | null) ?? {};
    const provided = Array.isArray(task.syndromes)
        ? task.syndromes
            .filter((s): s is number[] => Array.isArray(s) && s.length === 2 && s.every((b) => b === 0 || b === 1))
        : [];
    const syndromes: number[][] = provided.length > 0
        ? provided
        : [[0, 0], [1, 1], [1, 0], [0, 1]];
    const table = buildTable();
    const results: number[][] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(syndromes, table, -1, false),
        edges: [],
        description: `Built a lookup table from all ${1 << DATA_QUBITS} error patterns for a three-qubit code.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: syndromes.length, cols: 4, lookups: 0, converged: false },
    };

    let step = 1;
    for (let i = 0; i < syndromes.length; i += 1) {
        const key = syndromes[i]!.join("");
        const correction = (table.get(key) ?? [0, 0, 0]).slice();
        results.push(correction);
        const check = syndromeOf(correction);
        const matches = check[0] === syndromes[i]![0] && check[1] === syndromes[i]![1];
        yield {
            stepNumber: step,
            entities: makeCells(syndromes, table, i, false),
            edges: [],
            description: `Lookup ${i + 1}: syndrome ${key} maps to correction ${correction.join("")}, weight ${correction.reduce((s, b) => s + b, 0)}, check ${matches ? "passed" : "failed"}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: syndromes.length,
                cols: 4,
                lookups: i + 1,
                syndrome: key,
                correction,
                weight: correction.reduce((s, b) => s + b, 0),
                converged: matches,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(syndromes, table, -1, true),
        edges: [],
        description: `Decoded ${syndromes.length} syndrome(s) using the precomputed minimum-weight table.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: syndromes.length, cols: 4, lookups: syndromes.length, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For a tiny code there are only a few possible syndromes, so the decoder can afford to remember the answer for each one. Before any data arrives it enumerates every error pattern, computes its syndrome, and records the lightest pattern seen for that syndrome. Decoding later becomes a single table read, which is as fast as a decoder can be.",
        invariants: [
            "Every syndrome that any error pattern can produce has a table entry.",
            "A stored correction always has minimum Hamming weight among patterns with that syndrome.",
            "Applying the correction reproduces the observed syndrome exactly.",
        ],
        correctness:
            "The enumerated masks cover all 2 to the n possible error patterns, so no syndrome is missed. Grouping patterns by syndrome and retaining the smallest weight therefore yields an exact maximum-likelihood correction under an independent and identically distributed error model, because likelihood decreases monotonically with weight. For the three-qubit bit-flip code the four syndromes map to no error, an error on the middle qubit, an error on the first qubit, and an error on the last qubit, each of weight at most one.",
        complexityRationale:
            "Building the table enumerates 2 to the n patterns and computes an n-bit syndrome for each, costing O(n times 2 to the n) once. Each later lookup is a hash access and a constant-size copy, so decoding is O(1) per syndrome with O(2 to the n) stored entries.",
        uses: [
            "Decoding small stabilizer codes in demonstration hardware",
            "Fast bias correction in simple quantum memories",
            "A baseline decoder for comparing more sophisticated schemes",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
            "Shor, Scheme for Reducing Decoherence in Quantum Computer Memory, 1995",
        ],
        workedExample:
            "For the three-qubit bit-flip code the syndrome pair 1,0 means the first check disagrees while the second agrees, so only qubit zero can be at fault. The table stores the pattern 1,0,0 of weight one, and applying it makes both checks agree again.",
    },
    id: "lookup-table-decoder",
    name: "Lookup Table Decoder",
    category: "quantum",
    complexity: { time: "O(1) per lookup", space: "O(2^n)" },
    defaultInput: { syndromes: [[0, 0], [1, 1], [1, 0], [0, 1]] },
    visualType: "grid",
    run,
    pseudocode: [
        "list every error pattern of the small code",
        "for each pattern compute its syndrome and its weight",
        "store the lightest pattern seen for that syndrome in a table",
        "for each observed syndrome perform one table lookup",
        "apply the stored correction to the data qubits",
        "recompute the syndrome to confirm it matches the observation",
        "done: report each syndrome and its correction",
    ],
};

export default module;
