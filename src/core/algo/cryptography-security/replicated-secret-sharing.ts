/**
 * replicated-secret-sharing.ts - Three-Party Replicated Secret Sharing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In three-party replicated secret sharing with threshold two, a secret s is
 * split into three random values a, b, and c whose xor is s. Party one holds
 * (a, b), party two holds (b, c), and party three holds (c, a). Any two parties
 * together possess all three values and can reconstruct the secret, while any
 * single party holds only two random values and learns nothing about s.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) to split and O(1) per reconstruction (a fixed three-party deal)
 *   Space: O(1) for the shares and pairwise results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the three random values, the three party shares, and the
 *     three pairwise reconstructions.
 *   - A successful reconstruction is GREEN, the secret cell is CYAN.
 *   - meta carries a, b, c, the shares, and every pairwise result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SharingInput {
    secret?: number;
    a?: number;
    b?: number;
}

interface CellSpec {
    label: string;
    value: number;
    state: EntityState;
}

function makeCells(specs: CellSpec[]): VisualEntity[] {
    return specs.map((spec, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: spec.label,
        value: spec.value,
        state: spec.state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, value: spec.value },
    }));
}

function specs(
    secret: number,
    a: number,
    b: number,
    c: number,
    stage: number,
): CellSpec[] {
    const base: CellSpec[] = [
        { label: `secret ${secret}`, value: secret, state: "active" },
        { label: `a ${a}`, value: a, state: stage >= 1 ? "sorted" : "idle" },
        { label: `b ${b}`, value: b, state: stage >= 1 ? "sorted" : "idle" },
        { label: `c ${c}`, value: c, state: stage >= 1 ? "sorted" : "idle" },
    ];
    if (stage >= 2) {
        base.push({ label: `P1 (a,b)`, value: a ^ b, state: "visited" });
        base.push({ label: `P2 (b,c)`, value: b ^ c, state: "visited" });
        base.push({ label: `P3 (c,a)`, value: c ^ a, state: "visited" });
    }
    if (stage >= 3) {
        base.push({ label: `P1+P2 ${secret}`, value: secret, state: "sorted" });
        base.push({ label: `P2+P3 ${secret}`, value: secret, state: "sorted" });
        base.push({ label: `P3+P1 ${secret}`, value: secret, state: "sorted" });
    }
    return base;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SharingInput | null) ?? {};
    const secret = Math.floor(Number(task.secret)) & 0xff;
    const a = Math.floor(Number(task.a)) & 0xff || 0x53;
    const b = Math.floor(Number(task.b)) & 0xff || 0x2c;
    const c = secret ^ a ^ b;

    yield {
        stepNumber: 0,
        entities: makeCells(specs(secret, a, b, c, 0)),
        edges: [],
        description: `Replicated sharing of secret ${secret} with threshold two; choose random a ${a} and b ${b}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { secret, a, b, c, rows: 1, cols: 4, stage: "setup" },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(specs(secret, a, b, c, 1)),
        edges: [],
        description: `Set c so that a xor b xor c equals the secret; c is ${c}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { secret, a, b, c, rows: 1, cols: 4, stage: "split" },
    };

    yield {
        stepNumber: 2,
        entities: makeCells(specs(secret, a, b, c, 2)),
        edges: [],
        description: "Deal the pairs (a,b), (b,c), and (c,a) to parties one, two, and three.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { secret, a, b, c, rows: 1, cols: 7, stage: "deal" },
    };

    const recon12 = a ^ b ^ c;
    const recon23 = b ^ c ^ a;
    const recon31 = c ^ a ^ b;
    yield {
        stepNumber: 3,
        entities: makeCells(specs(secret, a, b, c, 3)),
        edges: [],
        description: `Any two parties recover all three values and xor them; results are ${recon12}, ${recon23}, and ${recon31}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            secret,
            a,
            b,
            c,
            rows: 1,
            cols: 10,
            stage: "reconstruct",
            reconstructions: [recon12, recon23, recon31],
        },
    };

    const ok = recon12 === secret && recon23 === secret && recon31 === secret;
    yield {
        stepNumber: 4,
        entities: makeCells(specs(secret, a, b, c, 3)),
        edges: [],
        description: `All pairwise sets reconstruct ${secret}: ${ok ? "verified" : "verification failed"}. A single party sees only two random values.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            secret,
            a,
            b,
            c,
            rows: 1,
            cols: 10,
            reconstructions: [recon12, recon23, recon31],
            verified: ok,
            singlePartyXor: [a ^ b, b ^ c, c ^ a],
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide a secret by splitting it into three random pieces that cancel when xored. Give each of three parties two of the pieces, arranged so that any pair of parties together holds all three. One party by itself sees only random values, but two cooperating parties can recover the secret immediately. This is the workhorse behind many fast secure-computation protocols.",
        invariants: [
            "The three random values satisfy a xor b xor c equals the secret.",
            "Each party holds exactly two of the three values.",
            "Any two parties together hold all three values and reconstruct the secret.",
        ],
        correctness:
            "Setting c to secret xor a xor b makes the xor of all three values equal the secret by construction. Party one holds a and b, party two holds b and c, and party three holds c and a, so every pair covers all three values. Xoring the three distinct values held by any pair gives the secret directly. The companion test checks this identity over many random secrets and random pairs, verifies that a single party's xor generally differs from the secret, and checks every frame's shape and termination.",
        complexityRationale:
            "Splitting needs two random values and one xor, and each reconstruction is a fixed number of xors, so both are constant time. Only a constant number of shares and results are stored, giving constant space.",
        uses: [
            "Three-party secure multiparty computation",
            "Privacy-preserving aggregation where no single server sees raw data",
            "A teaching model for threshold access structures",
        ],
        references: [
            "Bogdanov, Niitsoo, Toft, and Willemson, High-Performance Secure Multi-Party Computation, 2012",
            "Shamir, How to Share a Secret, 1979",
        ],
        workedExample:
            "To share secret 10 choose a 83 and b 44; then c is 10 xor 83 xor 44. Party one holds (a, b), party two (b, c), and party three (c, a). Parties one and two combine a, b, and c: b appears twice and cancels, so the xor is 10.",
    },
    id: "replicated-secret-sharing",
    name: "Replicated Secret Sharing",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { secret: 10, a: 83, b: 44 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose two random values a and b",
        "set c so that a xor b xor c equals the secret",
        "give party one the pair (a, b)",
        "give party two the pair (b, c)",
        "give party three the pair (c, a)",
        "any two parties combine their pairs to recover a, b, and c",
        "xor the three values to reconstruct the secret",
        "done: report all pairwise reconstructions",
    ],
};

export default module;
