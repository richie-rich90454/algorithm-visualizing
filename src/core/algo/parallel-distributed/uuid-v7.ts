/**
 * uuid-v7.ts - UUID Version 7 Generation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A version 7 universally unique identifier begins with the current Unix time
 * in milliseconds, followed by a version nibble and random bits. Because the
 * time is the most significant part, identifiers generated in increasing time
 * sort lexicographically, which makes them friendly to database indexes while
 * remaining globally unique.
 *
 * ---------------------------------------------------------------------------
 * Model limits
 * ---------------------------------------------------------------------------
 *   - Deterministic pseudo-random bits from a seeded linear congruential generator.
 *   - Timestamps are supplied explicitly in milliseconds; no wall-clock access.
 *   - Monotonicity holds when the supplied timestamps are nondecreasing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per identifier
 *   Space: O(1) for each emitted row
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface UuidV7Input {
    timestamps?: number[];
    seed?: number;
}

/** Deterministic 32-bit linear congruential generator. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

/** Convert a stream of random bits into the required hex digits. */
function randomHex(next: () => number, count: number): string {
    let out = "";
    while (out.length < count) {
        out += next().toString(16).padStart(8, "0");
    }
    return out.slice(0, count);
}

/** Build a canonical 36-character version 7 UUID from a millisecond timestamp. */
function makeUuid(timestamp: number, next: () => number): { uuid: string; parts: string[] } {
    const ms = Math.max(0, Math.floor(timestamp));
    const tsHex = ms.toString(16).padStart(12, "0").slice(-12);
    const stream = randomHex(next, 19);
    const randA = stream.slice(0, 3);
    const variant = ((parseInt(stream[3]!, 16) & 0x3) | 0x8).toString(16);
    const randB = stream.slice(4, 19);
    const hex = tsHex + "7" + randA + variant + randB;
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    return { uuid, parts: [tsHex, "7", randA, variant, randB] };
}

function makeCells(rows: string[][], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        const parts = rows[r]!;
        for (let c = 0; c < 5; c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: parts[c] ?? "",
                value: parts[c] ?? "",
                state: done ? "sorted" : r === active ? "comparing" : c === 1 || c === 3 ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, field: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as UuidV7Input | null) ?? {};
    const timestamps = Array.isArray(task.timestamps) && task.timestamps.length > 0
        ? task.timestamps.map((t) => (typeof t === "number" && Number.isFinite(t) ? t : 0))
        : [1700000000000, 1700000000000, 1700000000001, 1700000000002];
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed) ? task.seed : 42;
    const next = makeRandom(seed);
    const generated = timestamps.map((timestamp) => makeUuid(timestamp, next));
    const rows = generated.map((item) => item.parts);
    const ordered = generated.every((item, i) => i === 0 || item.uuid >= generated[i - 1]!.uuid);

    yield {
        stepNumber: 0,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Generating ${generated.length} version 7 identifiers from explicit millisecond timestamps.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: rows.length, cols: 5, version: 7, ordered, converged: false },
    };

    let step = 1;
    for (let i = 0; i < generated.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, false),
            edges: [],
            description: `Identifier ${i + 1}: timestamp ${generated[i]!.parts[0]}, version 7, variant ${generated[i]!.parts[3]}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: rows.length, cols: 5, version: 7, ordered, converged: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `Generated ${generated.length} identifiers; lexicographic order ${ordered ? "matches" : "does not match"} time order.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: rows.length, cols: 5, version: 7, ordered, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A random identifier is unique but useless as a database key because nearby inserts land on different pages. Version 7 fixes this by putting the millisecond timestamp in the high bits and randomness in the low bits. Sorting the strings now sorts them by creation time, while the random tail keeps simultaneous identifiers distinct.",
        invariants: [
            "The first 48 bits encode the Unix timestamp in milliseconds.",
            "The version nibble equals seven and the variant nibble is eight through eleven.",
            "Nondecreasing timestamps produce nondecreasing identifier strings.",
        ],
        correctness:
            "The layout assigns the most significant 48 bits to the timestamp, then a fixed version nibble of seven, twelve random bits, a two-bit variant marker set to the binary pattern one zero, and the remaining random bits. Because the timestamp occupies the highest-order hex digits, comparing two identifiers lexicographically compares their timestamps before any random part; equal timestamps fall back to the random tail, which differs with overwhelming probability. The fixed version and variant nibbles make the value parseable as a standards-compliant version 7 identifier.",
        complexityRationale:
            "Generating an identifier formats one integer and draws a fixed number of random bits, so time is O(1) per identifier. Only the emitted rows are retained, giving O(n) space for n identifiers.",
        uses: [
            "Time-sortable primary keys in distributed databases",
            "Event and trace identifiers that index efficiently",
            "Replacing sequential IDs in sharded systems without coordination",
        ],
        references: [
            "RFC 9562, Universally Unique IDentifiers (UUID), 2024",
            "Peabody, The UUIDs That Do Not Fit, 2022",
        ],
        workedExample:
            "A timestamp of 1700000000000 milliseconds is 18AF2B3500 in hexadecimal, padded to twelve digits. Placing version seven and a variant of eight after it yields an identifier beginning 18af2b35-0007-8..., which sorts before any identifier whose timestamp is 1700000000001.",
    },
    id: "uuid-v7",
    name: "UUID Version 7",
    category: "parallel-distributed",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { timestamps: [1700000000000, 1700000000000, 1700000000001, 1700000000002], seed: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the list of millisecond timestamps and a random seed",
        "for each timestamp take its low 48 bits as hexadecimal digits",
        "append the fixed version nibble seven",
        "draw twelve random bits for the first random field",
        "set the variant bits to one zero and draw the remaining random bits",
        "format the 128 bits as eight groups separated by hyphens",
        "check that identifiers sort in nondecreasing timestamp order",
        "done: report the generated identifiers and their parts",
    ],
};

export default module;
