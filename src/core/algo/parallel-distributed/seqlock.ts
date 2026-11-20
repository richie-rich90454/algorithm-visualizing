/**
 * seqlock.ts - Sequence Lock with Optimistic Reads
 *
 * A writer increments a sequence counter to an odd value before updating data
 * and to an even value afterwards. A reader samples the counter before and
 * after copying the data; if the counter changed or was odd, the copy is
 * discarded and retried. This lets readers proceed without blocking the writer.
 *
 * The deterministic simulation interleaves one read with each write so that a
 * torn snapshot is always detected. It does not model real memory reordering,
 * acquire/release fences, or multiple concurrent writers.
 *
 * Time:  O(reads * dataSize), each read retried at most once here
 * Space: O(dataSize) for the reader snapshot
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    initial?: number[];
    updates?: number[][];
}

function makeBars(data: number[], snapshot: number[], active: number): VisualEntity[] {
    return data.map((value, i) => ({
        id: `slot-${i}`,
        type: "bar" as const,
        label: `${value} / read ${snapshot[i] ?? "-"}`,
        value,
        state: i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, stored: value, snapshot: snapshot[i] ?? null },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const initial = Array.isArray(task.initial) && task.initial.length > 0
        ? task.initial.map((v) => Number(v))
        : [1, 2, 3];
    const updates = Array.isArray(task.updates) && task.updates.length > 0
        ? task.updates.map((row) => row.map((v) => Number(v)))
        : [[4, 5, 6], [7, 8, 9]];

    let data = [...initial];
    let seq = 0;
    let reads = 0;
    let retries = 0;
    const accepted: number[][] = [];
    let step = 0;

    const metaFor = (phase: string, snapshot: number[], ok: boolean | null) => ({
        phase,
        sequence: seq,
        data: [...data],
        snapshot: [...snapshot],
        reads,
        retries,
        accepted: accepted.map((a) => [...a]),
        snapshotValid: ok,
    });

    yield {
        stepNumber: step,
        entities: makeBars(data, [], -1),
        edges: [],
        description: `Sequence lock initialized with an even counter ${seq} and data ${data.join(", ")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("init", [], null),
    };
    step += 1;

    for (const update of updates) {
        const before = seq;
        const snapshot = [...data];
        reads += 1;

        yield {
            stepNumber: step,
            entities: makeBars(data, snapshot, -1),
            edges: [],
            description: `Reader ${reads} sees even sequence ${before} and copies snapshot ${snapshot.join(", ")}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: metaFor("read-start", snapshot, null),
        };
        step += 1;

        seq += 1;
        yield {
            stepNumber: step,
            entities: makeBars(data, snapshot, -1),
            edges: [],
            description: `Writer raises the sequence to odd ${seq} before touching the data; readers must now retry.`,
            codeLineNumber: 5,
            layout: "array",
            meta: metaFor("writer-lock", snapshot, null),
        };
        step += 1;

        data = [...update];
        yield {
            stepNumber: step,
            entities: makeBars(data, snapshot, -1),
            edges: [],
            description: `Writer updates the data to ${data.join(", ")} while the sequence is still odd.`,
            codeLineNumber: 6,
            layout: "array",
            meta: metaFor("writer-update", snapshot, null),
        };
        step += 1;

        seq += 1;
        retries += 1;
        yield {
            stepNumber: step,
            entities: makeBars(data, snapshot, -1),
            edges: [],
            description: `Reader finds sequence ${seq} differs from ${before}, discards the torn snapshot, and retries.`,
            codeLineNumber: 3,
            layout: "array",
            meta: metaFor("retry", snapshot, false),
        };
        step += 1;

        const freshSnapshot = [...data];
        yield {
            stepNumber: step,
            entities: makeBars(data, freshSnapshot, -1),
            edges: [],
            description: `Reader rechecks sequence ${seq} before and after the copy; both are equal, so snapshot ${freshSnapshot.join(", ")} is accepted.`,
            codeLineNumber: 4,
            layout: "array",
            meta: metaFor("accept", freshSnapshot, true),
        };
        step += 1;
        accepted.push(freshSnapshot);
    }

    yield {
        stepNumber: step,
        entities: makeBars(data, [], -1),
        edges: [],
        description: `${reads} read(s) completed with ${retries} retry(ies); every accepted snapshot was a consistent writer value.`,
        codeLineNumber: 8,
        layout: "array",
        meta: metaFor("done", [], null),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of locking readers out, a sequence lock lets them copy data optimistically. The writer flips a counter to odd while it is changing the data and back to even when done. A reader checks the counter twice around its copy. If the two values match and are even, no write overlapped, so the copy is valid; otherwise it throws the copy away and tries again.",
        invariants: [
            "The sequence counter is odd exactly while the writer is updating data.",
            "A reader accepts a snapshot only when the before and after counters are equal and even.",
            "Every accepted snapshot equals one complete writer value, never a mixture.",
        ],
        correctness:
            "If the counter is even and unchanged across a read, the writer did not execute its odd-phase during the copy, so the data could not have changed and the snapshot is consistent. If the writer updates during the copy, it must pass through an odd value or change the counter, which the second check detects, forcing a retry. Because the sequence is incremented on both entry and exit, it eventually becomes even again and a retry succeeds.",
        complexityRationale:
            "A read copies the data and checks the counter a constant number of times, so it is O(dataSize) per attempt; a writer also performs O(dataSize) work. The reader keeps one snapshot, giving O(dataSize) space.",
        uses: [
            "Read-mostly shared data structures in operating-system kernels",
            "Lock-free publication of statistics and configuration snapshots",
            "Low-overhead reads where writers are rare",
        ],
        references: [
            "Lameter, Seqlocks: Fast and Lightweight Synchronization, Linux Journal, 2005",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
        ],
        workedExample:
            "Data starts at 1, 2, 3 with sequence 0. A reader copies the values, then the writer raises the sequence to 1 and changes the data to 4, 5, 6. The reader sees sequence 2 on recheck, rejects the mixed copy, retries, and accepts 4, 5, 6 with both checks reading 2.",
    },
    id: "seqlock",
    name: "Sequence Lock (Seqlock)",
    category: "parallel-distributed",
    complexity: { time: "O(dataSize) per operation", space: "O(dataSize)" },
    defaultInput: { initial: [1, 2, 3], updates: [[4, 5, 6], [7, 8, 9]] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the sequence counter to an even value",
        "reader records the sequence before copying data",
        "writer raises the sequence to odd before an update",
        "writer changes the data and raises the sequence to even",
        "reader records the sequence after copying data",
        "if the two counters differ or are odd, retry the read",
        "otherwise accept the snapshot as consistent",
        "repeat for each scheduled write and read",
        "done: report accepted snapshots and retry count",
    ],
};

export default module;
