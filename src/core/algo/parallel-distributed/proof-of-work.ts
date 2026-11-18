/**
 * proof-of-work.ts - Proof of Work (nonce search)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proof of work asks a miner to find a nonce whose block hash begins with a
 * required number of zero bits. Verifiers redo one hash on the published nonce;
 * miners must redo many hashes to find it. The difficulty therefore controls
 * how much computational work a valid block proves.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the teachable algorithmic core: a deterministic hash, a leading-zero
 * difficulty test, and an exhaustive nonce search. It uses a 32-bit FNV-1a
 * checksum counted in leading hexadecimal zeros, not a production hash such as
 * double SHA-256, and it models no network, forks, or reward rules. The search
 * and one-step verification shown are exact for the toy hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(16^difficulty) hashes on average for hexadecimal difficulty
 *   Space: O(window) for the displayed recent candidates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A rolling window of nonce bars shows the leading zeros of each attempt.
 *   - The successful nonce turns green; earlier attempts stay gray.
 *   - The frame meta exposes the found nonce, its hash, and the trial count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PowInput {
    block?: string;
    difficulty?: number;
    maxNonce?: number;
}

const WINDOW = 16;

/** Deterministic toy hash: FNV-1a over "block|nonce" as eight hex digits. */
export function powHash(block: string, nonce: number): string {
    const text = `${block}|${nonce}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Count leading zero hexadecimal digits of a hash. */
export function leadingZeros(hash: string): number {
    let count = 0;
    while (count < hash.length && hash[count] === "0") {
        count += 1;
    }
    return count;
}

function makeBars(window: number[][], foundNonce: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < WINDOW; i += 1) {
        const entry = window[i];
        const nonce = entry?.[0] ?? 0;
        const zeros = entry?.[1] ?? 0;
        const found = nonce === foundNonce && foundNonce >= 0;
        const state: EntityState = found ? "sorted" : entry ? "comparing" : "idle";
        entities.push({
            id: `bar-${i}`,
            type: "bar",
            label: entry ? `${nonce}:${zeros}` : "-",
            value: zeros,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, nonce, zeros },
        });
    }
    return entities;
}

/** The proof-of-work nonce search generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PowInput | null) ?? {};
    const block = typeof task.block === "string" ? task.block : "block-1";
    const difficulty = Math.max(0, Math.min(7, typeof task.difficulty === "number" ? Math.trunc(task.difficulty) : 2));
    const maxNonce = Math.max(1, typeof task.maxNonce === "number" ? Math.trunc(task.maxNonce) : 200000);

    const window: number[][] = [];
    let foundNonce = -1;
    let foundHash = "";
    let trials = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([], -1),
        edges: [],
        description: `Mining block "${block}" at difficulty ${difficulty}; searching for a nonce whose hash starts with ${difficulty} zero(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            block,
            difficulty,
            maxNonce,
            nonce: -1,
            hash: "",
            leadingZeros: 0,
            trials: 0,
            foundNonce: -1,
            foundHash: "",
            verified: false,
        },
    };
    step += 1;

    for (let nonce = 0; nonce < maxNonce; nonce += 1) {
        const hash = powHash(block, nonce);
        const zeros = leadingZeros(hash);
        trials = nonce + 1;
        window.push([nonce, zeros]);
        if (window.length > WINDOW) {
            window.shift();
        }
        if (zeros >= difficulty) {
            foundNonce = nonce;
            foundHash = hash;
            break;
        }
        if (nonce < WINDOW || nonce % 25 === 0) {
            yield {
                stepNumber: step,
                entities: makeBars(window, -1),
                edges: [],
                description: `Nonce ${nonce} hashes to ${hash} with ${zeros} leading zero(s); need ${difficulty}.`,
                codeLineNumber: nonce < WINDOW ? 2 : 3,
                layout: "array",
                meta: {
                    block,
                    difficulty,
                    nonce,
                    hash,
                    leadingZeros: zeros,
                    trials,
                    foundNonce: -1,
                    foundHash: "",
                    verified: false,
                },
            };
            step += 1;
        }
    }

    const verified = foundNonce >= 0 && leadingZeros(powHash(block, foundNonce)) >= difficulty;
    yield {
        stepNumber: step,
        entities: makeBars(window, foundNonce),
        edges: [],
        description: foundNonce >= 0
            ? `Found nonce ${foundNonce} after ${trials} try or tries: hash ${foundHash} has ${difficulty} leading zero(s).`
            : `No nonce below ${maxNonce} satisfies difficulty ${difficulty}.`,
        codeLineNumber: verified ? 5 : 6,
        layout: "array",
        meta: {
            block,
            difficulty,
            maxNonce,
            trials,
            foundNonce,
            foundHash,
            verified,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A hash behaves like a random number, so finding an output that starts with d zeros takes roughly 16 to the d tries in hexadecimal. Miners keep changing a nonce and hashing until one wins. Anyone can check the winning block by running the hash once, which is why the work is easy to verify but costly to find.",
        invariants: [
            "Every candidate is the hash of the block text joined with its nonce.",
            "A nonce is accepted only when its leading zero count meets the difficulty.",
            "The returned nonce is the smallest one that satisfies the target.",
        ],
        correctness:
            "The search scans nonces in increasing order and stops at the first hash whose leading zero count is at least the difficulty, so the reported nonce is minimal. Verification recomputes the same deterministic hash on that nonce and counts leading zeros again, returning true exactly when the target is met. Because the hash is a pure function, verifier and miner always agree.",
        complexityRationale:
            "Each attempt costs one constant-time hash, and a random d-digit hex prefix occurs with probability 16 to the negative d, so the expected number of tries is O(16 to the d). Only the rolling display window is stored, which is O(window) space.",
        uses: [
            "Blockchain consensus and block validation",
            "Hashcash-style anti-spam tokens",
            "Teaching the difference between search cost and verification cost",
        ],
        references: [
            "Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System, 2008",
            "Dwork and Naor, Pricing via Processing or Combatting Junk Mail, CRYPTO 1992",
        ],
        workedExample:
            "For block block-1 at difficulty two, the miner hashes block-1|0, block-1|1, and so on until a digest starts with two zeros. A verifier hashes only the winning nonce, sees the two zeros, and accepts; finding it may have taken hundreds of tries, but checking takes one hash.",
    },
    id: "proof-of-work",
    name: "Proof of Work",
    category: "parallel-distributed",
    complexity: { time: "O(16^difficulty) hashes", space: "O(window)" },
    defaultInput: { block: "block-1", difficulty: 2, maxNonce: 200000 },
    visualType: "array",
    run,
    pseudocode: [
        "read the block text, difficulty, and maximum nonce",
        "for each nonce from zero upward",
        "hash the block text joined with the nonce",
        "count the leading zeros of the hash",
        "stop at the first nonce reaching the difficulty",
        "publish the nonce and the winning hash",
        "verify with a single hash of the published nonce",
        "done: report the nonce, its hash, and the number of tries",
    ],
};

export default module;
