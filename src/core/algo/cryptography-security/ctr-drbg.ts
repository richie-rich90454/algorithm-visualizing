/**
 * ctr-drbg.ts - CTR_DRBG Deterministic Random Bit Generator (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CTR_DRBG is a NIST-approved pseudorandom generator built on a block cipher
 * in counter mode. It keeps a secret key and a counter V. To produce bytes it
 * encrypts successive counter values, then immediately updates the key and V
 * from fresh counter output so no two requests reuse the same stream. Reseeding
 * mixes in new entropy the same way. This module uses a toy one-byte block
 * cipher for teaching; it illustrates the state machine, not a secure generator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(bytes requested) toy cipher evaluations
 *   Space: O(1) for the key and counter
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a named value: seed, key, counter, outputs, reseed.
 *   - Output and updated-state rows are yellow; the final row is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Toy one-byte block cipher: a deterministic, invertible-looking mix. */
export function toyBlock(key: number, input: number): number {
    return (Math.imul((input ^ key) & 0xff, 131) + 17) & 0xff;
}

/** Encrypt successive counter bytes with the toy cipher. */
export function toyCtr(key: number, counter: number, blocks: number): number[] {
    const output: number[] = [];
    for (let i = 0; i < blocks; i += 1) {
        output.push(toyBlock(key, (counter + i) & 0xff));
    }
    return output;
}

export interface CtrDrbg {
    readonly key: number;
    readonly v: number;
    generate: (count: number) => number[];
    reseed: (seed: number) => void;
}

/** Instantiate a toy CTR_DRBG from a one-byte seed. */
export function createCtrDrbg(seed: number): CtrDrbg {
    let key = 0;
    let v = 1;

    const update = (data: number[]): void => {
        let temp = toyCtr(key, v, 2);
        key = temp[0]!;
        v = temp[1]!;
        if (data.length > 0) {
            // Encrypt the provided bytes in counter mode, then take the new
            // key and counter from the result so the entropy actually mixes in.
            const stream = toyCtr(key, v, Math.max(2, data.length));
            const mixed = stream.map((byte, i) => byte ^ (data[i] ?? 0));
            key = mixed[0]!;
            v = mixed[1]!;
        }
    };

    update([seed & 0xff]);

    return {
        get key() { return key; },
        get v() { return v; },
        generate: (count: number): number[] => {
            const output = toyCtr(key, v, Math.max(0, Math.floor(count)));
            update([]);
            return output;
        },
        reseed: (newSeed: number): void => {
            update([newSeed & 0xff]);
        },
    };
}

const LABELS = [
    "instantiation seed",
    "key after setup",
    "V after setup",
    "first request size",
    "first output bytes",
    "second output bytes",
    "reseed value",
    "post-reseed output",
    "final key / V",
];

function makeCells(values: string[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    LABELS.forEach((label, row) => {
        const present = values[row] !== undefined;
        for (let col = 0; col < 2; col += 1) {
            let state: EntityState = "idle";
            if (present) state = col === 0 ? "comparing" : "visited";
            if (col === 1 && row === LABELS.length - 1 && present) state = "sorted";
            if (row === activeRow && present) state = "active";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: col === 0 ? label : (values[row] ?? "-"),
                value: col === 0 ? label : (values[row] ?? "-"),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, label, value: values[row] ?? "" },
            });
        }
    });
    return entities;
}

