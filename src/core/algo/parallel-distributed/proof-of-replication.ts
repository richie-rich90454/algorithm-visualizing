/**
 * proof-of-replication.ts - Proof of Replication (toy seal and challenge core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A proof of replication convinces a verifier that a storage provider holds a
 * distinct physical copy of a dataset rather than a single copy it can reroute
 * challenges to. The sealing step maps each original block through a keyed
 * permutation and a keyed additive mask to produce a replica. A challenge names
 * a replica block; the prover returns that block together with the permutation
 * and mask positions, and the verifier recomputes the expected value from the
 * original data.
 *
 * This is a deterministic teaching model of the seal, challenge, and verify
 * core. It uses no zero-knowledge proofs, no RSA sequential encoding, no Merkle
 * proofs, and no hardware assumptions, so it demonstrates binding without the
 * cryptographic soundness of a production PoRep.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(blocks) to seal, O(1) per challenge verification
 *   Space: O(blocks) for the replica and the permutation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show original data blocks or the sealed replica blocks.
 *   - The challenged block is yellow; a verified block is green, a failure red.
 *   - meta carries the permutation, masks, challenge result, and replica data.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Proof {
    index: number;
    source: number;
    mask: number;
    value: number;
}

function makeBars(values: number[], state: EntityState, highlight: number, stateOfHighlight: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: index === highlight ? stateOfHighlight : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, block: index },
    }));
}

/** Deterministic linear congruential steps used to build a permutation and mask. */
function* randomWords(seed: number, count: number): Generator<number, void, unknown> {
    let state = (seed || 1) >>> 0;
    for (let index = 0; index < count; index += 1) {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        yield state >>> 0;
    }
}

/** Seal a dataset and run a sequence of replication challenges. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sectors?: number; blocks?: number; seed?: number; challenges?: number[] } | null) ?? {};
    const sectors = typeof task.sectors === "number" ? Math.max(1, Math.floor(task.sectors)) : 2;
    const blocks = typeof task.blocks === "number" ? Math.max(2, Math.floor(task.blocks)) : 8;
    const total = sectors * blocks;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const challenges: number[] = Array.isArray(task.challenges) && task.challenges.length > 0
        ? task.challenges.map((value) => Math.min(total - 1, Math.max(0, Math.floor(Number(value) || 0))))
        : [0, 3, blocks + 5, total - 1];

    const words = [...randomWords(seed, total * 3)];
    const data = words.slice(0, total).map((value) => value % 251);
    const permutation: number[] = Array.from({ length: total }, (_, index) => index);
    for (let index = total - 1; index > 0; index -= 1) {
        const swap = words[total + index]! % (index + 1);
        const temporary = permutation[index]!;
        permutation[index] = permutation[swap]!;
        permutation[swap] = temporary;
    }
    const masks = words.slice(total * 2, total * 3).map((value) => value % 251);
    const replica = data.map((_, index) => (data[permutation[index]!]! + masks[index]!) % 251);

    const metadata = (phase: string, challenge: number, valid: boolean, validCount: number, proof: Proof | null) => ({
        phase,
        challenge,
        valid,
        validCount,
        challengeCount: challenges.length,
        total,
        data,
        replica,
        permutation,
        masks,
        proof: proof ? [proof.index, proof.source, proof.mask, proof.value] : ([] as number[]),
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(data, "idle", -1, "idle"),
        edges: [],
        description: `Original dataset of ${total} block(s) across ${sectors} sector(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: metadata("data", -1, false, 0, null),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(replica, "comparing", -1, "idle"),
        edges: [],
        description: "Sealing maps each block through a keyed permutation and additive mask.",
        codeLineNumber: 2,
        layout: "array",
        meta: metadata("sealed", -1, false, 0, null),
    };
    step += 1;

    let validCount = 0;
    for (let index = 0; index < challenges.length; index += 1) {
        const challenge = challenges[index]!;
        const source = permutation[challenge]!;
        const mask = masks[challenge]!;
        const value = replica[challenge]!;
        const expected = (data[source]! + mask) % 251;
        const valid = value === expected;
        if (valid) validCount += 1;
        const proof: Proof = { index: challenge, source, mask, value };
        yield {
            stepNumber: step,
            entities: makeBars(replica, "idle", challenge, valid ? "sorted" : "error"),
            edges: [],
            description: `Challenge ${challenge}: replica block ${value} ${valid ? "matches" : "fails"} the recomputed expectation ${expected}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: metadata("challenge", challenge, valid, validCount, proof),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(replica, "sorted", -1, "idle"),
        edges: [],
        description: `All ${validCount} of ${challenges.length} replication challenges were verified.`,
        codeLineNumber: 7,
        layout: "array",
        meta: metadata("done", -1, validCount === challenges.length, validCount, null),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A storage proof should answer a question the provider cannot predict: open this particular replica block and show that it came from the original dataset. Sealing permutes and masks every block so the replica is a genuinely distinct encoding, and a challenge checks one block against the original. Passing many unpredictable challenges makes it infeasible to answer by keeping only a single shared copy.",
        invariants: [
            "The seal permutation is a bijection, so decoding can recover every original block.",
            "Each replica block equals its permuted source block plus a keyed mask modulo the block alphabet.",
            "A challenge succeeds only when the returned block matches that recomputed value.",
        ],
        correctness:
            "The permutation is generated by a Fisher-Yates shuffle and is therefore a bijection, while the mask is a deterministic function of the key and block position. For any challenge the verifier knows the original data and the key, so it can recompute the unique expected replica block. Equality can only hold when the prover stored the sealed value at that exact position; a provider without the replica cannot produce the matching mask-offset value for an unpredictable index. A tampered or substituted block therefore fails its challenge.",
        complexityRationale:
            "Sealing visits each block once to permute and mask it, O(blocks) time. A challenge looks up one permutation entry, one mask, and one data block, so verification is O(1). The replica, permutation, and masks occupy O(blocks) space.",
        uses: [
            "Proof-of-replication and proof-of-space in decentralized storage networks",
            "Auditing that a remote backup still holds an independent copy",
            "A teaching model for binding data to a specific storage commitment",
        ],
        references: [
            "Ateniese et al., Proofs of Replicated Storage, 2011",
            "Ben-Sasson et al., Bootstrapping Secure Interactive Proof Protocols, 2013",
        ],
        workedExample:
            "With two sectors of eight blocks and seed seven, block zero of the replica might come from original block five plus a keyed mask. A challenge for position zero returns that value; the verifier adds the same source and mask and confirms equality. Changing one byte of the replica makes exactly that block's challenge fail.",
    },
    id: "proof-of-replication",
    name: "Proof of Replication (Toy Seal and Challenge)",
    category: "parallel-distributed",
    complexity: { time: "O(blocks) seal, O(1) per challenge", space: "O(blocks)" },
    defaultInput: { sectors: 2, blocks: 8, seed: 7, challenges: [0, 3, 11, 15] },
    visualType: "array",
    run,
    pseudocode: [
        "generate the original data blocks from a fixed seed",
        "build a keyed permutation of all block positions",
        "derive a keyed additive mask for every position",
        "seal each block as permuted source plus mask modulo the alphabet",
        "for each challenge open the requested replica block",
        "recompute the expected value from the original data and mask",
        "accept the proof only when the two values agree",
        "done: report the number of verified challenges",
    ],
};

export default module;
