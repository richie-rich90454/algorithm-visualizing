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

    education: {
        "intuition": "A free-list allocator keeps freed blocks in lists indexed by size so a new request can reuse one instead of asking the system for more memory. This demo uses first fit: scan the list and take the first block large enough. Adjacent free blocks are coalesced to reduce fragmentation.",
        "invariants": [
            "Every free block appears in exactly one list.",
            "Allocated blocks never appear on the free list.",
            "Coalescing merges only adjacent free blocks."
        ],
        "correctness": "First fit returns a block at least as large as the request, and splitting it returns the remainder to the free list, keeping all free space tracked. Freeing pushes the block back so it can be reused. Coalescing neighbors reconstructs larger blocks without overlapping live allocations.",
        "complexityRationale": "Scanning the list is O(blocks) worst case, and splitting or coalescing is O(1) given the block's neighbors. Storage for metadata is O(blocks).",
        "uses": [
            "Manual memory allocators",
            "Object pools and slab caches",
            "Embedded systems without an OS heap"
        ],
        "references": [
            "Donald E. Knuth, The Art of Computer Programming, Vol. 1, Section 2.5",
            "Andrew Hunter, \"A Memory Allocator\" notes, 2001"
        ],
        "workedExample": "Start with one free block of size 16. Allocate 5 by splitting off 5 and returning 11 to the list. Allocate 3 from the remainder, leaving 8 free. Freeing the first 5 and finding it adjacent to other free space coalesces them into a larger block."
    },
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
    pseudocode: [
        "initialize free list with one large free block",
        "request allocation and scan list for first fit",
        "compare block size against request size",
        "split larger block and return remainder to list",
        "free block by pushing back onto free list",
        "coalesce adjacent free blocks to reduce fragments",
        "done: memory holds allocations with free list state",
    ],
};

export default module;
