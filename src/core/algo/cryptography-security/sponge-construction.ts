/**
 * sponge-construction.ts - Sponge Construction (Absorb and Squeeze Core)
 *
 * TEACHING MODEL, NOT SHA-3 OR KECCAK. A sponge keeps a fixed state split into
 * a rate part, which touches the message and the output, and a capacity part,
 * which stays hidden. Each message block is XORed into the rate and the whole
 * state is permuted; output blocks are read from the rate with a permutation
 * between them. This module uses a small toy permutation so every lane can be
 * followed by hand. It makes no production security claim.
 *
 * Complexity:
 *   Time:  O((message blocks + output blocks) * permutation cost)
 *   Space: O(state size) for the sponge state
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const LANES = 4;
const RATE = 2;

type Cell = number | null;

/** Toy nonlinear permutation over four 32-bit lanes. */
function permute(state: number[]): number[] {
    const mixed = state.map((value, i) => {
        let x = (value ^ ((i + 1) * 0x11111111)) >>> 0;
        x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
        const shift = (i + 1) % 32;
        x = ((x << shift) | (x >>> (32 - shift))) >>> 0;
        return x;
    });
    return mixed.map((value, i) => (value + (mixed[(i + 1) % LANES] ?? 0)) >>> 0);
}

function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value ?? 0),
                value: value ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { message?: number[]; outputBlocks?: number; domain?: number } | null
    ) ?? {};
    const message = task.message?.length ? task.message.slice(0, 12) : [65, 66, 67, 68, 69];
    const domain = Math.max(0, Math.floor(task.domain ?? 1)) >>> 0;
    const outputBlocks = Math.max(1, Math.min(6, Math.floor(task.outputBlocks ?? 2)));
    const padded = [...message, domain];
    while (padded.length % RATE !== 0) {
        padded.push(0);
    }
    const blocks: number[][] = [];
    for (let i = 0; i < padded.length; i += RATE) {
        blocks.push([padded[i] ?? 0, padded[i + 1] ?? 0]);
    }

    let state = new Array<number>(LANES).fill(0);
    const rounds: number[][] = [];
    for (const block of blocks) {
        state = state.slice();
        state[0] = (state[0]! ^ (block[0] ?? 0)) >>> 0;
        state[1] = (state[1]! ^ (block[1] ?? 0)) >>> 0;
        state = permute(state);
        rounds.push(state.slice(0, RATE));
    }
    const digest: number[] = [];
    for (let b = 0; b < outputBlocks; b += 1) {
        digest.push(state[0] ?? 0, state[1] ?? 0);
        rounds.push([state[0] ?? 0, state[1] ?? 0]);
        state = permute(state);
    }
    const base = { rows: rounds.length, cols: RATE, lanes: LANES, rate: RATE, blocks: blocks.length };
    yield {
        stepNumber: 0,
        entities: makeCells(rounds.map(() => [null, null]), 0, -1),
        edges: [],
        description: `A ${LANES}-lane state with rate ${RATE}: absorb ${blocks.length} block(s), then squeeze ${outputBlocks} block(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", digest: digest.slice(0, 16) },
    };
    for (let r = 0; r < rounds.length; r += 1) {
        const absorbing = r < blocks.length;
        yield {
            stepNumber: r + 1,
            entities: makeCells(rounds, r + 1, r),
            edges: [],
            description: absorbing
                ? `Absorb block ${r}: XOR into the rate lanes, then permute the whole state.`
                : `Squeeze block ${r - blocks.length}: read the rate lanes, then permute for the next block.`,
            codeLineNumber: absorbing ? 2 : 4,
            layout: "grid",
            meta: {
                ...base,
                phase: absorbing ? "absorb" : "squeeze",
                round: r,
                digest: digest.slice(0, 16),
            },
        };
    }
    yield {
        stepNumber: rounds.length + 1,
        entities: makeCells(rounds, rounds.length, -1),
        edges: [],
        description: `Squeezed ${outputBlocks} output block(s); the digest is ${digest.length} lane(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", digest: digest.slice(0, 16) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sponge is a fixed-size state that repeatedly soaks up input and wrings out output. Only the rate lanes are mixed with message blocks and exposed as output; the capacity lanes are never touched directly by the input or the output. A permutation after every block scrambles the whole state so that absorbed data diffuses into the hidden part.",
        invariants: [
            "A message block is XORed only into the rate lanes before the permutation.",
            "Between output blocks the state is permuted, so successive blocks differ.",
            "The capacity lanes never directly receive input or contribute output.",
        ],
        correctness:
            "Each absorb step is a deterministic function of the current state and the message block, and each squeeze step is a deterministic function of the current state, so a given message always yields the same output sequence. The permutation is the same fixed map at every round, and the XOR of a block into the rate is invertible; the construction therefore defines a well-defined hash-like map from messages to output lanes. This toy permutation is for demonstration only.",
        complexityRationale:
            "The sponge performs one permutation per absorbed block and one per squeezed block except the first output read, so the time grows linearly in the number of blocks times the permutation cost. The state is a fixed number of lanes, so the extra space is constant.",
        uses: [
            "Hash functions built on a fixed permutation such as SHA-3",
            "Extendable-output functions with arbitrary digest length",
            "A teaching model of the absorb and squeeze paradigm",
        ],
        references: [
            "Bertoni, Daemen, Peeters, and Van Assche, The Sponge Construction, 2007",
            "NIST FIPS 202, SHA-3 Standard: Permutation-Based Hash and Extendable-Output Functions, 2015",
        ],
        workedExample:
            "With a four-lane state and rate two, absorbing the two blocks of a five-byte message XORs each pair of bytes into the first two lanes and permutes after each. Squeezing two output blocks reads the first two lanes, permutes, and reads them again to produce four output lanes.",
    },
    id: "sponge-construction",
    name: "Sponge Construction (Absorb and Squeeze Core)",
    category: "cryptography-security",
    complexity: { time: "O(blocks * permute)", space: "O(state)" },
    defaultInput: { message: [65, 66, 67, 68, 69], outputBlocks: 2, domain: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize all state lanes to zero",
        "append a domain marker and pad the message to a whole block",
        "for each message block XOR it into the rate lanes",
        "permute the whole state after each absorbed block",
        "read output lanes from the rate for each squeeze block",
        "permute the state between squeezed blocks",
        "done: return the concatenated output lanes",
    ],
};

export default module;
