/**
 * quake-heap.ts – Quake Heap
 *
 * Simplified Fibonacci alternative: nodes sit in level lists, and a
 * quake drops every level whose node count exceeds the one below –
 * top-heavy layers shake away, keeping trees shallow.
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
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 6];
    let step = 0;

    const levels: number[][] = [[]];
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        levels.forEach((lv, li) => {
            lv.forEach((k, ki) => {
                entities.push({
                    id: `qh-${li}-${ki}`,
                    type: "cell" as const,
                    label: String(k),
                    value: k,
                    state: (hot.has(`${li}:${ki}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: li, col: ki },
                });
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { levels: levels.length, stored: levels.reduce((a, l) => a + l.length, 0) },
        };
    };

    yield snap(new Set(), "Empty quake heap – level 0 holds fresh roots.", 0);
    step += 1;
    for (const k of keys) {
        levels[0]?.push(k);
        yield snap(new Set([`0:${(levels[0] ?? []).length - 1}`]), `Inserted ${k} at level 0.`, 1);
        step += 1;
    }
    let quaked = false;
    for (let li = levels.length - 1; li > 0; li -= 1) {
        const upper = levels[li] ?? [];
        const lower = levels[li - 1] ?? [];
        if (upper.length > lower.length && upper.length > 0) {
            levels.splice(li, 1);
            quaked = true;
            yield snap(
                new Set(),
                `Quake! Level ${li} (${upper.length} nodes) exceeds level ${li - 1} – dropped.`,
                2,
            );
            step += 1;
            break;
        }
    }
    if (!quaked) {
        yield snap(new Set(), "No level is top-heavy – no quake needed.", 2);
        step += 1;
    }
    const all = levels.flat();
    const mn = all.length > 0 ? Math.min(...all) : -1;
    yield snap(new Set(), `Minimum ${mn} sits at the lowest level.`, 3);
}

const module: AlgorithmModule = {
    id: "quake-heap",
    name: "Quake Heap",
    category: "data-structures",
    complexity: { time: "O(log n) amortized", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 6] },
    visualType: "grid",
    run,
};

export default module;
