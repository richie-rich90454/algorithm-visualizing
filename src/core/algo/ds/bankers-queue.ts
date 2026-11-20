/**
 * bankers-queue.ts – Banker's Queue
 *
 * Okasaki's persistent queue: a front stream plus a reversed rear
 * stream. Appends are O(1); when the front empties, the rear rotates
 * forward – the rotation cost is prepaid by debits, hence amortized O(1).
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
    const task = (input as { ops?: Array<["snoc" | "tail", number?]> } | null) ?? {};
    const ops = task.ops ?? [["snoc", 1], ["snoc", 2], ["tail"], ["snoc", 3]];
    let step = 0;

    let front: number[] = [];
    let rear: number[] = [];
    const content = (): number[] => [...front, ...[...rear].reverse()];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            content().map((v, i) => ({
                id: `bq-${i}`,
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
        meta: { front: front.length, rear: rear.length },
    });

    yield snap(-1, "Empty banker queue – front stream plus reversed rear.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "snoc" && v !== undefined) {
            rear.push(v);
            yield snap(content().length - 1, `snoc(${v}) onto the rear – O(1), debits prepaid.`, 1);
        } else {
            if (front.length === 0) {
                front = [...rear].reverse();
                rear = [];
                yield snap(-1, "Front empty – rear rotates forward (amortized by debits).", 2);
                step += 1;
            }
            const d = front.shift() ?? -1;
            yield snap(-1, `tail() drops ${d} from the front.`, 2);
        }
        step += 1;
    }
    yield snap(-1, `Final queue [${content().join(",")}].`, 3);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A banker's queue is a purely functional FIFO queue built from two lazy streams: a front stream ready for dequeues and a rear stream holding newly enqueued values in reverse order. Enqueue is O(1) because it just conses onto the rear. When the front runs empty, the rear is reversed and rotated to the front, and that cost is prepaid by credits assigned during enqueue, giving amortized O(1).",
        "invariants": [
            "The front stream dequeues oldest-to-newest values.",
            "The rear stream stores values newest-first.",
            "Front length is always at least rear length after a rotation."
        ],
        "correctness": "Every enqueued value eventually moves from rear to front in FIFO order because a rotation appends the reversed rear, oldest first, behind the remaining front. Dequeue removes the head of the front, the oldest value still present. Lazy evaluation plus the debit invariant ensures no stream is forced twice, so the amortized bound holds.",
        "complexityRationale": "Enqueue is one cons, O(1), and dequeue is amortized O(1) because each element is moved once and paid for at insertion. The two streams hold all queued values, O(n) space.",
        "uses": [
            "Persistent functional data structures",
            "Event queues in purely functional languages",
            "Breadth-first traversal without mutation"
        ],
        "references": [
            "Chris Okasaki, Purely Functional Data Structures, Chapter 8",
            "Chris Okasaki, \"Amortized Analysis via Semantics\", 1995"
        ],
        "workedExample": "Start with empty front and rear. Snoc 1 and snoc 2 push onto rear as [2,1]; tail finds front empty and rotates rear into front [1,2], then removes 1, leaving front [2]. Snoc 3 pushes onto rear [3], and the queue represents [2,3] in FIFO order."
    },
    id: "bankers-queue",
    name: "Banker's Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: { ops: [["snoc", 1], ["snoc", 2], ["tail"], ["snoc", 3]] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize persistent queue with empty front and rear lists",
        "enqueue value by pushing onto rear list in O(1)",
        "check if front is empty then rotate rear to rebuild front",
        "dequeue value by popping head of front list",
        "compare front and rear lengths to trigger rotation",
        "share structure across versions for persistence",
        "done: queue holds remaining values in FIFO order",
    ],
};

export default module;
