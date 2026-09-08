/**
 * skew-binary-list.ts – Skew Binary List
 *
 * Persistent list of skew-binary-sized chunks: cons is O(1) (a singleton
 * chunk or a merge of the two smallest), while indexing walks chunks
 * from the front in logarithmic time.
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
    const task = (input as { pushes?: number[]; index?: number } | null) ?? {};
    const pushes = task.pushes ?? [1, 2, 3, 4];
    const index = task.index ?? 2;
    let step = 0;

    const chunks: number[][] = [];
    const skew = (n: number): number[] => {
        const out: number[] = [];
        let size = 2;
        while (n > 0) {
            if (n % 2 === 1) {
                out.push(size - 1);
            }
            n = Math.floor(n / 2);
            size *= 2;
        }
        return out.reverse();
    };
    const content = (): number[] => chunks.flat();
    const snap = (hot: number, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        chunks.forEach((c, ci) => {
            c.forEach((v, ki) => {
                const global = chunks.slice(0, ci).reduce((a, x) => a + x.length, 0) + ki;
                entities.push({
                    id: `sb-${ci}-${ki}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (global === hot ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ci, col: ki },
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
            meta: { chunks: chunks.length, skew: skew(content().length).join("+") },
        };
    };

    yield snap(-1, "Empty skew-binary list.", 0);
    step += 1;
    for (const v of pushes) {
        if (chunks.length >= 2 && (chunks[0] ?? []).length === (chunks[1] ?? []).length) {
            const a = chunks.shift() ?? [];
            const b = chunks.shift() ?? [];
            chunks.unshift([v, ...a, ...b]);
            yield snap(0, `cons(${v}) merges the two smallest chunks – still O(1).`, 1);
        } else {
            chunks.unshift([v]);
            yield snap(0, `cons(${v}) starts a singleton chunk.`, 1);
        }
        step += 1;
    }
    const all = content();
    const answer = all[index] ?? -1;
    yield snap(index, `Index ${index} walks chunks from the front: ${answer}.`, 2);
}

const module: AlgorithmModule = {
    id: "skew-binary-list",
    name: "Skew Binary List",
    category: "data-structures",
    complexity: { time: "O(1) cons, O(log n) index", space: "O(n)" },
    defaultInput: { pushes: [1, 2, 3, 4], index: 2 },
    visualType: "grid",
    run,
};

export default module;
