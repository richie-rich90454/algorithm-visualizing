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
