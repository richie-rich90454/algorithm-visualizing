/**
 * causal-broadcast.ts - Causal Broadcast with Vector Clocks (Toy Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Causal broadcast delivers messages in an order that respects cause and
 * effect while allowing independent messages to arrive in any order. Each
 * message carries a vector clock; a receiver delivers it only when the sender's
 * next expected sequence number has arrived and every other component is no
 * larger than the receiver's own clock. Messages that arrive too early wait in
 * a buffer. This is a deterministic delivery-rule simulation, not a networked
 * multicast implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m^2 * p) in the worst case for m messages and p processes
 *   Space: O(m * p) for buffered vector clocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - The grid shows each message's vector clock and the local clock row.
 *   - A delivered message is green, a buffered one is yellow, and one that has
 *     not arrived is gray.
 *   - The local clock, buffer size, and delivery order are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CausalMessage {
    from: number;
    vector: number[];
}

/** Build the vector-clock grid, with one final row for the local clock. */
function makeCells(
    messages: CausalMessage[],
    local: number[],
    visible: number,
    buffer: Set<number>,
    delivered: Set<number>,
): VisualEntity[] {
    const rows = messages.length + 1;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        const vector = i < messages.length ? (messages[i]?.vector ?? []) : local;
        for (let j = 0; j < local.length; j += 1) {
            let state: EntityState = "idle";
            if (i < messages.length) {
                state = delivered.has(i) ? "sorted" : buffer.has(i) ? "comparing" : i < visible ? "active" : "unvisited";
            }
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(vector[j] ?? 0),
                value: vector[j] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** True when a message's causal past is contained in the local clock. */
function deliverable(message: CausalMessage, local: number[]): boolean {
    const sender = message.from;
    if (sender < 0 || sender >= local.length) {
        return false;
    }
    if ((message.vector[sender] ?? 0) !== (local[sender] ?? 0) + 1) {
        return false;
    }
    for (let k = 0; k < local.length; k += 1) {
        if (k !== sender && (message.vector[k] ?? 0) > (local[k] ?? 0)) {
            return false;
        }
    }
    return true;
}

/** The causal broadcast generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { messages?: CausalMessage[]; processes?: number } | null) ?? {};
    const fallback: CausalMessage[] = [
        { from: 2, vector: [0, 1, 1] },
        { from: 1, vector: [0, 1, 0] },
        { from: 2, vector: [0, 1, 2] },
        { from: 1, vector: [0, 2, 1] },
    ];
    const messages = Array.isArray(task.messages) && task.messages.length > 0
        ? task.messages.map((m) => ({ from: m.from, vector: [...m.vector] }))
        : fallback;
    const processes = typeof task.processes === "number" && task.processes >= 1
        ? Math.floor(task.processes)
        : Math.max(...messages.map((m) => m.vector.length), 1);
    const local = new Array<number>(processes).fill(0);
    const buffer = new Set<number>();
    const delivered = new Set<number>();
    const order: number[] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(messages, local, 0, buffer, delivered),
        edges: [],
        description: `A receiver tracks ${processes} process clocks; messages arrive out of order and wait until their causes are delivered.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: messages.length + 1, cols: processes, local: [...local], buffer: [], order: [], delivered: 0 },
    };
    step += 1;

    for (let arrival = 0; arrival < messages.length; arrival += 1) {
        buffer.add(arrival);
        let progressed = true;
        while (progressed) {
            progressed = false;
            for (const index of [...buffer]) {
                const message = messages[index];
                if (message && deliverable(message, local)) {
                    for (let k = 0; k < processes; k += 1) {
                        local[k] = Math.max(local[k] ?? 0, message.vector[k] ?? 0);
                    }
                    buffer.delete(index);
                    delivered.add(index);
                    order.push(index);
                    progressed = true;
                    break;
                }
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(messages, local, arrival + 1, buffer, delivered),
            edges: [],
            description: `Arrival ${arrival + 1}: ${buffer.size} message(s) buffered, ${delivered.size} delivered; local clock ${local.join(", ")}.`,
            codeLineNumber: buffer.size > 0 ? 3 : 5,
            layout: "grid",
            meta: {
                rows: messages.length + 1,
                cols: processes,
                local: [...local],
                buffer: [...buffer],
                order: [...order],
                delivered: delivered.size,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(messages, local, messages.length, buffer, delivered),
        edges: [],
        description: delivered.size === messages.length
            ? `All ${messages.length} messages delivered in causal order: ${order.map((i) => `m${i}`).join(", ")}.`
            : `${messages.length - delivered.size} message(s) remain blocked waiting for missing causes.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: messages.length + 1,
            cols: processes,
            local: [...local],
            buffer: [...buffer],
            order: [...order],
            delivered: delivered.size,
        },
    };
}

/** The causal broadcast module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A vector clock records how much of each process's history a message has seen. The receiver keeps its own vector and holds back any message whose sender sequence is not the next one expected or whose other components reveal unseen causes. Waiting until those causes arrive preserves causality while still letting unrelated messages be delivered as soon as they are ready.",
        invariants: [
            "A delivered message always has the sender's next expected sequence number.",
            "Every other component of a delivered vector is at most the matching local component.",
            "The local clock only ever increases, by taking componentwise maxima.",
        ],
        correctness:
            "If message A causally precedes message B, then B's vector includes at least A's sender sequence on that component. The delivery rule cannot accept B until the local clock has reached that sequence, which requires A to have been delivered first. Therefore the delivered order is a linear extension of the causal order. Messages buffered by the rule are exactly those whose causal past is not yet present.",
        complexityRationale:
            "Each arrival scans the buffer and compares p clock components, so the worst case is O(m^2 * p) for m messages. The grid stores one vector per message and the local clock, O(m * p) space.",
        uses: [
            "Maintaining consistent views in replicated collaborative systems",
            "Distributed chat and event feeds where replies must follow causes",
            "Building blocks for causal consistency in data stores",
        ],
        references: [
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
            "Birman and Joseph, Exploiting Virtual Synchrony in Distributed Systems, 1987",
        ],
        workedExample:
            "With three processes, a message (0,1,1) from process 2 arrives before (0,1,0) from process 1. It is buffered because component 2 is ahead of the local clock. After (0,1,0) is delivered the buffered message becomes deliverable, and the local clock advances to (0,1,1).",
    },
    id: "causal-broadcast",
    name: "Causal Broadcast (Vector Clock Model)",
    category: "parallel-distributed",
    complexity: { time: "O(m^2 * p)", space: "O(m * p)" },
    defaultInput: {
        processes: 3,
        messages: [
            { from: 2, vector: [0, 1, 1] },
            { from: 1, vector: [0, 1, 0] },
            { from: 2, vector: [0, 1, 2] },
            { from: 1, vector: [0, 2, 1] },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the local vector clock to all zeros",
        "place each arriving message in the pending buffer",
        "for each pending message check the sender's next sequence",
        "also check that all other clock components are covered",
        "deliver a ready message and merge its vector into the local clock",
        "repeat scanning the buffer until no message is ready",
        "keep blocked messages until their causes arrive",
        "done: report the delivery order and final local clock",
    ],
};

export default module;
