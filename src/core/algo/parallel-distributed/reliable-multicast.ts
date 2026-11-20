/**
 * reliable-multicast.ts - Reliable Multicast with Negative Acknowledgments
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sender broadcasts a sequence of messages to a receiver group. A receiver
 * that misses a message notices a gap in the sequence, sends a negative
 * acknowledgment (NACK), and the sender retransmits the missing message.
 * Duplicate deliveries are suppressed, so every receiver ends with exactly one
 * copy of every message, in order.
 *
 * This deterministic model records which (receiver, message) pairs are lost in
 * the first broadcast. The exact step shown is the delivery invariant: after
 * gap detection and retransmission, each receiver's delivered set equals the
 * full sequence {1..m}, with no duplicates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m*n) for m messages and n receivers in the loss-free retransmit
 *   Space: O(m*n) for per-receiver delivered sets and the NACK table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The sender and each receiver are nodes; broadcasts are directed edges.
 *   - A delivered message is green, a lost one is red, a NACK is yellow.
 *   - The final frame is green on every receiver once all copies arrived.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface MulticastData {
    receivers: number;
    messages: number;
    missed: number[][];
    delivered: number[][];
    nacks: number[][];
    retransmits: number[][];
    allDelivered: boolean;
}

/** Deterministic reliable-multicast simulation. `missed` holds [receiver, seq] pairs. */
export function simulateMulticast(receivers: number, messages: number, missed: number[][]): MulticastData {
    const n = Math.max(1, Math.floor(receivers));
    const m = Math.max(1, Math.floor(messages));
    const lost = new Set(missed.map(([r, s]) => `${r}:${s}`));
    const delivered = Array.from({ length: n }, () => [] as number[]);
    const nacks = Array.from({ length: n }, () => [] as number[]);
    const retransmits = Array.from({ length: n }, () => [] as number[]);

    for (let seq = 1; seq <= m; seq += 1) {
        for (let r = 0; r < n; r += 1) {
            if (!lost.has(`${r}:${seq}`)) {
                delivered[r]!.push(seq);
            } else {
                nacks[r]!.push(seq);
                retransmits[r]!.push(seq);
                delivered[r]!.push(seq);
            }
        }
    }
    const allDelivered = delivered.every((set) =>
        Array.from({ length: m }, (_, i) => i + 1).every((seq) => set.filter((x) => x === seq).length === 1),
    );
    return { receivers: n, messages: m, missed, delivered, nacks, retransmits, allDelivered };
}

/** Build sender + receiver nodes with the given states. */
function makeNodes(states: EntityState[]): VisualEntity[] {
    const nodes: VisualEntity[] = [
        {
            id: "sender",
            type: "node",
            label: "S",
            value: "sender",
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "sender" },
        },
    ];
    states.forEach((state, index) => {
        nodes.push({
            id: `receiver-${index}`,
            type: "node",
            label: `R${index}`,
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "receiver", index },
        });
    });
    return nodes;
}

/** Directed edges from the sender to every receiver for the current phase. */
function makeEdges(data: MulticastData, seq: number, phase: "broadcast" | "nack" | "repair" | "done"): VisualEdge[] {
    const lost = new Set(data.missed.map(([r, s]) => `${r}:${s}`));
    return Array.from({ length: data.receivers }, (_, r) => {
        let state: EntityState = "idle";
        let label = "idle";
        if (phase === "broadcast") {
            state = lost.has(`${r}:${seq}`) ? "error" : "sorted";
            label = lost.has(`${r}:${seq}`) ? "lost" : "ok";
        } else if (phase === "nack") {
            state = data.nacks[r]!.includes(seq) ? "comparing" : "idle";
            label = data.nacks[r]!.includes(seq) ? "NACK" : "-";
        } else if (phase === "repair") {
            state = data.retransmits[r]!.includes(seq) ? "active" : "idle";
            label = data.retransmits[r]!.includes(seq) ? "retry" : "-";
        } else {
            state = "sorted";
            label = "done";
        }
        return {
            id: `msg-${seq}-${r}`,
            sourceId: "sender",
            targetId: `receiver-${r}`,
            label,
            state,
            directed: true,
        };
    });
}

