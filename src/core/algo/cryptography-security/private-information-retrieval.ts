/**
 * private-information-retrieval.ts - Two-Server XOR Private Information Retrieval
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In two-server PIR a client retrieves database item i without either server
 * learning i, provided the servers do not collude. The client sends each server
 * a random subset of indices; the second subset is the first with index i
 * toggled. Each server xors the bits in its subset. Because every unrequested
 * index appears in both subsets or in neither, those contributions cancel, and
 * xoring the two answers leaves exactly the requested bit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per server to xor its subset
 *   Space: O(n) for the two query bit vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A three-row grid shows the database and the two query vectors.
 *   - The requested column is highlighted so the cancellation is visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function makeCells(
    database: number[],
    query1: number[],
    query2: number[],
    index: number,
    phase: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < database.length; col += 1) {
            const value = row === 0 ? database[col] : row === 1 ? query1[col] : query2[col];
            let state: EntityState = "idle";
            if (col === index) {
                state = "path";
            } else if (phase >= row + 1) {
                state = "sorted";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: `${value ?? 0}`,
                value: value ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, series: row === 0 ? "db" : row === 1 ? "q1" : "q2" },
            });
        }
    }
    return entities;
}

/** The two-server XOR PIR generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { database?: number[]; index?: number; seed?: number } | null
    ) ?? {};
    const database: number[] = task.database ?? [1, 0, 1, 1, 0, 0, 1, 0];
    const index =
        typeof task.index === "number"
            ? Math.max(0, Math.min(Math.floor(task.index), Math.max(0, database.length - 1)))
            : 3;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 13;
    const random = mulberry32(seed);

    const query1 = database.map(() => (random() < 0.5 ? 1 : 0));
    const query2 = query1.map((value, position) => (position === index ? 1 - value : value));

    const answer = (query: number[]) =>
        database.reduce((xor, bit, position) => (query[position] === 1 ? xor ^ bit : xor), 0);
    const answer1 = answer(query1);
    const answer2 = answer(query2);
    const result = answer1 ^ answer2;

    const baseMeta = {
        rows: 3,
        cols: database.length,
        index,
        seed,
        database: [...database],
        query1: [...query1],
        query2: [...query2],
    };

    yield {
        stepNumber: 0,
        entities: makeCells(database, query1, query2, index, 0),
        edges: [],
        description: `Two-server XOR PIR on a ${database.length}-bit database requesting index ${index}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, answer1: 0, answer2: 0, result: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(database, query1, query2, index, 2),
        edges: [],
        description: `The client sends a random subset to server one and that subset with index ${index} toggled to server two.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...baseMeta, answer1: 0, answer2: 0, result: 0 },
    };

    yield {
        stepNumber: 2,
        entities: makeCells(database, query1, query2, index, 3),
        edges: [],
        description: `Server one xors the bits in its subset and returns ${answer1}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...baseMeta, answer1, answer2: 0, result: 0 },
    };

    yield {
        stepNumber: 3,
        entities: makeCells(database, query1, query2, index, 3),
        edges: [],
        description: `Server two xors the bits in its subset and returns ${answer2}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...baseMeta, answer1, answer2, result: 0 },
    };

    yield {
        stepNumber: 4,
        entities: makeCells(database, query1, query2, index, 3),
        edges: [],
        description: `Xoring the answers cancels every unrequested bit and leaves database[${index}] = ${result}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...baseMeta, answer1, answer2, result },
    };
}

/** The two-server XOR PIR module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask two non-colluding servers for random subsets that differ only in the one item you want. Each server xors its subset and learns nothing about which item mattered, because its subset is random. Xoring the two replies cancels every item that appeared in both subsets or in neither, leaving the item you asked for.",
        invariants: [
            "The two query vectors differ in exactly one position, the requested index.",
            "Each query vector alone is a uniform random subset and is independent of the index.",
            "The client's final answer is the xor of the two server replies.",
        ],
        correctness:
            "For any index j different from i, the query bit is the same in both vectors, so database[j] is xored twice and cancels. At index i the bits differ, so exactly one server includes database[i]. The xor of the two answers is therefore database[i] alone, independent of the random subset chosen.",
        complexityRationale:
            "Generating each query vector and xoring a subset both scan all n database entries, so time is O(n) per server. Storing the two query vectors takes O(n) space.",
        uses: [
            "Private lookups from replicated databases",
            "Oblivious retrieval in privacy-preserving applications",
            "A teaching baseline for modern single-server PIR schemes",
        ],
        references: [
            "Chor, Goldreich, Kushilevitz, and Sudan, Private Information Retrieval, 1995",
            "Kushilevitz and Ostrovsky, Replication Is NOT Needed, 1997",
        ],
        workedExample:
            "For database [1,0,1,1] and a random subset {0,2}, querying index 3 sends {0,2} to one server and {0,2,3} to the other. The answers are 1 xor 1 = 0 and 1 xor 1 xor 1 = 1. Xoring them gives 1, which is database[3].",
    },
    id: "private-information-retrieval",
    name: "Private Information Retrieval (two-server XOR)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { database: [1, 0, 1, 1, 0, 0, 1, 0], index: 3, seed: 13 },
    visualType: "grid",
    run,
    pseudocode: [
        "draw a uniform random subset of database indices",
        "form the second subset by toggling the requested index",
        "send each subset to a different server",
        "server one xors the bits in its subset",
        "server two xors the bits in its subset",
        "xor the two answers to cancel shared indices",
        "done: report the retrieved database item",
    ],
};

export default module;
