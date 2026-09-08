/**
 * lock-free-stack.ts – Lock-Free Stack (Treiber)
 *
 * Treiber's CAS stack: push and pop each retry a single compare-and-swap
 * on the top pointer, so threads never block – this demo drives the
 * successful CAS path with reclamation notes.
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
    let cas = 0;

    const stack: number[] = [];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            [...stack].reverse().map((v, i) => ({
                id: `lfs-${i}`,
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
        meta: { size: stack.length, cas },
    });

    yield snap(-1, "Empty Treiber stack – top pointer null.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "push" && v !== undefined) {
            stack.push(v);
            cas += 1;
            yield snap(0, `push(${v}) – CAS ${cas} swung top to the new node.`, 1);
        } else {
            const d = stack.pop() ?? -1;
            cas += 1;
            yield snap(-1, `pop() – CAS ${cas} swung top down, returning ${d} (reclaimed).`, 2);
        }
        step += 1;
    }
    yield snap(
        -1,
        `Final stack (top first) [${[...stack].reverse().join(",")}] after ${cas} CAS steps.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "lock-free-stack",
    name: "Lock-Free Stack",
    category: "data-structures",
    complexity: { time: "O(1) expected", space: "O(n)" },
    defaultInput: { ops: [["push", 1], ["push", 2], ["pop"], ["push", 3]] },
    visualType: "grid",
    run,
};

export default module;
