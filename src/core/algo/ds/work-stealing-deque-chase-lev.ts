/**
 * work-stealing-deque-chase-lev.ts – Work-Stealing Deque (Chase-Lev)
 *
 * Per-worker deque: the owner pushes and pops its own bottom while
 * thieves CAS-steal from the top – the classic scheduler that keeps
 * parallel runtimes fed.
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
    const task = (input as { pushes?: number[]; steals?: number } | null) ?? {};
    const pushes = task.pushes ?? [1, 2, 3, 4];
    const steals = task.steals ?? 2;
    let step = 0;

    const deque: number[] = [];
    const stolen: number[] = [];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            deque.map((v, i) => ({
                id: `wsd-${i}`,
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
        meta: { queued: deque.length, stolen: stolen.length },
    });

    yield snap(-1, "Empty Chase-Lev deque – owner works the bottom, thieves the top.", 0);
    step += 1;
    for (const v of pushes) {
        deque.push(v);
        yield snap(deque.length - 1, `Owner pushed ${v} at the bottom.`, 1);
        step += 1;
    }
    for (let s = 0; s < steals && deque.length > 0; s += 1) {
        const top = deque[0] ?? -1;
        yield snap(0, `Thief races for the top (${top})…`, 2);
        step += 1;
        deque.shift();
        stolen.push(top);
        yield snap(-1, `Thief CAS-stole ${top} – owner unaffected at the bottom.`, 2);
        step += 1;
    }
    const own = deque.pop() ?? -1;
    yield snap(-1, `Owner pops its bottom (${own}); stolen so far [${stolen.join(",")}].`, 3);
}

const module: AlgorithmModule = {
    id: "work-stealing-deque-chase-lev",
    name: "Work-Stealing Deque",
    category: "data-structures",
    complexity: { time: "O(1) owner ops", space: "O(n)" },
    defaultInput: { pushes: [1, 2, 3, 4], steals: 2 },
    visualType: "grid",
    run,
};

export default module;