function formatBytes(bytes: number[]): string {
    return bytes.length === 0 ? "(none)" : bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; count?: number; reseed?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed & 0xff : 0x5a;
    const count = typeof task.count === "number" ? Math.max(1, Math.min(16, Math.floor(task.count))) : 4;
    const reseed = typeof task.reseed === "number" ? task.reseed & 0xff : 0x3c;
    const drbg = createCtrDrbg(seed);
    const setupKey = drbg.key;
    const setupV = drbg.v;
    const first = drbg.generate(count);
    const second = drbg.generate(count);
    drbg.reseed(reseed);
    const third = drbg.generate(count);

    const values: string[] = [];
    const set = (index: number, value: string | number): void => {
        values[index] = String(value);
    };
    const metaBase = {
        rows: LABELS.length,
        cols: 2,
        seed,
        count,
        reseed,
        setupKey,
        setupV,
        first: [...first],
        second: [...second],
        postReseedOutput: [...third],
        finalKey: drbg.key,
        finalV: drbg.v,
    };

    let step = 0;
    set(0, seed); set(1, setupKey); set(2, setupV);
    yield {
        stepNumber: step,
        entities: makeCells(values, 2),
        edges: [],
        description: `Instantiated the toy CTR_DRBG with seed ${seed}; key=${setupKey}, counter V=${setupV}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(3, count); set(4, formatBytes(first));
    yield {
        stepNumber: step,
        entities: makeCells(values, 4),
        edges: [],
        description: `First request produced ${formatBytes(first)}, then the key and counter were updated.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(5, formatBytes(second));
    yield {
        stepNumber: step,
        entities: makeCells(values, 5),
        edges: [],
        description: `Second request produced ${formatBytes(second)}, different from the first because the state advanced.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(6, reseed); set(7, formatBytes(third));
    yield {
        stepNumber: step,
        entities: makeCells(values, 7),
        edges: [],
        description: `Reseeded with ${reseed}; the next request produced ${formatBytes(third)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(8, `${drbg.key} / ${drbg.v}`);
    yield {
        stepNumber: step,
        entities: makeCells(values, 8),
        edges: [],
        description: `Final state is key=${drbg.key}, V=${drbg.v}; this toy model illustrates the NIST state machine, not a secure generator.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: metaBase,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A counter-mode generator keeps a key and a counter. To make random bytes it encrypts the counter and successive increments, then throws away that stream by deriving a new key and counter from fresh counter output. That update means the next request starts from a different state, so output never repeats. Feeding in new entropy reseeds the state the same way.",
        invariants: [
            "Every output byte is produced by encrypting a distinct counter value.",
            "The key and counter are updated after every generate call.",
            "A fixed seed and operation sequence always reproduces the same bytes.",
        ],
        correctness:
            "The toy cipher is deterministic, so a given key and counter produce a fixed byte stream. Instantiation and reseeding both run the same update routine, which overwrites the key and counter from fresh counter output; generating always calls update afterward. An independent replay of these steps reproduces every byte, and because the state changes after each request, successive requests draw from different counter sequences. This is a faithful state-machine model but its one-byte toy cipher is not cryptographically secure.",
        complexityRationale:
            "Producing n bytes requires n counter encryptions, and each update uses a constant number more, so time is linear in the bytes requested. The state is just a one-byte key and one-byte counter, which is constant space.",
        uses: [
            "Teaching the instantiate, generate, and reseed state machine",
            "Explaining why generators must update state after each request",
            "A compact reference for NIST SP 800-90A CTR_DRBG structure",
        ],
        references: [
            "NIST SP 800-90A Rev. 1, Recommendation for Random Number Generation Using Deterministic Random Bit Generators, 2015",
            "Barker and Kelsey, Recommendation for the Entropy Sources Used for Random Bit Generation, 2018",
        ],
        workedExample:
            "Instantiating with seed 90 sets an initial key and counter. A first request for four bytes encrypts the counter and its next three values; the generator then derives a new key and counter. A second request therefore emits four different bytes. Reseeding with 60 mixes in new entropy and changes the bytes of the following request.",
    },
    id: "ctr-drbg",
    name: "CTR_DRBG Random Generator (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(bytes)", space: "O(1)" },
    defaultInput: { seed: 90, count: 4, reseed: 60 },
    visualType: "grid",
    run,
    pseudocode: [
        "set key to zero and counter V to one",
        "update the state from the instantiation seed",
        "for a generate request, encrypt V and successive counters",
        "emit those bytes, then update key and V from fresh counter output",
        "for a reseed request, update the state from the new entropy",
        "repeat generate requests as needed",
        "done: report the output bytes and the final state",
    ],
};

export default module;
