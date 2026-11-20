/**
 * pervasive-corruption-detection.ts - Pervasive Corruption Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pervasive corruption detection protects a chain of untrusted components by
 * making every component keep a hash of the data it processed and a witness of
 * the hash it received from its predecessor. A verifier walks the chain, checks
 * each component's witness against the predecessor's reported hash, and
 * recomputes the component's hash from its data. A mismatch identifies the
 * component that lied or was damaged without condemning its honest successors,
 * because each later component records exactly the hash it was given.
 *
 * This is a deterministic teaching simulation over a fixed chain of records.
 * It uses a small noncryptographic 32-bit hash for display, so it demonstrates
 * the detection structure rather than providing cryptographic security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * dataLength) to build and verify the n chain records
 *   Space: O(n) for the recorded hashes and witnesses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each node's data value; a flagged node is marked red.
 *   - The node currently being verified is yellow.
 *   - meta carries computed hashes, reported hashes, witnesses, and flags.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PcdInput {
    nodes?: number;
    corrupted?: number[];
    values?: number[];
}

/** A small deterministic FNV-style string hash used only for teaching. */
function hash(text: string): number {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        value ^= text.charCodeAt(index);
        value = Math.imul(value, 16777619) >>> 0;
    }
    return value >>> 0;
}

function makeBars(values: number[], flags: boolean[], active: number): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = flags[index] ? "error" : index === active ? "active" : "sorted";
        return {
            id: `node-${index}`,
            type: "bar" as const,
            label: `${value}${flags[index] ? "!" : ""}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, node: index, value, flagged: Boolean(flags[index]) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PcdInput | null) ?? {};
    const n = Math.min(16, Math.max(2, Math.floor(Number(task.nodes ?? 6)) || 6));
    const values: number[] = Array.isArray(task.values) && task.values.length === n
        ? task.values.map((value) => Number(value) || 0)
        : Array.from({ length: n }, (_, index) => index + 1);
    const corrupted = new Set<number>(
        Array.isArray(task.corrupted)
            ? task.corrupted.map((index) => ((Math.floor(Number(index)) % n) + n) % n)
            : [Math.min(2, n - 1)],
    );

    const computed: number[] = [];
    const reported: number[] = [];
    const witnesses: number[] = [];
    const genesis = hash("genesis");
    for (let index = 0; index < n; index += 1) {
        const witness = index === 0 ? genesis : (reported[index - 1] ?? 0);
        const expected = hash(`${witness}:${values[index] ?? 0}`);
        computed.push(expected);
        witnesses.push(witness);
        reported.push(corrupted.has(index) ? hash(`${witness}:tampered`) : expected);
    }

    const flags: boolean[] = Array.from({ length: n }, () => false);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, flags, -1),
        edges: [],
        description: `Recording ${n} chain nodes with hash witnesses; ${corrupted.size} node(s) are tampered with.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, values, computed, reported, witnesses, flags: [...flags], corrupted: [...corrupted], detected: 0, done: false },
    };
    step += 1;

    for (let index = 0; index < n; index += 1) {
        const witnessMatches = index === 0
            ? (witnesses[index] ?? 0) === genesis
            : (witnesses[index] ?? 0) === (reported[index - 1] ?? 0);
        const recomputed = hash(`${witnesses[index] ?? 0}:${values[index] ?? 0}`);
        const hashMatches = recomputed === (reported[index] ?? 0);
        if (!witnessMatches || !hashMatches) {
            flags[index] = true;
        }
        yield {
            stepNumber: step,
            entities: makeBars(values, flags, index),
            edges: [],
            description: `Node ${index}: witness ${witnessMatches ? "matches" : "mismatches"} predecessor, hash ${hashMatches ? "matches" : "mismatches"} recomputation${flags[index] ? " - flagged" : ""}.`,
            codeLineNumber: witnessMatches ? (hashMatches ? 3 : 4) : 2,
            layout: "array",
            meta: { n, values, computed, reported, witnesses, flags: [...flags], corrupted: [...corrupted], detected: flags.filter(Boolean).length, done: false, node: index },
        };
        step += 1;
    }

    const detected = flags.flatMap((flag, index) => (flag ? [index] : []));
    yield {
        stepNumber: step,
        entities: makeBars(values, flags, -1),
        edges: [],
        description: `Verification flagged ${detected.length} node(s): ${detected.length > 0 ? detected.join(", ") : "none"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, values, computed, reported, witnesses, flags, detected, corrupted: [...corrupted], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each component in a chain writes down two things: the fingerprint it received and the fingerprint of what it produced. A verifier can then re-derive every fingerprint from the recorded input data. If a component changed its data, its fingerprint will not match the recomputation, but its honest neighbors still recorded exactly what they saw, so the blame lands on the right component instead of spreading.",
        invariants: [
            "An honest node's reported hash equals the hash of its witness and its data.",
            "A node's witness equals the reported hash of its predecessor.",
            "The first node's witness is the fixed genesis value.",
        ],
        correctness:
            "By induction, honest nodes produce reported hashes that agree with recomputation from their recorded witnesses. A tampered node stores a reported hash that differs from the hash of its true data and witness, so its own hash check fails and it is flagged. Its successor stores the tampered reported hash as its witness, which matches the predecessor's reported value and is used consistently, so the successor passes both checks. Therefore exactly the tampered nodes are flagged and honest successors are not condemned.",
        complexityRationale:
            "Building the chain hashes each node's data once, and verification recomputes one hash per node and compares two values, so the run is O(n times data length) time. The computed hashes, reported hashes, and witnesses occupy O(n) space.",
        uses: [
            "Auditing a chain of untrusted transformations in a data pipeline",
            "Locating a faulty or compromised component in a computation graph",
            "A teaching model for tamper-evident logs and chain validators",
        ],
        references: [
            "Micali, Pervasive Corruption Detection, 2017",
            "Merkle, A Digital Signature Based on a Conventional Encryption Function, 1987",
        ],
        workedExample:
            "Six nodes store values one through six. If node two is tampered with, it reports the hash of a changed value while its witness remains node one's hash. Verification recomputes node two's hash from its true value, finds a mismatch, and flags only node two; nodes three through six each recorded node two's reported hash as their witness and still verify correctly.",
    },
    id: "pervasive-corruption-detection",
    name: "Pervasive Corruption Detection",
    category: "parallel-distributed",
    complexity: { time: "O(n * dataLength)", space: "O(n)" },
    defaultInput: {
        nodes: 6,
        corrupted: [2],
    },
    visualType: "array",
    run,
    pseudocode: [
        "define the genesis hash for the first node",
        "for each node record the predecessor hash as its witness",
        "compute the node hash from witness and data, then report it",
        "start verification at the first node",
        "check the witness against the predecessor's reported hash",
        "recompute the node hash and flag any mismatch",
        "advance to the next node and repeat",
        "done: report exactly the flagged nodes",
    ],
};

export default module;
