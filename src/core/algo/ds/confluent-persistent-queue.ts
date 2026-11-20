/**
 * confluent-persistent-queue.ts - Confluent Persistent Queue
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A confluent (fully persistent) queue allows updates to any past version and
 * also supports melding two versions into a new one. Every operation returns
 * a fresh immutable snapshot, so the version history branches into a dag
 * instead of a single timeline. This teaching model realizes snapshots as
 * copied arrays.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per enqueue, dequeue, or meld
 *   Space: O(n * versions) for all retained snapshots
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One row of cells per version, one column per queue position.
 *   - The version produced by the latest operation is GREEN.
 *   - Cells copied from a source version during a meld are YELLOW.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Operation = { op: string; value?: number; version?: number; other?: number };

function makeCells(versions: number[][], latest: number): VisualEntity[] {
    const cols = Math.max(1, ...versions.map((v) => v.length));
    const cells: VisualEntity[] = [];
    versions.forEach((items, version) => {
        for (let col = 0; col < cols; col += 1) {
            const has = col < items.length;
            const value = has ? items[col]! : 0;
            const state: EntityState = has ? (version === latest ? "sorted" : "visited") : "unvisited";
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
              { op: "enqueue", value: 3, version: 0 },
              { op: "meld", version: 1, other: 3 },
              { op: "dequeue", version: 1 },
          ];
    const versions: number[][] = [[]];
    let step = 0;

    const frame = (description: string, line: number, latest: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(versions, latest),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: versions.length,
            cols: Math.max(1, ...versions.map((v) => v.length)),
            versions: versions.map((v) => [...v]),
            answer: versions.length,
        },
    });

    yield frame("Version 0 starts as an empty queue with confluent persistence.", 0, 0);

    for (const operation of ops) {
        const latest = versions.length - 1;
        const source = typeof operation.version === "number" ? operation.version : latest;
        if (source < 0 || source >= versions.length) {
            yield frame(`Version ${source} does not exist, so the operation was skipped.`, 6, latest);
            continue;
        }
        const copy = [...(versions[source] ?? [])];
        if (operation.op === "enqueue") {
            copy.push(Number(operation.value) || 0);
            versions.push(copy);
            yield frame(
                `Enqueued ${operation.value} into version ${source}, creating version ${versions.length - 1}.`,
                2,
                versions.length - 1,
            );
        } else if (operation.op === "dequeue") {
            if (copy.length > 0) copy.shift();
            versions.push(copy);
            yield frame(
                `Dequeued from version ${source}, creating version ${versions.length - 1} without touching its source.`,
                3,
                versions.length - 1,
            );
        } else if (operation.op === "meld") {
            const other = typeof operation.other === "number" ? operation.other : latest;
            if (other < 0 || other >= versions.length) {
                yield frame(`Meld source ${other} does not exist, so the meld was skipped.`, 6, latest);
                continue;
            }
            copy.push(...(versions[other] ?? []));
            versions.push(copy);
            yield frame(
                `Melded versions ${source} and ${other} into version ${versions.length - 1}.`,
                5,
                versions.length - 1,
            );
        } else {
            yield frame(`Unknown operation ${operation.op} was ignored.`, 6, latest);
        }
    }

    yield frame(`The history now holds ${versions.length} distinct, independently readable versions.`, 7, versions.length - 1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Confluent persistence removes the newest-only restriction: any snapshot can be an update target. Adding a meld operation lets two branches combine into a third snapshot. Copying the chosen source arrays into a new version keeps every branch immutable and makes the version graph a dag.",
        invariants: [
            "Every published version is immutable after creation.",
            "An update or meld always creates a new version rather than editing a source.",
            "A meld concatenates the two chosen snapshots in source-then-other order.",
        ],
        correctness:
            "Because each operation copies its source snapshots before changing anything, all existing versions keep their exact contents. An enqueue or dequeue on a copy is identical to the ephemeral operation, and a meld copies both sources in order, so the resulting snapshot matches the mathematical queue concatenation. Every operation is therefore faithful and no version is lost.",
        complexityRationale:
            "Copying and concatenating arrays of total length n takes O(n) time per operation. With v retained versions of length up to n, total space is O(n * v), which is acceptable for a small teaching history.",
        uses: [
            "Branching undo histories in collaborative editors",
            "Persistent functional queues in language runtimes",
            "Combining independently evolved data snapshots",
        ],
        references: [
            "Okasaki, Purely Functional Data Structures, Chapter 6",
            "Driscoll et al., Making Data Structures Persistent, 1989",
        ],
        workedExample:
            "Version 1 holds [1] and version 3 holds [3]. Melding version 1 with version 3 creates version 4 holding [1,3]. Version 2 still reads [1,2], so both branches remain available for later updates.",
    },
    id: "confluent-persistent-queue",
    name: "Confluent Persistent Queue",
    category: "data-structures",
    complexity: { time: "O(n) per operation", space: "O(n * versions)" },
    defaultInput: {
        ops: [
            { op: "enqueue", value: 1 },
            { op: "enqueue", value: 2 },
            { op: "enqueue", value: 3, version: 0 },
            { op: "meld", version: 1, other: 3 },
            { op: "dequeue", version: 1 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "create version zero as an empty queue",
        "for each operation in the sequence",
        "resolve the source version, defaulting to the newest",
        "copy the source queue into a fresh array",
        "on enqueue append the value to the copy",
        "on dequeue remove the front item from the copy",
        "on meld append a second chosen version to the copy",
        "publish the copy as a new version",
        "report the full version history",
    ],
};

export default module;
