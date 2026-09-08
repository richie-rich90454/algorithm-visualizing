/**
 * x-fast-trie.ts – X-Fast Trie
 *
 * One hash table per bit level stores every prefix present, each with a
 * descendant pointer. Predecessor search walks down while the query prefix
 * exists, then reports the extreme leaf below.
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

const BITS = 4;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = task.keys ?? [2, 5, 11];
    const query = task.query ?? 6;
    let step = 0;

    const bits = (v: number, n: number): string => v.toString(2).padStart(n, "0");
    const levels: Array<Map<number, { min: number; max: number }>> = [];
    for (let l = 0; l <= BITS; l += 1) {
        levels.push(new Map());
    }
    const addKey = (k: number): string[] => {
        const touched: string[] = [];
        for (let l = 0; l <= BITS; l += 1) {
            const p = k >> (BITS - l);
            const cur = levels[l]?.get(p);
            touched.push(`${l}:${p}`);
            levels[l]?.set(p, {
                min: cur === undefined ? k : Math.min(cur.min, k),
                max: cur === undefined ? k : Math.max(cur.max, k),
            });
        }
        return touched;
    };
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let l = 0; l <= BITS; l += 1) {
            let col = 0;
            for (const [p, r] of levels[l] ?? []) {
                entities.push({
                    id: `px-${l}-${p}`,
                    type: "cell" as const,
                    label: `${bits(p, l === 0 ? 1 : l)}[${r.min},${r.max}]`,
                    value: p,
                    state: hot.has(`${l}:${p}`)
                        ? ("comparing" as EntityState)
                        : ("idle" as EntityState),
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: BITS - l, col },
                });
                col += 1;
            }
        }
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { keys: keys.length, query },
        };
    };

    yield snap(new Set(), `Empty x-fast trie over ${BITS}-bit keys.`, 0);
    step += 1;
    for (const k of keys) {
        const touched = addKey(k);
        yield snap(new Set(touched), `Inserted ${k} (${bits(k, BITS)}) – one prefix per level.`, 1);
        step += 1;
    }

    let depth = 0;
    for (let l = 1; l <= BITS; l += 1) {
        const p = query >> (BITS - l);
        if (!(levels[l]?.has(p) ?? false)) {
            break;
        }
        depth = l;
        yield snap(
            new Set([`${l}:${p}`]),
            `Query ${query}: prefix ${bits(p, l)} exists – descend to level ${l}.`,
            2,
        );
        step += 1;
    }
    const under: number[] = keys.filter((k) => k >> (BITS - depth) === query >> (BITS - depth));
    const answer = under.length > 0 ? Math.max(...under) : -1;
    yield snap(
        new Set(),
        depth === BITS
            ? `Query ${query} stored exactly – predecessor is ${query}.`
            : `Deepest prefix at level ${depth}; max leaf below is ${answer} – predecessor(${query}) = ${answer}.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "x-fast-trie",
    name: "X-Fast Trie",
    category: "data-structures",
    complexity: { time: "O(log log U)", space: "O(n log U)" },
    defaultInput: { keys: [2, 5, 11], query: 6 },
    visualType: "grid",
    run,
};

export default module;
