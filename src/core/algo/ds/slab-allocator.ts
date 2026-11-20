/**
 * slab-allocator.ts – Slab Allocator
 *
 * Fixed-size object caching: each slab serves one object size, so
 * kernel-style alloc/free never fragments and hot objects stay cached.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fixed-size object caching: each slab serves one object size, so kernel-style alloc/free never fragments and hot objects stay cached.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1)
 *   Space: O(objects)
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
 *   - Standard Slab Allocator behavior with textbook operation costs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { slabSize?: number; ops?: Array<["alloc" | "free", number?]> } | null) ?? {};
    const slabSize = task.slabSize ?? 4;
    const ops = task.ops ?? [["alloc"], ["alloc"], ["free", 0], ["alloc"], ["alloc"], ["alloc"]];
    let step = 0;

    const slabs: boolean[][] = [new Array<boolean>(slabSize).fill(false)];
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        slabs.forEach((slab, si) => {
            slab.forEach((used, ki) => {
                entities.push({
                    id: `sl-${si}-${ki}`,
                    type: "cell" as const,
                    label: used ? "X" : ".",
                    value: used ? 1 : 0,
                    state: (hot === `${si}:${ki}`
                        ? "comparing"
                        : used
                          ? "sorted"
                          : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: si, col: ki },
                });
            });
        });
        const used = slabs.flat().filter(Boolean).length;
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { slabs: slabs.length, used },
        };
    };

    const alloc = (): [number, number] | null => {
        for (let si = 0; si < slabs.length; si += 1) {
            const slab = slabs[si];
            if (slab === undefined) {
                continue;
            }
            const ki = slab.indexOf(false);
            if (ki >= 0) {
                slab[ki] = true;
                return [si, ki];
            }
        }
        const fresh = new Array<boolean>(slabSize).fill(false);
        fresh[0] = true;
        slabs.push(fresh);
        return [slabs.length - 1, 0];
    };

    yield snap("", `One empty slab of ${slabSize} slots.`, 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "alloc") {
            const at = alloc();
            yield snap(
                at !== null ? `${at[0]}:${at[1]}` : "",
                at !== null ? `Allocated slot ${at[0]}:${at[1]}.` : "Out of slabs.",
                1,
            );
        } else if (v !== undefined) {
            let n = v;
            let done = false;
            for (let si = 0; si < slabs.length && !done; si += 1) {
                const slab = slabs[si];
                if (slab === undefined) {
                    continue;
                }
                for (let ki = 0; ki < slab.length; ki += 1) {
                    if (slab[ki] === true) {
                        if (n === 0) {
                            slab[ki] = false;
                            yield snap(
                                `${si}:${ki}`,
                                `Freed slot ${si}:${ki} back to its slab.`,
                                2,
                            );
                            done = true;
                            break;
                        }
                        n -= 1;
                    }
                }
            }
            if (!done) {
                yield snap("", "Nothing live to free.", 2);
            }
        }
        step += 1;
    }
    yield snap(
        "",
        `${slabs.flat().filter(Boolean).length} object(s) live across ${slabs.length} slab(s).`,
        3,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A slab allocator groups objects of the same size into slabs, so allocation simply takes a free slot from a matching slab and free returns it. Because all slots are uniform there is no external fragmentation and hot objects stay cache resident.",
        "invariants": [
            "Every slab serves one fixed object size.",
            "A slot is either free or used exactly once.",
            "Freed slots return to the free list of their slab."
        ],
        "correctness": "Allocating from free slots and returning them on free keeps occupancy accurate; uniform sizes mean any free slot satisfies any request of that class, so the allocator never fails from fragmentation when capacity remains.",
        "complexityRationale": "Finding a free slot and flipping a used flag is O(1) and adding a slab is occasional. Space is one slot per allocated object plus metadata, O(objects).",
        "uses": [
            "Kernel object caches in Linux slab and SLUB allocators",
            "Memory pools in game engines",
            "High-frequency allocation of fixed-size records"
        ],
        "references": [
            "Bonwick, The Slab Allocator: An Object-Caching Kernel Memory Allocator, USENIX 1994",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, memory management chapter"
        ],
        "workedExample": "A slab of four slots; two allocations mark slots 0 and 1 used, freeing slot 0 makes it available again, and the next allocation reuses slot 0 instead of growing the slab."
    },
    id: "slab-allocator",
    name: "Slab Allocator",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(objects)" },
    defaultInput: {
        slabSize: 4,
        ops: [["alloc"], ["alloc"], ["free", 0], ["alloc"], ["alloc"], ["alloc"]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with one empty slab of fixed-size slots",
        "alloc: scan slabs for the first free slot and mark it used",
        "if every slot is used: append a fresh empty slab",
        "free: mark the slot unused so the next alloc can reuse it",
        "repeat the alloc and free mix from the operation list",
        "used counts track occupancy across all slabs",
        "done: slabs show final occupancy and reuse is demonstrated",
    ],
};

export default module;
