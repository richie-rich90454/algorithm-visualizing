/**
 * skew-binary-list.ts – Skew Binary List
 *
 * Persistent list of skew-binary-sized chunks: cons is O(1) (a singleton
 * chunk or a merge of the two smallest), while indexing walks chunks
 * from the front in logarithmic time.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Persistent list of skew-binary-sized chunks: cons is O(1) (a singleton chunk or a merge of the two smallest), while indexing walks chunks from the front in logarithmic time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) cons, O(log n) index
 *   Space: O(n)
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
 *   - Standard Skew Binary List behavior with textbook operation costs.
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
    const task = (input as { pushes?: number[]; index?: number } | null) ?? {};
    const pushes = task.pushes ?? [1, 2, 3, 4];
    const index = task.index ?? 2;
    let step = 0;

    const chunks: number[][] = [];
    const skew = (n: number): number[] => {
        const out: number[] = [];
        let size = 2;
        while (n > 0) {
            if (n % 2 === 1) {
                out.push(size - 1);
            }
            n = Math.floor(n / 2);
            size *= 2;
        }
        return out.reverse();
    };
    const content = (): number[] => chunks.flat();
    const snap = (hot: number, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        chunks.forEach((c, ci) => {
            c.forEach((v, ki) => {
                const global = chunks.slice(0, ci).reduce((a, x) => a + x.length, 0) + ki;
                entities.push({
                    id: `sb-${ci}-${ki}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (global === hot ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ci, col: ki },
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
            meta: { chunks: chunks.length, skew: skew(content().length).join("+") },
        };
    };

    yield snap(-1, "Empty skew-binary list.", 0);
    step += 1;
    for (const v of pushes) {
        if (chunks.length >= 2 && (chunks[0] ?? []).length === (chunks[1] ?? []).length) {
            const a = chunks.shift() ?? [];
            const b = chunks.shift() ?? [];
            chunks.unshift([v, ...a, ...b]);
            yield snap(0, `cons(${v}) merges the two smallest chunks – still O(1).`, 1);
        } else {
            chunks.unshift([v]);
            yield snap(0, `cons(${v}) starts a singleton chunk.`, 1);
        }
        step += 1;
    }
    const all = content();
    const answer = all[index] ?? -1;
    yield snap(index, `Index ${index} walks chunks from the front: ${answer}.`, 2);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A skew binary list stores elements in chunks whose sizes follow skew binary numbers. Cons is O(1): if the two smallest chunks have equal size they merge into one chunk of size 2w+1, otherwise a new singleton is added; indexing skips whole chunks in O(log n).",
        "invariants": [
            "At most one chunk of each size appears in the representation.",
            "Chunk sizes follow the skew binary sequence.",
            "Older chunks are never mutated so versions share structure."
        ],
        "correctness": "The merge rule preserves the skew binary representation and yields O(1) worst-case cons. Indexing skips chunk sizes rather than single elements, reaching the target chunk in O(log n) steps and then indexing inside it, so random access is correct and fast.",
        "complexityRationale": "Cons merges at most a constant number of chunks, O(1); indexing skips O(log n) chunks. Storage is one node per element, O(n), with persistence sharing unchanged chunks.",
        "uses": [
            "Purely functional lists with efficient indexing",
            "Persistent random access sequences",
            "Backtracking algorithms needing cheap versioned prepends"
        ],
        "references": [
            "Okasaki, Skew Binary Random Access Lists, Journal of Functional Programming 2000",
            "Okasaki, Purely Functional Data Structures, Chapter 8"
        ],
        "workedExample": "Push 1, 2, 3, 4 into chunks of sizes 1 then 3 then a new 1; indexing position 2 skips the size-3 chunk start and reads the third element while cons stays O(1)."
    },
    id: "skew-binary-list",
    name: "Skew Binary List",
    category: "data-structures",
    complexity: { time: "O(1) cons, O(log n) index", space: "O(n)" },
    defaultInput: { pushes: [1, 2, 3, 4], index: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with no chunks and an empty skew representation",
        "cons value: if the two smallest chunks match, merge all three",
        "otherwise start a new singleton chunk at the front",
        "chunk sizes always follow skew-binary numbers",
        "index: skip whole chunks from the front, then index inside",
        "cons stays O(1) while random access walks few chunks",
        "done: chunks hold all values and the indexed answer is reported",
    ],
};

export default module;