/** The reliable multicast generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { receivers?: number; messages?: number; missed?: number[][] } | null) ?? {};
    const receivers = typeof task.receivers === "number" ? Math.max(1, Math.floor(task.receivers)) : 4;
    const messages = typeof task.messages === "number" ? Math.max(1, Math.floor(task.messages)) : 2;
    const missed = Array.isArray(task.missed) ? task.missed : [[1, 1], [3, 2]];
    const data = simulateMulticast(receivers, messages, missed);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeNodes(Array<EntityState>(receivers).fill("idle")),
        edges: makeEdges(data, 1, "broadcast"),
        description: `Reliable multicast: ${messages} message(s) to ${receivers} receiver(s), with ${missed.length} recorded loss(es).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { receivers, messages, phase: "setup", delivered: data.delivered.map((set) => set.join(",")), allDelivered: false },
    };

    for (let seq = 1; seq <= messages; seq += 1) {
        const lostThis = new Set(data.missed.filter(([, s]) => s === seq).map(([r]) => r));
        const afterBroadcast = Array.from({ length: receivers }, (_, r) =>
            lostThis.has(r) ? "error" as const : "sorted" as const,
        );
        yield {
            stepNumber: step++,
            entities: makeNodes(afterBroadcast),
            edges: makeEdges(data, seq, "broadcast"),
            description: `Broadcast seq ${seq}: ${lostThis.size} receiver(s) missed it and detected a gap.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { receivers, messages, phase: "broadcast", seq, delivered: data.delivered.map((set) => set.join(",")), allDelivered: false },
        };
        yield {
            stepNumber: step++,
            entities: makeNodes(afterBroadcast.map((s) => (s === "error" ? "comparing" as const : s))),
            edges: makeEdges(data, seq, "nack"),
            description: `Gap detection: ${lostThis.size} receiver(s) send a NACK for seq ${seq}.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: { receivers, messages, phase: "nack", seq, delivered: data.delivered.map((set) => set.join(",")), allDelivered: false },
        };
        yield {
            stepNumber: step++,
            entities: makeNodes(Array<EntityState>(receivers).fill("sorted")),
            edges: makeEdges(data, seq, "repair"),
            description: `Retransmit seq ${seq} to the NACKing receivers; duplicates are suppressed.`,
            codeLineNumber: 5,
            layout: "graph",
            meta: { receivers, messages, phase: "repair", seq, delivered: data.delivered.map((set) => set.join(",")), allDelivered: false },
        };
    }

    yield {
        stepNumber: step,
        entities: makeNodes(Array<EntityState>(receivers).fill("sorted")),
        edges: makeEdges(data, messages, "done"),
        description: `Delivery complete: every receiver holds exactly one copy of all ${messages} message(s).`,
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            receivers,
            messages,
            phase: "done",
            delivered: data.delivered.map((set) => set.join(",")),
            allDelivered: data.allDelivered,
        },
    };
}

/** The reliable multicast module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of acknowledging every message from every receiver, let a receiver speak up only when it notices a hole in the sequence. The sender then repairs just the missing message. Because each copy is identified by its sequence number, a repair that arrives late can be recognized as a duplicate and ignored.",
        invariants: [
            "A receiver sends a NACK only for a sequence number it has not delivered.",
            "Retransmission delivers a missing message exactly once per receiver.",
            "After all repairs each receiver's delivered set is the full sequence with no repeats.",
        ],
        correctness:
            "For each message and receiver there are two cases. If the first broadcast succeeded, the message is delivered once and never NACKed. If it was lost, the gap is detected, a NACK is emitted, and the retransmission delivers it once; any further copy is discarded as a duplicate because the sequence number is already present. By induction over the sequence, every receiver's delivered set equals {1..m}, so the multicast is reliable and ordered.",
        complexityRationale:
            "One broadcast contacts n receivers, and each of the m messages may trigger at most n NACKs and n repairs, giving O(m*n) work in the worst case. The sender keeps a NACK table and each receiver keeps its delivered set, O(m*n) space in total.",
        uses: [
            "Reliable group delivery in distributed systems",
            "Multicast transport protocols such as PGM",
            "Replicating state updates to a set of followers",
        ],
        references: [
            "Birman, Reliable Distributed Systems, Chapter 4",
            "Paul, Sabater, and Wildi, Reliable Multicast Transport Building Blocks, RFC 3940",
        ],
        workedExample:
            "With four receivers and messages 1 and 2, suppose receiver 1 misses message 1 and receiver 3 misses message 2. After the broadcasts each detects a gap, sends a NACK, and receives one retransmission. Every receiver ends with delivered sets {1, 2} and no duplicates.",
    },
    id: "reliable-multicast",
    name: "Reliable Multicast",
    category: "parallel-distributed",
    complexity: { time: "O(m*n)", space: "O(m*n)" },
    defaultInput: { receivers: 4, messages: 2, missed: [[1, 1], [3, 2]] },
    visualType: "graph",
    run,
    pseudocode: [
        "label each message with a sequence number",
        "broadcast message seq to every receiver",
        "each receiver records seq when it arrives",
        "if a sequence gap is seen, send a NACK for seq",
        "on a NACK retransmit seq to that receiver",
        "discard any duplicate sequence number on arrival",
        "continue until all sequence numbers are delivered",
        "done: every receiver holds each message exactly once",
    ],
};

export default module;
