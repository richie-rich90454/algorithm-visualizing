/**
 * fractal-tree.ts – Fractal Tree (Buffered B-Tree)
 *
 * Each node carries a message buffer: inserts append to the root buffer
 * and flush downward in batches only when a buffer fills, which turns
 * random writes into sequential ones.
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

const BUF_CAP = 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; lookup?: number } | null) ?? {};
    const keys = task.keys ?? [3, 1, 4, 2];
    const lookup = task.lookup ?? 4;
    let step = 0;

    const rootBuf: number[] = [];
    const leftLeaf: number[] = [];
    const rightLeaf: number[] = [];
    const pivot = 3;

    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        rootBuf.forEach((k, i) => {
            entities.push({
                id: `root-${i}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot.has(k) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            });
        });
        leftLeaf.forEach((k, i) => {
            entities.push({
                id: `left-${i}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot.has(100 + k) ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: i },
            });
        });
        rightLeaf.forEach((k, i) => {
            entities.push({
                id: `right-${i}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot.has(100 + k) ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: 10 + i },
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { rootBuffer: rootBuf.length, stored: leftLeaf.length + rightLeaf.length },
        };
    };

    const flush = (): number[] => {
        const moved = [...rootBuf];
        rootBuf.length = 0;
        for (const k of moved) {
            (k < pivot ? leftLeaf : rightLeaf).push(k);
        }
        return moved;
    };

    yield snap(new Set(), `Empty fractal tree – pivot ${pivot}, buffer capacity ${BUF_CAP}.`, 0);
    step += 1;
    for (const k of keys) {
        rootBuf.push(k);
        if (rootBuf.length >= BUF_CAP) {
            const moved = flush();
            yield snap(
                new Set(moved.map((m) => 100 + m)),
                `Buffer full – batch-flushed [${moved.join(",")}] to the leaves.`,
                1,
            );
        } else {
            yield snap(new Set([k]), `Buffered ${k} at the root (no disk touch).`, 1);
        }
        step += 1;
    }
    if (rootBuf.length > 0) {
        const moved = flush();
        yield snap(
            new Set(moved.map((m) => 100 + m)),
            `Final flush pushes [${moved.join(",")}] down.`,
            2,
        );
        step += 1;
    }
    const all = [...leftLeaf, ...rightLeaf, ...rootBuf];
    const found = all.includes(lookup);
    yield snap(
        new Set(found ? [100 + lookup, lookup] : []),
        found ? `Lookup ${lookup} – present in the leaves.` : `Lookup ${lookup} – absent.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "fractal-tree",
    name: "Fractal Tree",
    category: "data-structures",
    complexity: { time: "O(log_B N) amortized", space: "O(n)" },
    defaultInput: { keys: [3, 1, 4, 2], lookup: 4 },
    visualType: "grid",
    run,
};

export default module;
