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

    education: {
        "intuition": "A fractal tree is a B-tree variant whose nodes carry message buffers. Inserts append to the root buffer instead of descending immediately, and buffers are flushed in batches when they fill. This turns many random writes into fewer sequential ones, which is faster on disk and flash.",
        "invariants": [
            "Each node's buffer holds pending messages for its descendants.",
            "A message is applied to a leaf only after it has been flushed all the way down.",
            "Buffers are flushed when they exceed a threshold."
        ],
        "correctness": "A search checks each buffer along the root-to-leaf path, so a pending message for a key is seen before the leaf's older value. Flushing a full buffer pushes messages to the appropriate children without dropping or reordering them per key. Therefore the combined view of buffers and leaves reflects all inserted keys.",
        "complexityRationale": "Each message moves down one level per flush, and batching amortizes disk transfers to O(log_B N) per insert. Space is O(n) for keys plus buffered messages.",
        "uses": [
            "Write-optimized databases",
            "Log-structured storage engines",
            "Bulk-insert workloads on disk and SSD"
        ],
        "references": [
            "Michael A. Bender et al., \"The Buffer Tree: A New Technique for Optimal I/O-Algorithms\", WADS 1995",
            "J. S. Vitter, \"External Memory Algorithms and Data Structures\", ACM Computing Surveys 2001"
        ],
        "workedExample": "Insert 3, 1, 4, 2 into a fractal tree: all four sit in the root buffer, none has reached a leaf. Searching for 4 checks the root buffer first and finds it there. When the buffer fills, its messages flush downward in one batch to the correct child nodes."
    },
    id: "fractal-tree",
    name: "Fractal Tree",
    category: "data-structures",
    complexity: { time: "O(log_B N) amortized", space: "O(n)" },
    defaultInput: { keys: [3, 1, 4, 2], lookup: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize fractal tree with buffered nodes",
        "insert key into root buffer instead of descending",
        "compare buffer fill against flush threshold",
        "flush buffer by pushing messages to children",
        "search by checking buffers along root to leaf path",
        "count buffered messages for I/O analysis",
        "done: tree holds keys with search answer and flushed buffers",
    ],
};

export default module;
