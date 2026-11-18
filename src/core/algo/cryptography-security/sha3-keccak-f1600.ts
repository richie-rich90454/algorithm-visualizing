/**
 * sha3-keccak-f1600.ts - One Round of the Keccak-f[1600] Permutation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module implements exactly ONE round of the Keccak-f[1600] permutation
 * on the full 25-lane, 64-bit state. It is a faithful model of the round's
 * mathematics (theta, rho, pi, chi, iota), not a hash function and not a
 * secure primitive. A complete SHA-3 hash applies all 24 rounds and a sponge
 * construction, neither of which is implemented here.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(25) per round
 *   Space: O(25) for the state and its copy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A 5 by 5 grid shows the state lanes as 16-digit hexadecimal values.
 *   - Frames are shown after theta, after rho and pi, after chi, and after
 *     iota, so each sub-step can be inspected on its own.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = (1n << 64n) - 1n;
const RC0 = 0x0000000000000001n;

/** Rotation offsets r[x][y] indexed as x + 5*y (Keccak specification). */
const ROT: number[] = [
    0, 1, 62, 28, 27,
    36, 44, 6, 55, 20,
    3, 10, 43, 25, 39,
    41, 45, 15, 21, 8,
    18, 2, 61, 56, 14,
];

/** Rotate a 64-bit lane left by n positions. */
export function rotl64(value: bigint, n: number): bigint {
    const shift = ((n % 64) + 64) % 64;
    if (shift === 0) {
        return value & MASK;
    }
    return ((value << BigInt(shift)) | (value >> BigInt(64 - shift))) & MASK;
}

/** Deterministic non-zero starting state so the round has visible activity. */
export function seedState(): bigint[] {
    const state: bigint[] = [];
    for (let i = 0; i < 25; i += 1) {
        state.push((BigInt(i + 1) * 0x9e3779b97f4a7c15n) & MASK);
    }
    return state;
}

/** Apply one Keccak-f[1600] round, returning the state after each sub-step. */
export function keccakRound(input: bigint[]) {
    const a = input.slice(0, 25).map((lane) => lane & MASK);
    while (a.length < 25) {
        a.push(0n);
    }

    // Theta: mix a parity of each column into the opposite columns.
    const c: bigint[] = [];
    for (let x = 0; x < 5; x += 1) {
        let parity = 0n;
        for (let y = 0; y < 5; y += 1) {
            parity ^= a[x + 5 * y] ?? 0n;
        }
        c.push(parity);
    }
    const d: bigint[] = [];
    for (let x = 0; x < 5; x += 1) {
        d.push((c[(x + 4) % 5] ?? 0n) ^ rotl64(c[(x + 1) % 5] ?? 0n, 1));
    }
    for (let x = 0; x < 5; x += 1) {
        for (let y = 0; y < 5; y += 1) {
            a[x + 5 * y] = (a[x + 5 * y] ?? 0n) ^ (d[x] ?? 0n);
        }
    }
    const afterTheta = a.slice();

    // Rho and Pi: rotate each lane and move it to a new (x, y) position.
    const b: bigint[] = Array(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
        for (let y = 0; y < 5; y += 1) {
            const targetX = y;
            const targetY = (2 * x + 3 * y) % 5;
            b[targetX + 5 * targetY] = rotl64(a[x + 5 * y] ?? 0n, ROT[x + 5 * y] ?? 0);
        }
    }

    // Chi: a nonlinear combination across each row.
    for (let x = 0; x < 5; x += 1) {
        for (let y = 0; y < 5; y += 1) {
            const left = b[((x + 1) % 5) + 5 * y] ?? 0n;
            const right = b[((x + 2) % 5) + 5 * y] ?? 0n;
            a[x + 5 * y] = (b[x + 5 * y] ?? 0n) ^ (~left & right & MASK);
        }
    }
    const afterChi = a.slice();

    // Iota: break the symmetry by mixing in a round constant.
    a[0] = (a[0] ?? 0n) ^ RC0;
    const afterIota = a.slice();

    return { afterTheta, afterRhoPi: b, afterChi, afterIota };
}

/** Build a 5 by 5 grid of lane cells at a given sub-step. */
function makeCells(state: bigint[], current: number, step: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 5; x += 1) {
            const lane = state[x + 5 * y] ?? 0n;
            const stateEnum: EntityState = step === current ? "comparing" : step > current ? "idle" : "sorted";
            entities.push({
                id: `cell-${x}-${y}`,
                type: "cell",
                label: lane.toString(16).padStart(16, "0"),
                value: lane.toString(16),
                state: stateEnum,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: y, col: x },
            });
        }
    }
    return entities;
}

