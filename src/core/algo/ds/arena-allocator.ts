/**
 * arena-allocator.ts – Arena Allocator
 *
 * Bump allocation inside arenas: each alloc just advances a pointer,
 * and the whole arena frees at once – no per-object bookkeeping at all.
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
    const task = (input as { arenaSize?: number; allocs?: number[] } | null) ?? {};
    const arenaSize = task.arenaSize ?? 8;
    const allocs = task.allocs ?? [2, 3, 2];
    let step = 0;

    const arenas: number[][] = [[]];
    let used = 0;
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        arenas.forEach((a, ai) => {
            a.forEach((s, ki) => {
                entities.push({
                    id: `ar-${ai}-${ki}`,
                    type: "cell" as const,
                    label: String(s),
                    value: s,
                    state: (hot === `${ai}:${ki}` ? "comparing" : "sorted") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ai, col: ki },
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
            meta: { arenas: arenas.length, used },
        };
    };

    yield snap("", `Empty arena of ${arenaSize} – bump pointer at 0.`, 0);
    step += 1;
    for (const size of allocs) {
        let arena = arenas[arenas.length - 1] ?? [];
        const usedIn = arena.reduce((a, b) => a + b, 0);
        if (usedIn + size > arenaSize) {
            arena = [];
            arenas.push(arena);
        }
        arena.push(size);
        used += size;
        yield snap(
            `${arenas.length - 1}:${arena.length - 1}`,
            `Bump-allocated ${size} – pointer now ${usedIn + size}.`,
            1,
        );
        step += 1;
    }
    arenas.length = 0;
    used = 0;
    yield snap("", "Arena reset – everything freed at once, zero per-object work.", 2);
}

const module: AlgorithmModule = {
    id: "arena-allocator",
    name: "Arena Allocator",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(used)" },
    defaultInput: { arenaSize: 8, allocs: [2, 3, 2] },
    visualType: "grid",
    run,
};

export default module;
