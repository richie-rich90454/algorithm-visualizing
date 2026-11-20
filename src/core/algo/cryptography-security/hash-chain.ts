/**
 * hash-chain.ts - One-Way Hash Chain
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hash chain repeatedly applies a one-way hash function to a seed value.
 * The final value, called the head or anchor, can be published early; each
 * earlier value can later be verified by hashing it forward until the head is
 * reached. Because a one-way hash cannot be inverted, an observer who knows
 * only the head cannot recover earlier links. This module uses a small toy
 * hash, so it is a teaching model and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(length) hash evaluations to build or verify
 *   Space: O(length) for the stored chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show each successive link value from seed to head.
 *   - The head is highlighted; meta reports the verification verdict.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A deterministic 32-bit FNV-1a hash over the decimal text of a value. */
export function toyHash(value: number | string): number {
    const text = String(value);
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/** Build a chain where link zero is the seed and each next link hashes the prior one. */
export function buildHashChain(seed: number, length: number): number[] {
    const steps = Math.max(1, Math.floor(length));
    const chain: number[] = [seed >>> 0];
    for (let i = 1; i <= steps; i += 1) {
        chain.push(toyHash(chain[i - 1] ?? 0));
    }
    return chain;
}

/** Verify every forward link and that the chain ends at the expected head. */
export function verifyHashChain(chain: number[], seed: number, head: number): boolean {
    if (chain.length === 0 || chain[0] !== (seed >>> 0)) {
        return false;
    }
    for (let i = 1; i < chain.length; i += 1) {
        if (toyHash(chain[i - 1] ?? 0) !== chain[i]) {
            return false;
        }
    }
    return chain[chain.length - 1] === head;
}

function makeBars(chain: number[], headIndex: number): VisualEntity[] {
    return chain.map((value, index) => ({
        id: `link-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === headIndex ? "sorted" : index <= headIndex ? "visited" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === chain.length - 1 ? "head" : "link" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; length?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 12345;
    const length = Math.min(24, Math.max(1, Math.floor(Number(task.length ?? 5)) || 5));
    const chain = buildHashChain(seed, length);
    const head = chain[chain.length - 1] ?? 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(chain, 0),
        edges: [],
        description: `Seed the hash chain with ${seed} and prepare ${length} forward hash steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, length, head, revealed: 0, verified: false },
    };
    step += 1;

    for (let i = 1; i < chain.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(chain, i),
            edges: [],
            description: `Link ${i} is the hash of link ${i - 1}: ${chain[i]}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { seed, length, head, revealed: i, link: chain[i] ?? 0, verified: false },
        };
        step += 1;
    }

    const verified = verifyHashChain(chain, seed, head);
    const tampered = [...chain];
    tampered[1] = (tampered[1] ?? 0) ^ 1;
    const rejected = !verifyHashChain(tampered, seed, head);
    yield {
        stepNumber: step,
        entities: makeBars(chain, chain.length - 1),
        edges: [],
        description: `Published head ${head} verifies from the seed; changing an inner link is rejected. Toy hash, not secure.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { seed, length, head, revealed: length, verified, tamperRejected: rejected },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a hash chain as a trail of breadcrumbs where each crumb is the hash of the one before it. You publish only the final crumb up front. Later, anyone holding an earlier crumb can walk the hashes forward and confirm it leads to the published head, but they cannot walk backward to discover the hidden earlier crumbs.",
        invariants: [
            "Link zero is the seed and every later link is the hash of its predecessor.",
            "The head is the last link and can be published before any other link is revealed.",
            "Hashing a revealed link forward always reaches the head, while inverting the hash is infeasible for a real hash.",
        ],
        correctness:
            "Verification recomputes each hash from the seed and compares it with the stored link, then checks that the last link equals the published head. Any change to a link breaks the very next comparison, so a tampered chain is rejected. An independent FNV-1a reference in the tests recomputes every link and confirms that the honest chain passes while altered chains fail. The toy 32-bit hash is far too small for real security.",
        complexityRationale:
            "Building walks the chain once, evaluating one hash per link, so time is O(length). Verification does the same. Storing every link uses O(length) space, which is required so that any earlier link can be revealed later.",
        uses: [
            "One-time password schemes where each login reveals the next link",
            "Micropayment and coupon systems with a published anchor",
            "Lightweight authentication in constrained environments",
        ],
        references: [
            "Lamport, Password Authentication with Insecure Communication, 1981",
            "Merkle, Secrecy, Authentication and Public Key Systems, 1979",
        ],
        workedExample:
            "Starting from seed 12345, the chain stores 12345, H(12345), H(H(12345)), and so on. Publishing the fifth value as the head lets a verifier accept the third value by hashing it twice and seeing the head. Flipping one bit of the third value produces a different fourth value, so verification fails.",
    },
    id: "hash-chain",
    name: "Hash Chain (Toy Hash)",
    category: "cryptography-security",
    complexity: { time: "O(length)", space: "O(length)" },
    defaultInput: { seed: 12345, length: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a one-way hash function and a secret seed",
        "set the first link to the seed",
        "for each step set the next link to the hash of the current link",
        "publish the final link as the head",
        "to verify hash each revealed link forward to the head",
        "reject the chain if any link or the head disagrees",
        "done: report the head and the verification verdict",
    ],
};

export default module;
