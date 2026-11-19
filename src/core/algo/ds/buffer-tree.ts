/**
 * buffer-tree.ts - Buffer Tree
 *
 * A buffer tree is a B-tree whose internal nodes carry buffers. Updates enter
 * the root buffer and are flushed downward in sorted batches once the buffer
 * fills, so a single sequential pass distributes many updates with few random
 * accesses. Bulk loading and batched flushing give O((m/B) log(m/B)) I/Os for
 * m updates with block size B, instead of one search per update.
 *
 * Time:  O(m log m) comparisons for m buffered updates in this model
 * Space: O(m + leaves)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Op = { type: "i" | "d"; key: number };
const parseOps = (raw: unknown[]): Op[] =>
    raw
        .filter((op): op is [string, number] =>
            Array.isArray(op) &&
            (op[0] === "insert" || op[0] === "delete") &&
            typeof op[1] === "number",
        )
        .map((op) => ({ type: op[0] === "insert" ? "i" : "d", key: op[1] }));

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number; bufferSize?: number; ops?: unknown[] } | null) ?? {};
    const leafCount = typeof task.leaves === "number" ? Math.max(1, Math.floor(task.leaves)) : 4;
    const threshold = typeof task.bufferSize === "number" ? Math.max(1, Math.floor(task.bufferSize)) : 3;
    const ops = parseOps(Array.isArray(task.ops) ? task.ops : [
        ["insert", 5], ["insert", 2], ["insert", 9], ["insert", 1],
        ["insert", 7], ["delete", 5], ["insert", 3], ["insert", 8],
    ]);

    const rootBuffer: Op[] = [];
    const leafBuffers: Op[][] = Array.from({ length: leafCount }, () => []);
    const counts = new Map<number, number>();
    const keys = ops.map((op) => op.key);
    const lo = keys.length ? Math.min(...keys) : 0;
    const hi = keys.length ? Math.max(...keys) : lo;
    const span = hi - lo + 1;
    const route = (key: number): number =>
        Math.max(0, Math.min(leafCount - 1, Math.floor(((key - lo) / span) * leafCount)));

    let step = 0;
    let hot = "";

    const snapshot = (message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        rootBuffer.forEach((op, i) => {
            entities.push({
                id: `bt-root-${i}`,
                type: "cell" as const,
                label: `${op.type}${op.key}`,
                value: op.key,
                state: (hot === `root-${i}` ? "comparing" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { row: 0, col: i, kind: op.type },
            });
        });
        leafBuffers.forEach((buffer, leaf) => {
            if (buffer.length === 0) {
                entities.push({
                    id: `bt-leaf-${leaf}-empty`,
                    type: "cell" as const,
                    label: "L" + leaf,
                    value: leaf,
                    state: "unvisited" as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: leaf + 1, col: 0, empty: true },
                });
                return;
            }
            buffer.forEach((op, i) => {
                entities.push({
                    id: `bt-leaf-${leaf}-${i}`,
                    type: "cell" as const,
                    label: `${op.type}${op.key}`,
                    value: op.key,
                    state: (hot === `leaf-${leaf}-${i}` ? "comparing" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: leaf + 1, col: i, kind: op.type },
                });
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                leaves: leafCount,
                threshold,
                rootBuffer: rootBuffer.length,
                leafBuffers: leafBuffers.reduce((sum, b) => sum + b.length, 0),
                applied: [...counts.entries()].length,
            },
        };
    };

    const flushRoot = (): void => {
        const batch = [...rootBuffer].sort((a, b) => a.key - b.key);
        rootBuffer.length = 0;
        for (const op of batch) leafBuffers[route(op.key)]?.push(op);
    };
    const flushLeaf = (leaf: number): void => {
        const buffer = leafBuffers[leaf];
        if (!buffer) return;
        for (const op of buffer) {
            const current = counts.get(op.key) ?? 0;
            counts.set(op.key, op.type === "i" ? current + 1 : Math.max(0, current - 1));
        }
        buffer.length = 0;
    };

    yield snapshot(`Buffer tree with ${leafCount} leaves and buffer threshold ${threshold}.`, 0);
    step += 1;

    for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i];
        if (!op) continue;
        rootBuffer.push(op);
        hot = `root-${rootBuffer.length - 1}`;
        yield snapshot(`Buffer ${op.type === "i" ? "insert" : "delete"} ${op.key} in the root.`, 1);
        step += 1;
        if (rootBuffer.length >= threshold) {
            flushRoot();
            hot = "";
            yield snapshot("Root buffer full: flush a sorted batch to the leaves.", 2);
            step += 1;
            for (let leaf = 0; leaf < leafCount; leaf += 1) {
                if ((leafBuffers[leaf]?.length ?? 0) >= threshold) {
                    flushLeaf(leaf);
                    yield snapshot(`Leaf ${leaf} buffer full: apply its batch to storage.`, 3);
                    step += 1;
                }
            }
        }
    }

    flushRoot();
    hot = "";
    yield snapshot("End of stream: flush the remaining root batch.", 4);
    step += 1;
    for (let leaf = 0; leaf < leafCount; leaf += 1) {
        if ((leafBuffers[leaf]?.length ?? 0) > 0) {
            flushLeaf(leaf);
            yield snapshot(`Final flush of leaf ${leaf} into storage.`, 5);
            step += 1;
        }
    }

    hot = "";
    const finalKeys = [...counts.keys()].sort((a, b) => a - b);
    const finalCounts = finalKeys.map((key) => counts.get(key) ?? 0);
    const base = snapshot(
        `Done: all ${ops.length} updates drained; final counts over [${finalKeys.join(",")}].`,
        7,
    );
    yield {
        ...base,
        meta: { ...base.meta, keys: finalKeys, counts: finalCounts },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A buffer tree turns many small updates into a few large sequential writes. Every node keeps a buffer; an update is dropped into the root and only moves down when the buffer fills, at which point the buffered updates are sorted and pushed to the appropriate children in one pass. Leaves finally apply their batches to storage.",
        invariants: [
            "Every pending update lives in exactly one buffer on a root-to-leaf path.",
            "A flushed batch is sorted by key, so writes into children are sequential.",
            "Applying an insert raises a key count and a delete lowers it but never below zero.",
        ],
        correctness:
            "Routing each buffered key by its range sends it to the only leaf responsible for that key, so no update is lost or duplicated. Because operations on a single key are applied in arrival order within a sorted batch, the final count equals the count produced by applying the same stream directly, clamped at zero for deletes.",
        complexityRationale:
            "Each buffer of B updates is flushed in one sorted pass, so m updates cost O((m/B) log_{M/B}(m/B)) memory transfers in the external model; locally the sorts cost O(m log m). Space is O(m) buffered updates plus the leaf storage.",
        uses: [
            "Bulk loading and batch updates in external-memory indexes",
            "Databases that ingest large streams of insertions",
            "I/O-efficient sorting and graph algorithms",
        ],
        references: [
            "Lars Arge, 'The Buffer Tree: A Technique for Designing Batched External Data Structures', Algorithmica 2003",
            "Lars Arge and Jeffrey Scott Vitter, 'Optimal Dynamic Interval Management in External Memory', FOCS 1996",
        ],
        workedExample:
            "With threshold 3, inserts 5, 2, 9 fill the root and flush sorted as 2, 5, 9 into their leaves. More inserts trigger further flushes; a delete of 5 is buffered, flushed, and finally decrements the stored count for 5 to zero.",
    },
    id: "buffer-tree",
    name: "Buffer Tree",
    category: "data-structures",
    complexity: { time: "O((m/B) log(m/B)) I/Os", space: "O(m)" },
    defaultInput: {
        leaves: 4,
        bufferSize: 3,
        ops: [
            ["insert", 5], ["insert", 2], ["insert", 9], ["insert", 1],
            ["insert", 7], ["delete", 5], ["insert", 3], ["insert", 8],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty root buffer and leaf buffers",
        "place each incoming update in the root buffer",
        "when a buffer fills sort its updates by key",
        "route each buffered update to the responsible child",
        "clear the flushed buffer after forwarding its batch",
        "when a leaf buffer fills apply updates to storage",
        "at end of stream flush all remaining buffers",
        "done: report final key counts from the applied batches",
    ],
};

export default module;
