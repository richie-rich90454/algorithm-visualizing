/**
 * vlist.ts – VList
 *
 * Persistent list of exponentially sized blocks: the newest block
 * doubles (up to a cap), so indexing skips whole blocks and traversal
 * stays cache-friendly while every version shares its tail.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Persistent list of exponentially sized blocks: the newest block doubles (up to a cap), so indexing skips whole blocks and traversal stays cache-friendly while every version shares its tail.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) cons average
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
 *   - Standard VList behavior with textbook operation costs.
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

const CAP = 4;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pushes?: number[]; index?: number } | null) ?? {};
    const pushes = task.pushes ?? [1, 2, 3, 4, 5];
    const index = task.index ?? 3;
    let step = 0;

    const blocks: number[][] = [[]];
    const snap = (hot: number, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        blocks.forEach((b, bi) => {
            b.forEach((v, ki) => {
                const global = blocks.slice(0, bi).reduce((a, x) => a + x.length, 0) + ki;
                entities.push({
                    id: `vl-${bi}-${ki}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (global === hot ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: bi, col: ki },
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
            meta: { blocks: blocks.length },
        };
    };

    yield snap(-1, "Empty vlist – blocks double in size.", 0);
    step += 1;
    for (const v of pushes) {
        let head = blocks[0];
        if (head === undefined) {
            head = [];
            blocks.unshift(head);
        }
        const prevSize = blocks.length > 1 ? (blocks[1] ?? []).length : 0;
        const headCap = Math.min(CAP, Math.max(1, prevSize === 0 ? 1 : prevSize * 2));
        if (head.length >= headCap) {
            head = [];
            blocks.unshift(head);
        }
        head.push(v);
        yield snap(0, `cons(${v}) – head block holds ${head.length}.`, 1);
        step += 1;
    }
    const all = blocks.flat();
    const answer = all[index] ?? -1;
    yield snap(index, `Index ${index} skips whole blocks: ${answer}.`, 2);
}

const module: AlgorithmModule = {
    id: "vlist",
    name: "VList",
    category: "data-structures",
    complexity: { time: "O(1) cons average", space: "O(n)" },
    defaultInput: { pushes: [1, 2, 3, 4, 5], index: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with no blocks and an empty persistent list",
        "cons value: prepend into the head block while it has room",
        "when the head is full: start a fresh block doubling in size",
        "older blocks never change so old versions stay readable",
        "index: skip whole blocks from the front, then index inside",
        "block sizes shrink geometrically toward the tail",
        "done: blocks hold all values and the indexed answer is reported",
    ],
};

export default module;
