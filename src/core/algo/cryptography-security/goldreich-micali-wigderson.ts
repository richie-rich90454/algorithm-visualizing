/**
 * goldreich-micali-wigderson.ts - GMW Two-Party Computation of a Boolean Circuit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GMW secure computation splits every input bit into two shares whose xor is
 * the bit. XOR gates are free: each party xors its own shares. AND gates need
 * interaction: one party builds a four-entry table from its shares and a random
 * mask, and the other party obtains exactly one entry by oblivious transfer,
 * learning nothing about the other entries. The two resulting values are shares
 * of the AND output. This module evaluates AND followed by XOR with a third bit
 * for two parties, with a simulated oblivious transfer. It is a teaching model
 * of the GMW table technique, not a general or production MPC system.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(1) OT entries per AND gate
 *   Space: O(1) shares and one four-entry table per AND gate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the two parties' shares and the four OT table entries.
 *   - meta reports each gate's shares and the reconstructed output bit.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Xor shares of two bits: each party combines its own shares. */
export function xorGate(x: [number, number], y: [number, number]): [number, number] {
    return [(x[0] ^ y[0]) & 1, (x[1] ^ y[1]) & 1];
}

/** Build the four-entry OT table for an AND gate from party one's shares. */
export function andTable(x1: number, y1: number, mask: number): number[] {
    const table = new Array<number>(4).fill(0);
    for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
            table[a * 2 + b] = (((x1 ^ a) & (y1 ^ b)) ^ mask) & 1;
        }
    }
    return table;
}

/** Simulated oblivious transfer: party two selects one table entry. */
export function otSelect(table: number[], x2: number, y2: number): number {
    return (table[(x2 & 1) * 2 + (y2 & 1)] ?? 0) & 1;
}

/** Compute xor shares of (x AND y). */
export function andGate(x: [number, number], y: [number, number], mask: number): [number, number] {
    const table = andTable(x[0]!, y[0]!, mask);
    return [mask & 1, otSelect(table, x[1]!, y[1]!)];
}

/** Reconstruct a bit from two shares. */
export function reconstruct(shares: [number, number]): number {
    return (shares[0]! ^ shares[1]!) & 1;
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index < 2 ? `party-${index}` : "OT table" },
    }));
}

/** The GMW generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { x1?: number; x2?: number; y1?: number; y2?: number; z1?: number; z2?: number; mask?: number } | null
    ) ?? {};
    const x1 = (task.x1 ?? 1) & 1;
    const x2 = (task.x2 ?? 1) & 1;
    const y1 = (task.y1 ?? 0) & 1;
    const y2 = (task.y2 ?? 1) & 1;
    const z1 = (task.z1 ?? 1) & 1;
    const z2 = (task.z2 ?? 0) & 1;
    const mask = (task.mask ?? 1) & 1;
    const x: [number, number] = [x1, x2];
    const y: [number, number] = [y1, y2];
    const z: [number, number] = [z1, z2];
    const table = andTable(x1, y1, mask);
    const andShares = andGate(x, y, mask);
    const finalShares = xorGate(andShares, z);
    const output = reconstruct(finalShares);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([x1, x2, y1, y2], -1),
        edges: [],
        description: `GMW with two parties: inputs x=${x1 ^ x2}, y=${y1 ^ y2}, z=${z1 ^ z2} held as xor shares.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x: x1 ^ x2, y: y1 ^ y2, z: z1 ^ z2, output: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(table, 0),
        edges: [],
        description: `Party one builds a four-entry AND table masked by ${mask}; party two reads one entry via OT.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { table: table.join(""), mask, andShares: andShares.join(","), output: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([andShares[0]!, andShares[1]!, ...table.slice(0, 2)], 0),
        edges: [],
        description: `AND shares are ${andShares[0]} and ${andShares[1]}, whose xor is ${reconstruct(andShares)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { andShares: andShares.join(","), andValue: reconstruct(andShares), output: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([finalShares[0]!, finalShares[1]!, z1, z2], 0),
        edges: [],
        description: `XOR the AND shares with z shares, then reconstruct: output ${output}. Simulated OT, toy circuit.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { finalShares: finalShares.join(","), output, expected: ((x1 ^ x2) & (y1 ^ y2)) ^ (z1 ^ z2) },
    };
}

/** The GMW module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "GMW lets two parties compute a boolean function while each keeps its input private. Every bit is split into two random-looking shares that xor to the real bit, so neither party alone knows the value. XOR gates require no communication because each party just xors its own shares. For an AND gate, one party prepares a small table whose entries are masked by a bit only it knows, and the other party reads one entry by oblivious transfer, revealing nothing about which entry it chose.",
        invariants: [
            "The xor of the two shares always equals the original input bit.",
            "XOR gate shares are the componentwise xor of the input shares.",
            "AND gate shares reconstruct to the AND of the underlying bits.",
        ],
        correctness:
            "For every assignment of the three inputs and every way of splitting them into shares, the reconstructed output equals the plain circuit value (x AND y) XOR z. The AND table is checked entry by entry: party two's selected entry equals the masked product, and the mask held by party one cancels on reconstruction. A single party's shares alone take both values across share splits, illustrating privacy. Oblivious transfer is simulated, so this is a teaching model, not a secure protocol.",
        complexityRationale:
            "Each AND gate uses a constant four-entry table and one oblivious transfer; XOR gates use one local bit operation per party. Space is one share per wire per party plus one table per AND gate.",
        uses: [
            "Private evaluation of boolean functions between two parties",
            "Teaching secret sharing and oblivious transfer in combination",
            "A foundation for general secure multi-party computation compilers",
        ],
        references: [
            "Goldreich, Micali, and Wigderson, How to Play any Mental Game, 1987",
            "Lindell and Pinkas, Secure Two-Party Computation via Cut-and-Choose Oblivious Transfer, 2011",
        ],
        workedExample:
            "If x is 1 shared as 1 and 0, y is 1 shared as 0 and 1, and the mask is 1, party one builds a table from its shares 1 and 0. Party two reads the entry selected by its shares 0 and 1, obtaining a bit which, xored with the mask, gives the AND value 1. Xoring with the z shares and reconstructing yields the final circuit output.",
    },
    id: "goldreich-micali-wigderson",
    name: "GMW Two-Party Boolean Circuit (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { x1: 1, x2: 1, y1: 0, y2: 1, z1: 1, z2: 0, mask: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "split each input bit into two xor shares",
        "party one builds a four-entry masked AND table",
        "party two obtains one entry by oblivious transfer",
        "the AND shares are the mask and the selected entry",
        "xor the AND shares with the shares of the third input",
        "reconstruct the output by xoring the two final shares",
        "done: report the circuit output and its expected value",
    ],
};

export default module;
