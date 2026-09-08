/**
 * concurrent-trie.ts – Concurrent Trie (C-Trie)
 *
 * Lock-free trie nodes: inodes point at cnodes holding bitmap-indexed
 * branches. Inserts CAS a new cnode into place; this demo shows the
 * snapshots and successful CAS steps on a tiny key set.
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
    const task = (input as { keys?: string[]; lookup?: string } | null) ?? {};
    const keys = task.keys ?? ["01", "10", "11"];
    const lookup = task.lookup ?? "10";
    let step = 0;
    let casCount = 0;

    const levels: Array<Map<string, number>> = [new Map(), new Map(), new Map()];
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        levels.forEach((level, li) => {
            let col = 0;
            for (const [prefix, bmp] of level) {
                entities.push({
                    id: `ct-${li}-${prefix}`,
                    type: "cell" as const,
                    label: `${prefix || "root"}:${bmp.toString(2).padStart(2, "0")}`,
                    value: bmp,
                    state: (hot.has(`${li}:${prefix}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: li, col },
                });
                col += 1;
            }
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { keys: keys.length, cas: casCount },
        };
    };

    const insert = (key: string): string[] => {
        const touched: string[] = [];
        for (let li = 0; li < key.length; li += 1) {
            const prefix = key.slice(0, li);
            const bit = key[li] === "1" ? 2 : 1;
            const level = levels[li];
            if (level === undefined) {
                continue;
            }
            level.set(prefix, (level.get(prefix) ?? 0) | bit);
            touched.push(`${li}:${prefix}`);
        }
        levels[key.length]?.set(key, 4);
        touched.push(`${key.length}:${key}`);
        casCount += 1;
        return touched;
    };

    yield snap(new Set(), "Empty C-trie – one inode root, no cnodes.", 0);
    step += 1;
    for (const key of keys) {
        const touched = insert(key);
        yield snap(
            new Set(touched),
            `Inserted "${key}" – CAS ${casCount} swapped the cnode into place.`,
            1,
        );
        step += 1;
    }

    let node = "";
    let ok = true;
    for (let li = 0; li < lookup.length; li += 1) {
        const bit = lookup[li] === "1" ? 2 : 1;
        const bmp = levels[li]?.get(node) ?? 0;
        const good = (bmp & bit) !== 0;
        yield snap(
            new Set([`${li}:${node}`]),
            good
                ? `Lookup "${lookup}": level ${li} bitmap has the branch – descend.`
                : `Lookup "${lookup}": level ${li} bitmap lacks the branch – absent.`,
            2,
        );
        step += 1;
        if (!good) {
            ok = false;
            break;
        }
        node += lookup[li] ?? "";
    }
    const found = ok && (levels[lookup.length]?.has(node) ?? false);
    yield snap(
        new Set(),
        found ? `"${lookup}" found – terminal cnode present.` : `"${lookup}" is not stored.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "concurrent-trie",
    name: "Concurrent Trie",
    category: "data-structures",
    complexity: { time: "O(m) lock-free", space: "O(keys)" },
    defaultInput: { keys: ["01", "10", "11"], lookup: "10" },
    visualType: "grid",
    run,
};

export default module;
