/**
 * total-order-broadcast.ts - Total-Order Broadcast (Teaching Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Total-order broadcast delivers every message to every replica in exactly
 * the same order, no matter the order in which messages arrive at each replica.
 * A sequencer assigns each message a unique increasing sequence number and
 * replicas deliver in sequence order once preceding messages are known.
 *
 * This teaching simulation feeds each replica a different arrival permutation
 * and shows that ordering by sequence number yields one identical delivery
 * order on all replicas. It does not implement real consensus, flow control,
 * or fault tolerance, so it is not a production total-order broadcast.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r * m log m) to sort m messages at r replicas
 *   Space: O(r * m) for the per-replica arrival buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row of cells shows messages in their delivery order.
 *   - Delivered cells are green; pending cells are gray.
 *   - meta carries the shared delivery sequence and arrival orders.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Message {
    id: string;
    seq: number;
}

/** Deterministic small PRNG for arrival shuffles. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Return a seeded shuffle of the message indices. */
function shuffledOrder(count: number, seed: number): number[] {
    const order = Array.from({ length: count }, (_, i) => i);
    const random = rng(seed);
    for (let i = count - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        const a = order[i] ?? 0;
        const b = order[j] ?? 0;
        order[i] = b;
        order[j] = a;
    }
    return order;
}

/** Build the message cells in delivery order. */
function makeCells(messages: Message[], delivered: number): VisualEntity[] {
    return messages.map((message, index) => ({
        id: `message-${index}`,
        type: "cell" as const,
        label: message.id,
        value: message.seq,
        state: (index < delivered ? "sorted" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, seq: message.seq },
    }));
}

/** The total-order broadcast generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { messages?: Message[]; replicas?: number; seed?: number } | null
    ) ?? {};
    const rawMessages = Array.isArray(task.messages) ? task.messages : [];
    const messages: Message[] =
        rawMessages.length > 0
            ? rawMessages.map((m, i) => ({ id: String(m?.id ?? `m${i}`), seq: Number(m?.seq ?? i) }))
            : [
                  { id: "m1", seq: 3 },
                  { id: "m2", seq: 1 },
                  { id: "m3", seq: 5 },
                  { id: "m4", seq: 2 },
                  { id: "m5", seq: 4 },
              ];
    const replicas = Math.max(1, Math.floor(Number(task.replicas ?? 3)) || 3);
    const seed = Math.floor(Number(task.seed ?? 1)) || 1;

    const ordered = [...messages].sort((x, y) => x.seq - y.seq);
    const arrivals: number[][] = [];
    for (let r = 0; r < replicas; r += 1) {
        arrivals.push(shuffledOrder(messages.length, seed + r * 7919));
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(ordered, 0),
        edges: [],
        description: `${replicas} replicas each receive ${messages.length} message(s) in a different arrival order; delivery will follow sequence number.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: messages.length,
            replicas,
            delivered: 0,
            deliveryOrder: [],
            arrivalOrders: arrivals.flat(),
            arrivalRows: replicas,
            arrivalCols: messages.length,
        },
    };
    step += 1;

    const deliveryIds: string[] = [];
    for (let i = 0; i < ordered.length; i += 1) {
        const message = ordered[i];
        if (!message) {
            continue;
        }
        deliveryIds.push(message.id);
        yield {
            stepNumber: step,
            entities: makeCells(ordered, i + 1),
            edges: [],
            description: `Deliver sequence ${message.seq} (message ${message.id}) next on every replica, regardless of its arrival position.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: messages.length,
                replicas,
                delivered: i + 1,
                deliveryOrder: [...deliveryIds],
                arrivalOrders: arrivals.flat(),
                arrivalRows: replicas,
                arrivalCols: messages.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(ordered, ordered.length),
        edges: [],
        description: `All ${replicas} replicas delivered the same sequence: ${deliveryIds.join(", ")}. This simulation omits consensus and failures.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: messages.length,
            replicas,
            delivered: ordered.length,
            deliveryOrder: [...deliveryIds],
            arrivalOrders: arrivals.flat(),
            arrivalRows: replicas,
            arrivalCols: messages.length,
            note: "teaching simulation, not production total-order broadcast",
        },
    };
}

/** The total-order broadcast teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine several mailboxes that receive the same letters in different orders. If every letter carries a sequence number and readers always take the lowest undelivered number first, every mailbox produces the identical reading order. Total-order broadcast gives replicas that same guarantee for messages.",
        invariants: [
            "Every message has a unique sequence number.",
            "Each replica delivers messages in strictly increasing sequence order.",
            "The delivery order is identical on every replica.",
        ],
        correctness:
            "Sorting by unique sequence numbers produces one canonical order independent of arrival order. Because every replica applies the same sort, the k-th delivered message is the same on all replicas. If a replica is missing an earlier message it simply waits, so no replica can deliver a later message out of turn.",
        complexityRationale:
            "Sorting m messages at each of r replicas costs O(r * m log m) time, and storing the arrival buffers uses O(r * m) space. The visualization displays a single shared delivery order once sorting is done.",
        uses: [
            "A teaching model for state-machine replication",
            "Explaining sequencer-based total-order broadcast",
            "Understanding why replicated logs need a single order",
        ],
        references: [
            "Schneider, Implementing Fault-Tolerant Services Using the State Machine Approach, 1990",
            "Defago, Guerraoui, and Urban, Total Order Broadcast and Multicast Algorithms, 2004",
        ],
        workedExample:
            "Messages m1 through m5 carry sequence numbers 3, 1, 5, 2, 4. Even when three replicas receive them in different shuffled orders, each delivers 1, 2, 3, 4, 5, which corresponds to m2, m4, m1, m5, m3 on every replica.",
    },
    id: "total-order-broadcast",
    name: "Total-Order Broadcast (Teaching Simulation)",
    category: "parallel-distributed",
    complexity: { time: "O(r * m log m)", space: "O(r * m)" },
    defaultInput: {
        messages: [
            { id: "m1", seq: 3 },
            { id: "m2", seq: 1 },
            { id: "m3", seq: 5 },
            { id: "m4", seq: 2 },
            { id: "m5", seq: 4 },
        ],
        replicas: 3,
        seed: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "assign each message a unique sequence number",
        "let every replica buffer its own arrival order",
        "at each replica select the lowest undelivered sequence",
        "deliver that message once all earlier ones are delivered",
        "repeat until every message is delivered",
        "done: all replicas share one identical delivery order",
    ],
};

export default module;
