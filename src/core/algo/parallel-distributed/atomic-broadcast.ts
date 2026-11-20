/**
 * atomic-broadcast.ts - Atomic (Total-Order) Broadcast (toy simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Atomic broadcast delivers every message to every process in the same total
 * order. This simulation assigns each message a deterministic total-order key
 * from its sender and local sequence number, then delivers messages in that
 * key order to all processes at once, modeling a sequencer-based protocol.
 *
 * This is a deterministic simulation of the ordering guarantee, not a
 * production fault-tolerant broadcast layer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m log m + m * processes) for m messages
 *   Space: O(m + processes) for the message order and delivery logs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0 holds message cells in issue order; row 1 holds process cells.
 *   - A message turns green when it has been delivered in total order.
 *   - The metadata lists the canonical total order and delivery count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Message {
    sender: number;
    localSeq: number;
    content: string;
}

/** Sort key: local sequence number first, then sender id to break ties. */
function orderKey(message: Message): [number, number] {
    return [message.localSeq, message.sender];
}

/** Build the message and process cells. */
function makeCells(
    messages: Message[],
    processes: number,
    delivered: Set<number>,
    activeMessage: number,
): VisualEntity[] {
    const messageCells = messages.map((message, index) => ({
        id: `message-${index}`,
        type: "cell" as const,
        label: message.content,
        value: message.content,
        state:
            index === activeMessage
                ? ("active" as EntityState)
                : delivered.has(index)
                  ? ("sorted" as EntityState)
                  : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, sender: message.sender, localSeq: message.localSeq },
    }));
    const processCells = Array.from({ length: processes }, (_, index) => ({
        id: `process-${index}`,
        type: "cell" as const,
        label: `P${index}`,
        value: index,
        state: "visited" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 1, col: index, processId: index },
    }));
    return [...messageCells, ...processCells];
}

/** The atomic broadcast generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { messages?: Message[]; processes?: number } | null) ?? {};
    const messages: Message[] =
        Array.isArray(task.messages) && task.messages.length > 0
            ? task.messages
                  .filter(
                      (item): item is Message =>
                          !!item &&
                          typeof item.sender === "number" &&
                          typeof item.localSeq === "number",
                  )
                  .map((item) => ({
                      sender: item.sender,
                      localSeq: item.localSeq,
                      content: String(item.content),
                  }))
            : [
                  { sender: 1, localSeq: 0, content: "a" },
                  { sender: 0, localSeq: 0, content: "b" },
                  { sender: 2, localSeq: 0, content: "c" },
                  { sender: 1, localSeq: 1, content: "d" },
              ];
    const processes =
        typeof task.processes === "number" && task.processes >= 1
            ? Math.floor(task.processes)
            : 3;

    const indexed = messages.map((message, index) => ({ message, index }));
    indexed.sort((left, right) => {
        const [lSeq, lSender] = orderKey(left.message);
        const [rSeq, rSender] = orderKey(right.message);
        return lSeq - rSeq || lSender - rSender;
    });
    const totalOrder = indexed.map((entry) => entry.index);
    const delivered = new Set<number>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(messages, processes, delivered, -1),
        edges: [],
        description: `Starting atomic broadcast of ${messages.length} message(s) to ${processes} process(es).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(messages.length, processes), delivered: 0, total: messages.length, order: totalOrder },
    };
    step += 1;

    for (let position = 0; position < totalOrder.length; position += 1) {
        const index = totalOrder[position]!;
        delivered.add(index);
        const message = messages[index]!;
        yield {
            stepNumber: step,
            entities: makeCells(messages, processes, delivered, index),
            edges: [],
            description: `Deliver message "${message.content}" from sender ${message.sender} (local ${message.localSeq}) to every process in the same order.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols: Math.max(messages.length, processes), delivered: position + 1, total: messages.length, order: totalOrder },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(messages, processes, delivered, -1),
        edges: [],
        description: `All ${messages.length} message(s) delivered to all ${processes} process(es) in one identical total order.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(messages.length, processes), delivered: messages.length, total: messages.length, order: totalOrder },
    };
}

/** The atomic broadcast module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Every replica must see the same messages in the same sequence, otherwise two databases could apply conflicting updates. Atomic broadcast gives each message a slot in a single global order and then delivers every slot to every process, so all replicas stay in lockstep.",
        invariants: [
            "Every message is delivered to every process exactly once.",
            "All processes observe the identical total order.",
            "A message is delivered only after a global order position is assigned to it.",
        ],
        correctness:
            "Each message receives a unique total-order key (local sequence number, then sender id), so the sorted list is a permutation of all messages with no duplicates. Delivery iterates that one list and sends each entry to every process, so every process builds the same delivery log and no process can see a different order.",
        complexityRationale:
            "Sorting m messages costs O(m log m), and delivering each to p processes costs O(m * p) time and O(m + p) space for the order and per-process logs.",
        uses: [
            "State-machine replication in distributed databases",
            "Replicating a ledger or event log across nodes",
            "Coordinating updates in a fault-tolerant key-value store",
        ],
        references: [
            "Cassandra and the ZooKeeper Atomic Broadcast protocol overview",
            "Schneider, Implementing Fault-Tolerant Services Using the State Machine Approach, 1990",
        ],
        workedExample:
            "Messages a (sender 1, local 0), b (sender 0, local 0), c (sender 2, local 0), and d (sender 1, local 1) sort by (local, sender) to b, a, c, d. Every process delivers b, a, c, d, so their logs are identical.",
    },
    id: "atomic-broadcast",
    name: "Atomic Broadcast",
    category: "parallel-distributed",
    complexity: { time: "O(m log m + m * processes)", space: "O(m + processes)" },
    defaultInput: {
        processes: 3,
        messages: [
            { sender: 1, localSeq: 0, content: "a" },
            { sender: 0, localSeq: 0, content: "b" },
            { sender: 2, localSeq: 0, content: "c" },
            { sender: 1, localSeq: 1, content: "d" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the broadcast messages from all senders",
        "assign each message a global order key",
        "sort messages by their order key",
        "for each message in sorted order",
        "deliver it to every process in that order",
        "append it to each process delivery log",
        "done: all processes share one delivery order",
    ],
};

export default module;
