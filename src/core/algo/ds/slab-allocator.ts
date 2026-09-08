/**
 * slab-allocator.ts – Slab Allocator
 *
 * Fixed-size object caching: each slab serves one object size, so
 * kernel-style alloc/free never fragments and hot objects stay cached.
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
};

export default module;
