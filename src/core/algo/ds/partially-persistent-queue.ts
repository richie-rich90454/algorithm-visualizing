/**
 * partially-persistent-queue.ts - Partially Persistent Queue
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A partially persistent queue keeps every version readable while allowing
 * updates only on the newest version. Each operation copies the latest queue
 * into a fresh version, so earlier snapshots stay valid forever. This teaching
 * model uses copy-on-write arrays; the persisted versions form the history.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per operation for the array copy
 *   Space: O(n^2) across all retained versions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One row of cells per version, one column per queue position.
 *   - The newest version's cells are GREEN; older versions are GREY.
 *   - The cell added or removed by the current operation is YELLOW.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Operation = { op: string; value?: number };

function makeCells(
    versions: number[][],
    active: [number, number] | null,
): VisualEntity[] {
    const cols = Math.max(1, ...versions.map((v) => v.length));
    const cells: VisualEntity[] = [];
    versions.forEach((items, version) => {
        for (let col = 0; col < cols; col += 1) {
            const has = col < items.length;
            const value = has ? items[col]! : 0;
            let state: EntityState = "unvisited";
            if (has) {
                state = version === versions.length - 1 ? "sorted" : "visited";
            }
            if (active && active[0] === version && active[1] === col) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${version}-${col}`,
                type: "cell" as const,
                label: has ? String(value) : "-",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: version, col, filled: has },
            });
        }
    });
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ops?: Operation[] } | null) ?? {};
    const ops: Operation[] = Array.isArray(task.ops)
        ? task.ops
        : [
              { op: "enqueue", value: 1 },
              { op: "enqueue", value: 2 },
              { op: "dequeue" },
              { op: "enqueue", value: 3 },
          ];
    const versions: number[][] = [[]];
    let step = 0;

    const frame = (
        active: [number, number] | null,
        description: string,
        line: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(versions, active),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: versions.length,
            cols: Math.max(1, ...versions.map((v) => v.length)),
            versions: versions.map((v) => [...v]),
            answer: versions[versions.length - 1]?.length ?? 0,
        },
    });

    yield frame(null, `Starting a persistent queue with version 0 holding no items.`, 0);

    for (const operation of ops) {
        const latest = versions[versions.length - 1] ?? [];
        const copy = [...latest];
        let active: [number, number] | null = null;
        if (operation.op === "enqueue") {
            const value = Number(operation.value) || 0;
            copy.push(value);
            active = [versions.length, copy.length - 1];
            versions.push(copy);
            yield frame(active, `Enqueued ${value} into version ${versions.length - 1}; older versions are unchanged.`, 2);
        } else if (operation.op === "dequeue") {
            if (copy.length > 0) {
                copy.shift();
                versions.push(copy);
                yield frame(null, `Dequeued the front into version ${versions.length - 1}; version 0 and all earlier snapshots remain readable.`, 4);
            } else {
                yield frame(null, "Dequeue on an empty queue leaves a new empty version.", 5);
                versions.push(copy);
            }
        } else {
            yield frame(null, `Unknown operation "${operation.op}" was ignored.`, 6);
        }
    }

    yield frame(null, `Kept ${versions.length} readable version(s); the newest holds ${versions[versions.length - 1]?.length ?? 0} item(s).`, 7);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Persistence means an update returns a new version instead of destroying the old one. With partial persistence only the newest version may be updated, but any earlier version can still be queried. Copying the newest array into a fresh version is the simplest way to keep every snapshot intact.",
        invariants: [
            "Version 0 is always the empty queue.",
            "No operation ever mutates an already published version.",
            "The newest version is the only one eligible for update.",
        ],
        correctness:
            "Each operation reads the newest snapshot and writes to a fresh copy, so previously published arrays remain exactly as they were. Because the copy starts as a clone of the newest version, applying enqueue or dequeue to it produces precisely the same contents as an ephemeral queue would, while retaining the full history for queries.",
        complexityRationale:
            "Copying an array of length n takes O(n) time per operation, and each version stores up to n items, so retained space is O(n^2) over a history of n operations. A balanced persistent structure could lower these bounds but is beyond this teaching model.",
        uses: [
            "Undo stacks and time-travel debugging",
            "Functional data structures where values are immutable",
            "Database snapshots with append-only version chains",
        ],
        references: [
            "Okasaki, Purely Functional Data Structures, Chapter 6",
            "Driscoll et al., Making Data Structures Persistent, 1989",
        ],
        workedExample:
            "Version 0 is empty. Enqueuing 1 creates version 1 containing [1]; enqueuing 2 creates version 2 containing [1,2]. Dequeuing creates version 3 containing [2], while version 2 still reads [1,2].",
    },
    id: "partially-persistent-queue",
    name: "Partially Persistent Queue",
    category: "data-structures",
    complexity: { time: "O(n) per operation", space: "O(n^2)" },
    defaultInput: {
        ops: [
            { op: "enqueue", value: 1 },
            { op: "enqueue", value: 2 },
            { op: "dequeue" },
            { op: "enqueue", value: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "create version zero as an empty queue",
        "for each operation in the sequence",
        "copy the newest version into a fresh array",
        "on enqueue append the value to the copy",
        "on dequeue remove the front item from the copy",
        "publish the copy as the newest version",
        "leave all earlier versions readable and unchanged",
        "report every version and the newest queue contents",
    ],
};

export default module;
