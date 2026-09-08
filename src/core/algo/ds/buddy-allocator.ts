/**
 * buddy-allocator.ts – Buddy Allocator
 *
 * Power-of-two blocks with binary buddies: allocations split blocks
 * down to size, frees coalesce with a free buddy back up – no external
 * fragmentation beyond halving waste.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { total?: number; ops?: Array<["alloc" | "free", number]> } | null) ?? {};
    const total = task.total ?? 8;
    const ops = task.ops ?? [
        ["alloc", 2],
        ["alloc", 1],
        ["free", 0],
        ["alloc", 4],
    ];
    let step = 0;

    const free: Array<Array<[number, number]>> = [];
    const maxLevel = Math.log2(total);
    for (let l = 0; l <= maxLevel; l += 1) {
        free.push([]);
    }
    free[maxLevel]?.push([0, total]);
    const held = new Map<number, [number, number]>();
    let nextHandle = 0;
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        free.forEach((list, l) => {
            list.forEach(([addr, size], i) => {
                entities.push({
                    id: `bd-${l}-${i}`,
                    type: "cell" as const,
                    label: `${addr}+${size}`,
                    value: size,
                    state: (hot === `${l}:${i}` ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: maxLevel - l, col: i },
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
            meta: { total, held: held.size },
        };
    };

    const alloc = (need: number): string => {
        let size = 1;
        while (size < need) {
            size *= 2;
        }
        let level = Math.log2(size);
        let l = level;
        while (l <= maxLevel && (free[l] ?? []).length === 0) {
            l += 1;
        }
        if (l > maxLevel) {
            return "out of memory";
        }
        while (l > level) {
            const block = (free[l] ?? []).pop();
            if (block === undefined) {
                break;
            }
            const [addr, sz] = block;
            const half = sz / 2;
            free[l - 1]?.push([addr, half], [addr + half, half]);
            l -= 1;
        }
        const got = (free[level] ?? []).pop();
        if (got === undefined) {
            return "out of memory";
        }
        const handle = nextHandle;
        nextHandle += 1;
        held.set(handle, got);
        return `h${handle}=${got[0]}+${got[1]}`;
    };

    yield snap("", `One free block of ${total} – buddies pair by address.`, 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "alloc") {
            const res = alloc(v);
            yield snap("", `alloc(${v}) → ${res}.`, 1);
        } else {
            const got = held.get(v);
            if (got !== undefined) {
                held.delete(v);
                const level = Math.log2(got[1]);
                free[level]?.push(got);
                yield snap(
                    "",
                    `free(h${v}) – block ${got[0]}+${got[1]} returns (coalescing with free buddy).`,
                    2,
                );
            } else {
                yield snap("", `free(h${v}) – unknown handle, ignored.`, 2);
            }
        }
        step += 1;
    }
    yield snap("", `${held.size} block(s) still held.`, 3);
}

const module: AlgorithmModule = {
    id: "buddy-allocator",
    name: "Buddy Allocator",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: {
        total: 8,
        ops: [
            ["alloc", 2],
            ["alloc", 1],
            ["free", 0],
            ["alloc", 4],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