/** Hex-string form of a state for the frame meta. */
function toHex(state: bigint[]): string[] {
    return state.slice(0, 25).map((lane) => lane.toString(16).padStart(16, "0"));
}

/** The Keccak round generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { state?: string[] } | null) ?? {};
    let start: bigint[];
    if (Array.isArray(task.state) && task.state.length === 25) {
        start = task.state.map((hex) => BigInt(`0x${hex.replace(/^0x/, "")}`) & MASK);
    } else {
        start = seedState();
    }

    const stages = keccakRound(start);
    const names = ["theta", "rho and pi", "chi", "iota"];
    const stageStates = [stages.afterTheta, stages.afterRhoPi, stages.afterChi, stages.afterIota];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(start, -1, -1),
        edges: [],
        description: "Initial 5 by 5 state (25 lanes of 64 bits) before one Keccak-f[1600] round.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 5, cols: 5, round: 0, step: "initial", state: toHex(start) },
    };
    step += 1;

    for (let i = 0; i < stageStates.length; i += 1) {
        const state = stageStates[i];
        if (!state) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeCells(state, i, i),
            edges: [],
            description: `After ${names[i]}: lane 0 is ${(state[0] ?? 0n).toString(16).padStart(16, "0")}.`,
            codeLineNumber: i + 1,
            layout: "grid",
            meta: { rows: 5, cols: 5, round: 0, step: names[i], state: toHex(state) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(stages.afterIota, -1, 4),
        edges: [],
        description: "Done: one Keccak-f[1600] round applied. This is a toy demo, not a hash or a secure primitive.",
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 5,
            cols: 5,
            round: 0,
            step: "done",
            state: toHex(stages.afterIota),
            converged: true,
        },
    };
}

/** The Keccak round module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Keccak state is a 5 by 5 table of 64-bit numbers called lanes. One round scrambles it in five small passes: theta mixes each column's parity into neighboring columns, rho rotates the lanes by fixed amounts, pi shuffles their positions, chi combines each row nonlinearly, and iota adds a constant to break symmetry. Twenty-four such rounds form the full permutation.",
        invariants: [
            "Every lane stays a 64-bit value throughout the round.",
            "Theta and chi are applied across rows and columns of the current state.",
            "The round constant is mixed into lane (0, 0) only, in the iota step.",
        ],
        correctness:
            "Each sub-step implements the published Keccak-f specification exactly: theta uses the parity of column x to compute D[x] from columns x-1 and x+1; rho and pi rotate lane (x, y) by the specified offset and place it at (y, (2x+3y) mod 5); chi computes B[x] xor (not B[x+1] and B[x+2]); iota xors the round constant into lane zero. Comparing each stage against an independent implementation verifies these identities.",
        complexityRationale:
            "The state has a fixed 25 lanes, so each of the five passes does a constant number of operations, giving O(25) time and O(25) space for the copied state.",
        uses: [
            "The permutation underlying SHA-3 and SHAKE hash functions",
            "Sponge constructions for hashing and extendable output",
            "A teaching model for a modern nonlinear permutation",
        ],
        references: [
            "Bertoni, Daemen, Peeters, and Van Assche, The Keccak Reference, 2011",
            "NIST, FIPS 202: SHA-3 Standard: Permutation-Based Hash and Extendable-Output Functions, 2015",
        ],
        workedExample:
            "Starting from nonzero seeded lanes, theta first computes each column's XOR parity. If only lane (0, 0) is 1, then column 0's parity is 1, so theta flips lane (1, 0) by 1 and lane (4, 0) by 2 because D[1] = C[0] and D[4] = rotate-left(C[0], 1). The later passes then rotate, shuffle, and mix those bits.",
    },
    id: "sha3-keccak-f1600",
    name: "SHA-3 Keccak-f[1600] Round",
    category: "cryptography-security",
    complexity: { time: "O(25)", space: "O(25)" },
    defaultInput: {},
    visualType: "grid",
    run,
    pseudocode: [
        "load the 25 lanes of the 64-bit state",
        "theta: xor each column parity into neighboring columns",
        "rho: rotate each lane by its fixed offset",
        "pi: move lane (x,y) to (y, 2x+3y mod 5)",
        "chi: xor each lane with not-neighbor and next-neighbor",
        "iota: xor the round constant into lane zero",
        "done: report the state after one round",
    ],
};

export default module;
