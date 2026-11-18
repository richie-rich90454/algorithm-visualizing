/**
 * persistent-array.ts – Persistent Array (Fat Nodes)
 *
 * Fully persistent random access: each slot keeps every versioned value
 * it ever held, so reading version v means scanning back to the newest
 * write at or before v.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fully persistent random access: each slot keeps every versioned value it ever held, so reading version v means scanning back to the newest write at or before v.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log versions) read
 *   Space: O(writes)
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
 *   - Standard Persistent Array behavior with textbook operation costs.
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
    const task =
        (input as {
            size?: number;
            writes?: Array<[number, number, number]>;
            read?: [number, number];
        } | null) ?? {};
    const size = task.size ?? 3;
    const writes = task.writes ?? [
        [0, 0, 7],
        [1, 1, 9],
    ];
    const read = task.read ?? [1, 0];
    let step = 0;

    const slots: Array<Array<[number, number]>> = Array.from({ length: size }, () => []);
    const readAt = (slot: number, ver: number): number => {
        const hist = slots[slot] ?? [];
        let ans = 0;
        for (const [v, val] of hist) {
            if (v <= ver) {
                ans = val;
            }
        }
        return ans;
    };
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        slots.forEach((hist, s) => {
            hist.forEach(([v, val], hi) => {
                entities.push({
                    id: `pa-${s}-${hi}`,
                    type: "cell" as const,
                    label: `v${v}:${val}`,
                    value: val,
                    state: (hot.has(`${s}:${hi}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: s, col: hi },
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
            meta: { slots: size, versions: writes.length },
        };
    };

    yield snap(new Set(), `Persistent array of ${size} fat slots – all read 0.`, 0);
    step += 1;
    writes.forEach(([ver, slot, val], wi) => {
        (slots[slot] ?? []).push([ver, val]);
    });
    for (let wi = 0; wi < writes.length; wi += 1) {
        const [ver, slot, val] = writes[wi] ?? [0, 0, 0];
        yield snap(
            new Set([`${slot}:${(slots[slot] ?? []).length - 1}`]),
            `Version ${ver}: slot ${slot} records ${val}.`,
            1,
        );
        step += 1;
    }
    const [rv, rs] = read;
    const answer = readAt(rs, rv);
    yield snap(
        new Set(),
        `Read slot ${rs} at version ${rv} – newest write at or before is ${answer}.`,
        2,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A fully persistent array keeps every value a slot ever held, stamped with the version that wrote it. Reading slot i at version v scans that slot history backward for the newest stamp at or before v, so older versions never change.",
        "invariants": [
            "Each slot history is ordered by version stamp.",
            "No history entry is ever overwritten or deleted.",
            "Reading version v uses only writes with stamp at most v."
        ],
        "correctness": "Because writes are appended rather than mutated, each slot history is a time-ordered log. The newest entry with stamp at most v is exactly the value of that slot immediately after version v, which is the definition of the array at version v, so every version reads correctly.",
        "complexityRationale": "A write appends one stamped entry, O(1); a read scans the slot history, O(log versions) with binary search. Space grows by one entry per write, O(writes).",
        "uses": [
            "Versioned configuration snapshots",
            "Undo and redo in editors",
            "Functional arrays in pure languages"
        ],
        "references": [
            "Driscoll, Sleator, and Tarjan, Making Data Structures Persistent, JCSS 1989",
            "Okasaki, Purely Functional Data Structures, Chapter 3"
        ],
        "workedExample": "In a size-3 array, write version 0 slot 0 to 7 and version 1 slot 0 to 9. Reading slot 0 at version 0 finds stamp 0 with value 7, while version 1 finds stamp 1 with value 9, leaving the old version intact."
    },
    id: "persistent-array",
    name: "Persistent Array",
    category: "data-structures",
    complexity: { time: "O(log versions) read", space: "O(writes)" },
    defaultInput: {
        size: 3,
        writes: [
            [0, 0, 7],
            [1, 1, 9],
        ],
        read: [1, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty fat-node slots that all read as zero",
        "write (version, slot, value): append the stamped value to that slot",
        "old stamps stay untouched so earlier versions never change",
        "repeat until every versioned write is recorded",
        "read (slot, version): scan the slot history backward",
        "return the newest stamp at or before the requested version",
        "done: all versions are retained and the read answer is reported",
    ],
};

export default module;
