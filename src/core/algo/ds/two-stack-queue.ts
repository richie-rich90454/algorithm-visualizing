/**
 * two-stack-queue.ts – Two-Stack Queue
 *
 * Amortized FIFO from two LIFOs: pushes pile onto the in-stack, and a
 * pop drains it into the out-stack only when the out-stack runs dry –
 * so each element moves at most twice.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Amortized FIFO from two LIFOs: pushes pile onto the in-stack, and a pop drains it into the out-stack only when the out-stack runs dry – so each element moves at most twice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) amortized
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Two-Stack Queue behavior with textbook operation costs.
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
    const ops = task.ops ?? [["enq", 1], ["enq", 2], ["deq"], ["enq", 3], ["deq"]];
    let step = 0;

    const inStack: number[] = [];
    const outStack: number[] = [];
    const content = (): number[] => [...outStack].reverse().concat(inStack);
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            content().map((v, i) => ({
                id: `tsq-${i}`,
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
        meta: { inStack: inStack.length, outStack: outStack.length },
    });

    yield snap(-1, "Empty two-stack queue.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "enq" && v !== undefined) {
            inStack.push(v);
            yield snap(content().length - 1, `Enqueued ${v} onto the in-stack.`, 1);
        } else {
            if (outStack.length === 0) {
                while (inStack.length > 0) {
                    const e = inStack.pop();
                    if (e !== undefined) {
                        outStack.push(e);
                    }
                }
                yield snap(
                    -1,
                    "Out-stack dry – drained the in-stack over (each element moves once).",
                    2,
                );
                step += 1;
            }
            const d = outStack.pop() ?? -1;
            yield snap(-1, `Dequeued ${d} from the out-stack.`, 2);
        }
        step += 1;
    }
    yield snap(-1, `Final queue [${content().join(",")}].`, 3);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A queue can be built from two stacks: enqueues push onto the in-stack and dequeues pop from the out-stack. When the out-stack empties, pour all elements from the in-stack over, reversing their order so the oldest lands on top.",
        "invariants": [
            "Elements in the out-stack are in dequeue order.",
            "Elements in the in-stack are in arrival order.",
            "Each element moves from in to out at most once."
        ],
        "correctness": "Pouring reverses the in-stack so the earliest enqueued element lands on top of the out-stack and is returned next. Since elements are poured once and the out-stack preserves that reversed order, successive pops follow FIFO order.",
        "complexityRationale": "Each element is pushed once, popped once, and moved once, so any sequence takes linear total work and each operation is O(1) amortized, though a single pour costs O(n). Two stacks hold all n elements, O(n) space.",
        "uses": [
            "Functional queues with amortized guarantees",
            "Implementing FIFO where only stacks exist",
            "Persistent queue structures"
        ],
        "references": [
            "Hood and Melville, Real-Time Queue Operations in Pure Lisp, 1981",
            "Okasaki, Purely Functional Data Structures, Chapter 2 on batched queues"
        ],
        "workedExample": "Operations enq 1, enq 2, deq, enq 3, deq. In-stack holds 1, 2; the first deq pours them so out-stack tops 1 and returns it; enq 3 goes to in-stack and the next deq returns 2, preserving FIFO."
    },
    id: "two-stack-queue",
    name: "Two-Stack Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: { ops: [["enq", 1], ["enq", 2], ["deq"], ["enq", 3], ["deq"]] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty in-stack and out-stack",
        "enqueue value: push it onto the in-stack",
        "dequeue: if the out-stack is empty, pour the in-stack over",
        "pouring reverses order so the oldest value tops the out-stack",
        "pop the out-stack top to emit FIFO order",
        "each element moves between stacks at most once amortized",
        "done: dequeues leave in FIFO order and both stacks hold state",
    ],
};

export default module;
