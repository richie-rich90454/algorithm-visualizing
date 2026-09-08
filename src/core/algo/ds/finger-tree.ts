/**
 * finger-tree.ts – Finger Tree
 *
 * Deque digits hang around a monoidal spine: pushes touch only the
 * outer digits, while split and concat recurse down the measured
 * middle. Here annotated with sums.
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
    const task = (input as { pushes?: number[]; splitAt?: number } | null) ?? {};
    const pushes = task.pushes ?? [1, 2, 3, 4, 5];
    const splitAt = task.splitAt ?? 2;
    let step = 0;

    let left: number[] = [];
    let middle: number[][] = [];
    let right: number[] = [];
    const content = (): number[] => [...left, ...middle.flat(), ...right];
    const total = (): number => content().reduce((a, b) => a + b, 0);
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            content().map((v, i) => ({
                id: `ft-${i}`,
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
        meta: { left: left.length, middle: middle.length, right: right.length, sum: total() },
    });

    yield snap(-1, "Empty finger tree – digits plus measured spine.", 0);
    step += 1;
    for (const v of pushes) {
        right.push(v);
        if (right.length > 4) {
            const moved = right.splice(0, 2);
            middle.push(moved);
        }
        yield snap(
            content().length - 1,
            `Pushed ${v} – overflow spills pairs into the spine, sum ${total()}.`,
            1,
        );
        step += 1;
    }
    const all = content();
    const leftPart = all.slice(0, splitAt);
    const rightPart = all.slice(splitAt);
    left = leftPart.slice(0, 4);
    middle = [];
    right = rightPart.slice(-4);
    const midFlat = [
        ...leftPart.slice(4),
        ...rightPart.slice(0, Math.max(0, rightPart.length - 4)),
    ];
    for (let i = 0; i < midFlat.length; i += 2) {
        middle.push(midFlat.slice(i, i + 2));
    }
    yield snap(
        splitAt,
        `Split at ${splitAt}: left sums ${leftPart.reduce((a, b) => a + b, 0)}, right sums ${rightPart.reduce((a, b) => a + b, 0)}.`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "finger-tree",
    name: "Finger Tree",
    category: "data-structures",
    complexity: { time: "O(1) ends, O(log n) split", space: "O(n)" },
    defaultInput: { pushes: [1, 2, 3, 4, 5], splitAt: 2 },
    visualType: "grid",
    run,
};

export default module;
