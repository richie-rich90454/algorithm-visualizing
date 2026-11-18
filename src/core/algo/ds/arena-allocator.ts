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

    education: {
        "intuition": "An arena allocator carves out a large block of memory and satisfies each allocation by bumping a pointer forward. There is no per-object free list or header; when the arena is finished, all its objects are reclaimed at once by resetting the pointer. This makes allocation extremely cheap when objects share a lifetime.",
        "invariants": [
            "The bump pointer always points just past the last allocated byte.",
            "Allocations in an arena are contiguous and never overlap.",
            "All objects in one arena are freed together."
        ],
        "correctness": "Because each allocation advances the pointer by exactly the requested size, returned blocks cannot overlap. Checking remaining space before bumping prevents an allocation from running past the arena end; when it does not fit, a fresh arena is started. Resetting the pointer marks the whole arena free at once.",
        "complexityRationale": "Allocation is a compare and an addition, O(1) per request, and freeing the arena is O(1). Space is O(used) bytes, with wasted tail space only in partially filled arenas.",
        "uses": [
            "Per-request or per-frame scratch memory in servers and game engines",
            "Parser and compiler temporary objects",
            "Request pools in high-throughput allocators"
        ],
        "references": [
            "Andrew Hunter, \"A Memory Allocator\" notes, 2001",
            "Donald E. Knuth, The Art of Computer Programming, Vol. 1, Section 2.5"
        ],
        "workedExample": "With arena size 8 and requests 2, 3, 2, the bump pointer advances 0->2->5->7. All three blocks fit in one arena, leaving 1 byte unused. A reset returns the pointer to 0 so the next allocation reuses the same arena from the start."
    },
    id: "arena-allocator",
    name: "Arena Allocator",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(used)" },
    defaultInput: { arenaSize: 8, allocs: [2, 3, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty arena of fixed size with bump pointer at 0",
        "request allocation of size s and compare with remaining space",
        "bump-allocate by advancing pointer and recording block",
        "if block does not fit then start a fresh arena",
        "track total used bytes across all arenas",
        "free everything at once by resetting pointer to 0",
        "done: arenas hold allocations and final usage is zero after reset",
    ],
};

export default module;
