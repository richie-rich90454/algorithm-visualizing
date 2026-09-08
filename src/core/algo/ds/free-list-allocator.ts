/**
 * free-list-allocator.ts – Free List Allocator
 *
 * Freed blocks thread into size-ordered lists, so the next fitting
 * allocation reuses instead of fragmenting – first-fit here.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { total?: number; ops?: Array<["alloc" | "free", number]> } | null) ?? {};
    const total = task.total ?? 10;
    const ops = task.ops ?? [
        ["alloc", 3],
        ["alloc", 4],
        ["free", 0],
        ["alloc", 2],
    ];
    let step = 0;

    let free: Array<[number, number]> = [[0, total]];
    const held = new Map<number, [number, number]>();
    let nextHandle = 0;
    const snap = (hot: number, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        free.forEach(([addr, size], i) => {
            entities.push({
                id: `fl-${i}`,
                type: "cell" as const,
                label: `${addr}+${size}`,
                value: size,
                state: (i === hot ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { freeBlocks: free.length, held: held.size },
        };
    };

    yield snap(-1, `One free block of ${total} – first-fit policy.`, 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "alloc") {
            const i = free.findIndex(([, size]) => size >= v);
            if (i < 0) {
                yield snap(-1, `alloc(${v}) fails – no block fits.`, 1);
            } else {
                const [addr, size] = free[i] ?? [0, 0];
                const handle = nextHandle;
                nextHandle += 1;
                held.set(handle, [addr, v]);
                if (size === v) {
                    free.splice(i, 1);
                } else {
                    free[i] = [addr + v, size - v];
                }
                yield snap(i, `alloc(${v}) → h${handle} at ${addr}, remainder ${size - v}.`, 1);
            }
        } else {
            const got = held.get(v);
            if (got === undefined) {
                yield snap(-1, `free(h${v}) – unknown handle, ignored.`, 2);
            } else {
                held.delete(v);
                free.push(got);
                free.sort((a, b) => a[0] - b[0]);
                yield snap(-1, `free(h${v}) – block ${got[0]}+${got[1]} rejoins the list.`, 2);
            }
        }
        step += 1;
    }
    yield snap(-1, `${held.size} allocation(s) held, ${free.length} free block(s).`, 3);
}

const module: AlgorithmModule = {
    id: "free-list-allocator",
    name: "Free List Allocator",
    category: "data-structures",
    complexity: { time: "O(blocks)", space: "O(blocks)" },
    defaultInput: {
        total: 10,
        ops: [
            ["alloc", 3],
            ["alloc", 4],
            ["free", 0],
            ["alloc", 2],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
