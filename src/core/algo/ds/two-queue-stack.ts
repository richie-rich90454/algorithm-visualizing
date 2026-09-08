/**
 * two-queue-stack.ts – Two-Queue Stack
 *
 * LIFO from two FIFOs: pushes rotate the active queue so the newest
 * element always sits at the front – pop is then a plain dequeue.
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
    const task = (input as { ops?: Array<["push" | "pop", number?]> } | null) ?? {};
    const ops = task.ops ?? [["push", 1], ["push", 2], ["pop"], ["push", 3]];
    let step = 0;

    let active: number[] = [];
    let spare: number[] = [];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            active.map((v, i) => ({
                id: `tqs-${i}`,
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
        meta: { size: active.length },
    });

    yield snap(-1, "Empty two-queue stack – newest element kept at the front.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "push" && v !== undefined) {
            spare.push(v);
            while (active.length > 0) {
                const e = active.shift();
                if (e !== undefined) {
                    spare.push(e);
                }
            }
            const tmp = active;
            active = spare;
            spare = tmp;
            yield snap(0, `push(${v}) – rotated behind it so it leads.`, 1);
        } else {
            const d = active.shift() ?? -1;
            yield snap(-1, `pop() dequeues the front: ${d}.`, 2);
        }
        step += 1;
    }
    yield snap(-1, `Final stack (front first) [${active.join(",")}].`, 3);
}

const module: AlgorithmModule = {
    id: "two-queue-stack",
    name: "Two-Queue Stack",
    category: "data-structures",
    complexity: { time: "O(n) push, O(1) pop", space: "O(n)" },
    defaultInput: { ops: [["push", 1], ["push", 2], ["pop"], ["push", 3]] },
    visualType: "grid",
    run,
};

export default module;
