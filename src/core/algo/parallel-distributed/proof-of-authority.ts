/**
 * proof-of-authority.ts - Proof of Authority (Scheduled Signer Rotation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proof of Authority replaces energy or stake with identity. A fixed set of
 * approved authorities takes turns signing blocks in a round-robin schedule.
 * A block is valid only when its signer matches the authority scheduled for
 * that slot. Because block producers are known, the chain has fast, final
 * blocks and no mining competition, at the cost of trusting the authority set.
 *
 * This deterministic teaching simulation validates a list of slot signers
 * against the scheduled rotation and reports the accepted block slots.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S) checks for S slots
 *   Space: O(S) for the accepted block list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per slot shows the signer who produced the block.
 *   - Correctly signed slots are green; wrong signer slots are red.
 *   - The final frame lists the accepted slot numbers.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface PoAData {
    slots: number;
    authorities: string[];
    signers: string[];
    scheduled: string[];
    valid: boolean[];
    accepted: number[];
}

/** Deterministic Proof-of-Authority signer validation. */
export function simulateProofOfAuthority(authorities: string[], signers: string[]): PoAData {
    const set = authorities.length > 0 ? [...authorities] : ["A", "B", "C"];
    const scheduled = signers.map((_, i) => set[i % set.length] ?? set[0] ?? "A");
    const valid = signers.map((signer, i) => signer === scheduled[i]);
    const accepted = valid.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
    return { slots: signers.length, authorities: set, signers: [...signers], scheduled, valid, accepted };
}

/** Grid cells, one per slot. */
function makeCells(data: PoAData, states: EntityState[]): VisualEntity[] {
    return data.signers.map((signer, index) => ({
        id: `slot-${index}`,
        type: "cell" as const,
        label: `${signer}/${data.scheduled[index]}`,
        value: signer,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, signer, scheduled: data.scheduled[index] ?? "", row: Math.floor(index / 6), col: index % 6 },
    }));
}

/** The Proof of Authority generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { authorities?: string[]; signers?: string[] } | null) ?? {};
    const authorities = Array.isArray(task.authorities) ? task.authorities : ["A", "B", "C"];
    const signers = Array.isArray(task.signers) && task.signers.length > 0
        ? [...task.signers]
        : ["A", "B", "C", "A", "B", "A"];
    const data = simulateProofOfAuthority(authorities, signers);

    yield {
        stepNumber: 0,
        entities: makeCells(data, Array<EntityState>(data.slots).fill("idle")),
        edges: [],
        description: `Proof of Authority with authorities [${data.authorities.join(", ")}] rotating across ${data.slots} block slots.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { slots: data.slots, accepted: 0, phase: "setup" },
    };

    const validating: EntityState[] = data.valid.map((ok) => (ok ? "comparing" : "error"));
    yield {
        stepNumber: 1,
        entities: makeCells(data, validating),
        edges: [],
        description: `Signature check: ${data.valid.filter(Boolean).length} of ${data.slots} block(s) were signed by their scheduled authority.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { slots: data.slots, accepted: 0, phase: "validate", validFlags: data.valid.map((v) => (v ? 1 : 0)) },
    };

    const finalStates: EntityState[] = data.valid.map((ok) => (ok ? "sorted" : "error"));
    yield {
        stepNumber: 2,
        entities: makeCells(data, finalStates),
        edges: [],
        description: `Accepted slots [${data.accepted.join(", ")}] form the canonical chain; mis-signed slots are discarded.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { slots: data.slots, accepted: data.accepted.length, acceptedSlots: data.accepted, phase: "done" },
    };
}

/** The Proof of Authority module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of spending energy or staking coins, let a known set of approved validators sign blocks in a fixed rotation. Everyone knows who should sign the next block, so verification is a simple signature check and blocks can be final almost immediately. The trade-off is that participants must trust the authority set to stay honest.",
        invariants: [
            "Authority i is scheduled for every slot whose index is i modulo the authority count.",
            "A block is valid only if its signer equals the scheduled authority.",
            "Mis-signed slots never enter the canonical chain.",
        ],
        correctness:
            "The schedule is deterministic and public, so every node computes the same expected signer for a slot. Checking a signature against that signer either accepts or rejects the block identically everywhere. Since valid blocks follow the fixed rotation, no two different valid blocks can occupy the same slot, which gives a single canonical chain under an honest authority majority.",
        complexityRationale:
            "Validating S slots requires one signature check each, O(S) time, and the accepted list stores at most S slots, O(S) space. The authority rotation itself is computed with a single modulo per slot.",
        uses: [
            "Private and consortium chains with known, vetted validators",
            "Test networks and sidechains that need instant, cheap blocks",
            "Teaching the trust and performance trade-off versus proof of work",
        ],
        references: [
            "Wood, Ethereum Private Chain Proof of Authority, 2017",
            "Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System, 2008",
        ],
        workedExample:
            "Authorities A, B, C rotate over slots 0 through 5, expecting A, B, C, A, B, C. If clients submit A, B, C, A, B, A, only the last slot is mis-signed because A appeared where C was expected. Slots 0 through 4 are accepted and slot 5 is discarded.",
    },
    id: "proof-of-authority",
    name: "Proof of Authority",
    category: "parallel-distributed",
    complexity: { time: "O(S)", space: "O(S)" },
    defaultInput: { authorities: ["A", "B", "C"], signers: ["A", "B", "C", "A", "B", "A"] },
    visualType: "grid",
    run,
    pseudocode: [
        "list the approved authorities in rotation order",
        "assign authority i mod k to block slot i",
        "for each slot receive a signed block",
        "compare the signer with the scheduled authority",
        "accept the block when they match",
        "discard the block when they differ",
        "append accepted blocks to the canonical chain",
        "done: report the accepted slots",
    ],
};

export default module;
