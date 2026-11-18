/**
 * queue-linked.ts – Queue (linked-list based)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A linked queue keeps both a head (front) and a tail (rear) pointer. Enqueue
 * appends at the tail, dequeue removes from the head – both O(1) because the
 * tail is tracked explicitly. This avoids the ring-buffer complexity of the
 * array version and never needs resizing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Enqueue / dequeue / peek: O(1)
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes form a horizontal chain; front and rear are labeled.
 *   - The enqueued node is YELLOW (comparing).
 *   - The dequeued node is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Same FIFO semantics as the array queue, different storage.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a linked-queue visualization.
 *
 * @param items The queue contents (front → rear).
 * @returns { nodes, edges } entity pairs.
 */
function buildQueue(items: number[]): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = items.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: index === 0 ? "comparing" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index > 0 ? String(index - 1) : "root" },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < items.length - 1; i += 1) {
        edges.push({
            id: `next-${i}`,
            sourceId: `node-${i}`,
            targetId: `node-${i + 1}`,
            label: "next",
            state: "idle",
            directed: true,
        });
    }
    return { nodes, edges };
}

/**
 * The Queue (linked) generator.
 *
 * @param input `{ enqueues, dequeueCount }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { enqueues?: number[]; dequeueCount?: number } | null) ?? {};
    const enqueues = task.enqueues ?? [5, 3, 8];
    const dequeueCount = typeof task.dequeueCount === "number" ? task.dequeueCount : 2;

    let step = 0;
    const queue: number[] = [];

    // Frame 0: the empty queue.
    yield {
        stepNumber: step,
        entities: [
            {
                id: "node-0",
                type: "node" as const,
                label: "null",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Empty linked queue – front and rear point to null.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Enqueue each value at the rear.
    for (const value of enqueues) {
        queue.push(value);
        const { nodes, edges } = buildQueue(queue);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Enqueued ${value} at the rear – queue is [${queue.join(", ")}].`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: queue.length },
        };
        step += 1;
    }

    // Dequeue from the front.
    for (let i = 0; i < dequeueCount && queue.length > 0; i += 1) {
        const dequeued = queue.shift();
        const { nodes, edges } = buildQueue(queue);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Dequeued ${dequeued} from the front (FIFO).`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { size: queue.length },
        };
        step += 1;
    }
}

/** The Queue (linked) module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A linked queue keeps both a head and a tail pointer. Enqueue appends a node after the tail and dequeue removes the head; tracking the tail explicitly makes both operations constant time with no resizing.",
        "invariants": [
            "Nodes are chained in arrival order from head to tail.",
            "Head is the oldest surviving element and tail the newest.",
            "Empty-queue transitions clear both pointers consistently."
        ],
        "correctness": "Appending at the tail places new items behind all existing ones, and removing at the head returns the item that waited longest, giving FIFO order. Updating head and tail on empty transitions keeps the chain consistent after the last node leaves.",
        "complexityRationale": "Both operations relink a constant number of pointers, O(1). Each element occupies one node, O(n) space, with no resizing cost.",
        "uses": [
            "Breadth-first search",
            "Task and job queues",
            "Event loops where queue length varies widely"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 10",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.2"
        ],
        "workedExample": "Enqueue 5, 3, 8 builds head to 5 to 3 to 8 at the tail; dequeue returns 5 then 3 by detaching the head, leaving 8 as both head and tail."
    },
    id: "queue-linked",
    name: "Queue (Linked)",
    category: "data-structures",
    complexity: { time: "O(1) enqueue/dequeue", space: "O(n)" },
    defaultInput: { enqueues: [5, 3, 8], dequeueCount: 2 },
    visualType: "graph",
    run,
    pseudocode: [
        "start with an empty linked queue with null front and rear",
        "enqueue value: link a new node after the rear node",
        "move the rear pointer to the new tail node",
        "repeat until every value is chained in arrival order",
        "dequeue: detach the front node and return its value (FIFO)",
        "advance front, clearing both pointers when the last node leaves",
        "done: dequeued values left in FIFO order and the chain state holds",
    ],
};

export default module;
