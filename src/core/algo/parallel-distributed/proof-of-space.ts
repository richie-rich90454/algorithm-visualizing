/**
 * proof-of-space.ts - Sequential Proof of Space (hash chain)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A proof of space lets a prover convince a verifier that it dedicated storage
 * to a large dataset. This teaching model uses a sequential hash chain: the
 * prover derives a chain of pseudorandom values from a challenge seed and
 * stores the whole chain, then publishes only the final root. The verifier asks
 * for a few random intermediate values; because each link is a one-way hash,
 * producing an intermediate value on demand would require recomputing the whole
 * prefix, while a prover who stored the chain answers instantly.
 *
 * Limits: a deterministic 32-bit mixing hash stands in for a cryptographic
 * hash; this is a pedagogical proof, not a secure storage-hard construction.
 * The chain is capped at 256 links so the visualization stays small.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for the prover, O(checks * N) for a naive verifier
 *   Space: O(N) to store the prover's chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the stored checkpoint values plus the committed root.
 *   - The current checkpoint is gold; verified ones turn green.
 *   - meta carries the root, checkpoints, proof index, and verification count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit avalanche mixing function used as the chain link. */
export function hash32(input: number): number {
    let z = input >>> 0;
    z = (z + 0x9e3779b9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
}

function makeBars(values: number[], current: number, verified: Set<number>, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = "comparing";
        } else if (done || verified.has(index)) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toString(16).padStart(8, "0"),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, checkpoint: index < values.length - 1 ? index : -1 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; chainLength?: number; checks?: number } | null) ?? {};
    const seed = Number.isFinite(Number(task.seed)) ? Math.floor(Number(task.seed)) >>> 0 : 12345;
    const chainLength = Math.max(4, Math.min(256, Math.floor(Number(task.chainLength ?? 64)) || 64));
    const checks = Math.max(1, Math.min(8, Math.floor(Number(task.checks ?? 4)) || 4));

    const chain = new Array<number>(chainLength + 1);
    chain[0] = hash32(seed);
    for (let i = 1; i <= chainLength; i += 1) chain[i] = hash32(chain[i - 1] ?? 0);
    const root = chain[chainLength] ?? 0;

    const indices = Array.from({ length: checks }, (_, m) =>
        Math.min(chainLength, Math.floor(((m + 1) * chainLength) / (checks + 1))),
    );
    const checkpointValues = indices.map((index) => chain[index] ?? 0);
    const displayed = checkpointValues.concat([root]);
    const shown = Array.from({ length: checks + 1 }, () => 0);
    const verified = new Set<number>();

    const metaFor = (phase: string, current: number) => ({
        phase,
        seed,
        chainLength,
        checks,
        root,
        checkpointIndices: indices.slice(),
        checkpointValues: checkpointValues.slice(),
        shown: shown.slice(),
        verifiedCount: verified.size,
        allPass: verified.size === checks,
        current,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(shown, -1, verified, false),
        edges: [],
        description: `Derive a ${chainLength}-link hash chain from seed ${seed} and store every value.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("setup", -1),
    };
    step += 1;

    for (let m = 0; m < checks; m += 1) {
        shown[m] = checkpointValues[m] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(shown, m, verified, false),
            edges: [],
            description: `Prover stores checkpoint ${m} at link ${indices[m]} with value ${(checkpointValues[m] ?? 0).toString(16)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: metaFor("prover", m),
        };
        step += 1;
    }
    shown[checks] = root;
    yield {
        stepNumber: step,
        entities: makeBars(shown, checks, verified, false),
        edges: [],
        description: `Prover commits the final chain root ${root.toString(16).padStart(8, "0")}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor("commit", checks),
    };
    step += 1;

    for (let m = 0; m < checks; m += 1) {
        let cursor = checkpointValues[m] ?? 0;
        for (let i = indices[m]! + 1; i <= chainLength; i += 1) cursor = hash32(cursor);
        const passes = cursor === root;
        if (passes) verified.add(m);
        yield {
            stepNumber: step,
            entities: makeBars(shown, m, verified, false),
            edges: [],
            description: `Verifier hashes forward from checkpoint ${m} and ${passes ? "matches" : "fails to match"} the committed root.`,
            codeLineNumber: passes ? 5 : 6,
            layout: "array",
            meta: metaFor("verify", m),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(shown, -1, verified, true),
        edges: [],
        description: `All ${checks} checkpoints verified against the root; the prover demonstrated ${chainLength} stored links.`,
        codeLineNumber: 7,
        layout: "array",
        meta: metaFor("complete", -1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sequential proof of space turns storage into a chain of one-way links. The prover walks a hash function from a challenge seed for many steps and keeps every intermediate value. The verifier keeps only the last value and asks for a few random earlier ones. Because hashes cannot be run backwards or skipped, a prover who did not store the chain would have to redo a long prefix for every question, while an honest prover answers from memory immediately.",
        invariants: [
            "Each chain link depends only on the previous link, so a checkpoint determines every later value.",
            "The committed root is the value at the end of the full chain.",
            "A checkpoint verifies exactly when hashing forward from it reproduces the root.",
        ],
        correctness:
            "Because the chain is defined by value[k+1] = hash(value[k]), starting from checkpoint value[j] and applying the hash N - j times yields value[N] by construction, which equals the committed root. An honest prover stored value[j] and therefore always passes. A prover that substitutes a wrong value would need the hash at that link to map to the true suffix, which is infeasible for a one-way function, so tampered proofs are rejected with overwhelming probability. The check thus certifies that the prover possessed the stored chain.",
        complexityRationale:
            "Computing the full chain takes N hash evaluations for the prover. A naive verifier recomputing the suffix per checkpoint takes O(checks * N), though caching could reduce this. Storage of the prover chain is O(N).",
        uses: [
            "Space and storage proofs in proof-of-space blockchains",
            "Remote data possession checks for outsourced storage",
            "A teaching model for verifiable delay and sequential computation",
        ],
        references: [
            "Dziembowski, Faust, and Kolmogorov, Proofs of Space, 2015",
            "Boneh and Naor, Timed Commitments and Puzzles, 2000",
        ],
        workedExample:
            "From seed 12345 the prover derives 64 links and publishes the 64th value as root. The verifier requests checkpoints at links 12, 25, 38, and 51. Hashing forward from each stored checkpoint reaches the same root, so all four checks pass and the prover demonstrated possession of the chain.",
    },
    id: "proof-of-space",
    name: "Sequential Proof of Space",
    category: "parallel-distributed",
    complexity: { time: "O(N) prove, O(checks * N) verify", space: "O(N)" },
    defaultInput: { seed: 12345, chainLength: 64, checks: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "derive the first chain value from the challenge seed",
        "hash repeatedly to build and store the full chain",
        "publish only the final value as the commitment root",
        "for each requested checkpoint reveal its stored value",
        "hash forward from the checkpoint to the chain end",
        "accept when the result equals the committed root",
        "reject the proof when any checkpoint fails",
        "done: report how many checkpoints verified",
    ],
};

export default module;
