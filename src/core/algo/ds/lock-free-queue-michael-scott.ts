/**
 * lock-free-queue-michael-scott.ts – Lock-Free Queue (Michael-Scott)
 *
 * The classic CAS queue: enqueue swings the tail's next pointer, dequeue
 * swings the head – each helped along by lagging-pointer fixes, so both
 * ends progress without locks.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-note",
                  type: "cell" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { row: 0, col: 0 },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ops?: Array<["enq" | "deq", number?]> } | null) ?? {};
    const ops = task.ops ?? [["enq", 1], ["enq", 2], ["deq"], ["enq", 3]];
    let step = 0;
    let cas = 0;

    const queue: number[] = [];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            queue.map((v, i) => ({
                id: `msq-${i}`,
                type: "cell" as const,
                label: String(v),
                value: v,
                state: (i === hot ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { size: queue.length, cas },
    });

    yield snap(-1, "Empty Michael-Scott queue – head and tail share a dummy.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "enq" && v !== undefined) {
            queue.push(v);
            cas += 2;
            yield snap(
                queue.length - 1,
                `enq(${v}) – tail-next CAS then tail swing (${cas} CAS total).`,
                1,
            );
        } else {
            const d = queue.shift() ?? -1;
            cas += 1;
            yield snap(
                -1,
                d >= 0
                    ? `deq() – head CAS swings forward, returning ${d}.`
                    : "deq() on empty – head CAS retries.",
                2,
            );
        }
        step += 1;
    }
    yield snap(-1, `Final queue [${queue.join(",")}] after ${cas} successful CAS steps.`, 3);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The Michael-Scott queue is a lock-free FIFO built from a linked list with dummy head and tail pointers. Enqueue CAS-links a new node after tail, and dequeue CAS-advances head; if a pointer lags, any thread can help move it forward. No thread holds a lock, so the queue never blocks.",
        "invariants": [
            "Head points to a dummy node preceding the first real element.",
            "Tail is reachable from head by following next pointers.",
            "Only CAS updates head or tail, so pointers never split the list."
        ],
        "correctness": "A successful CAS on tail next appends exactly one node; retries prevent lost updates when another thread won. Dequeue CAS-advances head past the dummy and returns the value at the old dummy's successor, giving FIFO order. Helping lagging pointers preserves the same linked list, so correctness holds under interleaving.",
        "complexityRationale": "Each operation is a constant number of CAS steps when uncontended, O(1) expected, with retries under contention. One node per element plus a dummy uses O(n) space.",
        "uses": [
            "Lock-free task queues",
            "Concurrent message passing",
            "Work-stealing runtimes"
        ],
        "references": [
            "Maged M. Michael and Michael L. Scott, \"Simple, Fast, and Practical Non-Blocking and Blocking Concurrent Queue Algorithms\", PODC 1996",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7"
        ],
        "workedExample": "Initialize with dummy H and tail T. Enqueue 1 CAS-links node 1 after T and moves T to node 1; enqueue 2 does the same. Dequeue CAS-moves H to node 1 and returns 1, leaving 2 at the head of the live queue."
    },
    id: "lock-free-queue-michael-scott",
    name: "Lock-Free Queue",
    category: "data-structures",
    complexity: { time: "O(1) expected", space: "O(n)" },
    defaultInput: { ops: [["enq", 1], ["enq", 2], ["deq"], ["enq", 3]] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize Michael-Scott queue with dummy head node",
        "enqueue value by CAS-linking node after tail",
        "compare tail next pointer to help lagging tail",
        "dequeue by CAS-advancing head past dummy",
        "retry CAS loop when contention detected",
        "count enqueues and dequeues for verification",
        "done: queue holds remaining values in FIFO order",
    ],
};

export default module;
