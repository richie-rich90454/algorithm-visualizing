/**
 * lsm-tree.ts – LSM Tree
 *
 * Writes land in a memtable; a full memtable flushes to an immutable
 * SSTable, and small tables compact into bigger ones. Reads check newest
 * first, so the demo lookup finds its key in L1.
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

const MEM_CAP = 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { puts?: Array<[string, number]>; get?: string } | null) ?? {};
    const puts = task.puts ?? [
        ["a", 1],
        ["b", 2],
        ["c", 3],
        ["d", 4],
    ];
    const get = task.get ?? "c";
    let step = 0;

    let mem = new Map<string, number>();
    const l0: Array<Map<string, number>> = [];
    let l1 = new Map<string, number>();

    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        let col = 0;
        for (const [k, v] of mem) {
            entities.push({
                id: `mem-${k}`,
                type: "cell" as const,
                label: `${k}=${v}`,
                value: v,
                state: (hot === `mem-${k}` ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col },
            });
            col += 1;
        }
        l0.forEach((t, ti) => {
            let c = 0;
            for (const [k, v] of t) {
                entities.push({
                    id: `l0-${ti}-${k}`,
                    type: "cell" as const,
                    label: `${k}=${v}`,
                    value: v,
                    state: (hot === `l0-${ti}-${k}` ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 1 + ti, col: c },
                });
                c += 1;
            }
        });
        let c = 0;
        for (const [k, v] of l1) {
            entities.push({
                id: `l1-${k}`,
                type: "cell" as const,
                label: `${k}=${v}`,
                value: v,
                state: (hot === `l1-${k}` ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1 + l0.length, col: c },
            });
            c += 1;
        }
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { memtable: mem.size, l0: l0.length, l1: l1.size },
        };
    };

    yield snap("", `Empty LSM tree – memtable capacity ${MEM_CAP}.`, 0);
    step += 1;
    for (const [k, v] of puts) {
        mem.set(k, v);
        if (mem.size >= MEM_CAP) {
            l0.push(new Map(mem));
            mem = new Map();
            yield snap("", `Memtable full – flushed SSTable ${l0.length} to L0.`, 1);
        } else {
            yield snap(`mem-${k}`, `Put ${k}=${v} into the memtable.`, 1);
        }
        step += 1;
    }
    if (l0.length >= 2) {
        const merged = new Map<string, number>();
        for (const t of l0) {
            for (const [k, v] of t) {
                merged.set(k, v);
            }
        }
        l0.length = 0;
        l1 = merged;
        yield snap(
            "",
            `Compacted L0 into L1 with ${l1.size} entr${l1.size === 1 ? "y" : "ies"}.`,
            2,
        );
        step += 1;
    }
    let answer: number | undefined;
    let where = "";
    if (mem.has(get)) {
        answer = mem.get(get);
        where = "memtable";
    } else {
        for (let i = l0.length - 1; i >= 0; i -= 1) {
            const t = l0[i];
            if (t !== undefined && t.has(get)) {
                answer = t.get(get);
                where = `L0 table ${i + 1}`;
                break;
            }
        }
        if (answer === undefined && l1.has(get)) {
            answer = l1.get(get);
            where = "L1";
        }
    }
    const hot = where === "memtable" ? `mem-${get}` : where === "L1" ? `l1-${get}` : "";
    yield snap(
        hot,
        answer === undefined
            ? `Get "${get}" – not found at any level.`
            : `Get "${get}" = ${answer} found in ${where}.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "lsm-tree",
    name: "LSM Tree",
    category: "data-structures",
    complexity: { time: "O(1) write amortized", space: "O(n)" },
    defaultInput: {
        puts: [
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ],
        get: "c",
    },
    visualType: "grid",
    run,
};

export default module;
