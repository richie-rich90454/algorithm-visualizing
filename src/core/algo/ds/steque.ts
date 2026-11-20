/**
 * steque.ts – Steque (Stack-Ended Queue)
 *
 * Push, pop, and enqueue – but no general dequeue mix: the front half
 * behaves like a stack while the back half only grows. All three
 * operations run in worst-case O(1).
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Push, pop, and enqueue – but no general dequeue mix: the front half behaves like a stack while the back half only grows. All three operations run in worst-case O(1).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1)
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
 *   - Standard Steque behavior with textbook operation costs.
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
    const task = (input as { ops?: Array<["push" | "pop" | "enqueue", number?]> } | null) ?? {};
    const ops = task.ops ?? [["push", 1], ["push", 2], ["enqueue", 3], ["pop"], ["enqueue", 4]];
    let step = 0;

    const front: number[] = [];
    const back: number[] = [];
    const content = (): number[] => [...front].reverse().concat(back);
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            content().map((v, i) => ({
                id: `sq-${i}`,
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
        meta: { size: content().length },
    });

    yield snap(-1, "Empty steque – front stack plus back-only list.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "push" && v !== undefined) {
            front.push(v);
            yield snap(0, `push(${v}) onto the front stack.`, 1);
        } else if (op === "enqueue" && v !== undefined) {
            back.push(v);
            yield snap(content().length - 1, `enqueue(${v}) at the back end.`, 1);
        } else if (op === "pop") {
            const d = front.length > 0 ? (front.pop() ?? -1) : (back.shift() ?? -1);
            yield snap(-1, `pop() returns ${d} – front stack preferred.`, 2);
        }
        step += 1;
    }
    yield snap(-1, `Final steque [${content().join(",")}].`, 3);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A steque supports push at the front, pop from the front, and enqueue at the back, but no general dequeue beyond pop. It can be built from two stacks so all three operations are worst-case O(1).",
        "invariants": [
            "The front half behaves as a stack and the back half only grows at the tail.",
            "Pop takes from the front stack, falling back to the back when it is empty.",
            "Total size is the sum of both halves."
        ],
        "correctness": "Pushing onto the front stack and popping from it gives LIFO behavior; enqueuing at the back appends in arrival order. When the front empties, shifting from the back exposes the oldest enqueued item, so the supported operations interleave correctly.",
        "complexityRationale": "Each operation touches only the top of a stack or the end of a list, O(1) worst case. Each element resides in one half, O(n) space.",
        "uses": [
            "Double-ended structures where only one end needs full flexibility",
            "Work-stealing and deque variants",
            "Simple schedulers with push, enqueue, and pop"
        ],
        "references": [
            "Hood and Melville, Real-Time Queue Operations in Pure Lisp, 1981",
            "Brodnik et al., Deques in Constant Time, 1999"
        ],
        "workedExample": "Operations push 1, push 2, enqueue 3, pop, enqueue 4. The front stack gets 1 then 2; enqueue 3 goes to the back; pop returns 2; enqueue 4 appends after 3, leaving front [1] and back [3,4]."
    },
    id: "steque",
    name: "Steque",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(n)" },
    defaultInput: { ops: [["push", 1], ["push", 2], ["enqueue", 3], ["pop"], ["enqueue", 4]] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty steque of front stack plus back list",
        "push value: place it on top of the front stack",
        "enqueue value: append it to the back list end",
        "pop: take from the front stack, or shift the back if empty",
        "front stays LIFO while the back only grows at the tail",
        "track total size across both halves",
        "done: operations interleave correctly and the final steque holds",
    ],
};

export default module;
