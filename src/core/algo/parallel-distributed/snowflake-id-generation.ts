/**
 * snowflake-id-generation.ts - Snowflake Distributed ID Generation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Snowflake produces a 64-bit integer ID without coordination between machines.
 * The bits are packed as a sign bit, a timestamp in milliseconds since a custom
 * epoch, a machine (worker) id, and a per-millisecond sequence counter. When
 * several IDs are requested in the same millisecond the counter increments; if
 * the counter fills, the generator waits for the next millisecond. Because the
 * high-order bits are the timestamp, IDs are roughly sortable by creation time.
 * This module is a deterministic teaching simulation of that bit layout and
 * rollover logic; it is not a production clock or worker registry.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per identifier, O(k) for k identifiers
 *   Space: O(k) for the emitted identifiers and their decoded fields
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per generated id shows its numeric value scaled to the array.
 *   - The newest id is highlighted yellow, finished ids are green.
 *   - The bit fields of each id are decoded and reported in the metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SnowflakeInput {
    workerId?: number;
    workerBits?: number;
    seqBits?: number;
    epoch?: number;
    now?: number;
    count?: number;
}

/** The fixed bit allocation used by this teaching simulation. */
const TIME_BITS = 41;

/** Decode the timestamp, worker id, and sequence from a packed id. */
function decode(id: number, workerBits: number, seqBits: number, epoch: number) {
    const seqMask = (1 << seqBits) - 1;
    const workerMask = (1 << workerBits) - 1;
    const sequence = id & seqMask;
    const worker = (id >>> seqBits) & workerMask;
    // Timestamp is O(2^41) and cannot be held exactly in a 32-bit shift; use division.
    const timestamp = Math.floor(id / (2 ** seqBits * 2 ** workerBits)) + epoch;
    return { timestamp, worker, sequence };
}

/** Build bars for the generated identifiers. */
function makeBars(ids: number[], current: number, done: boolean): VisualEntity[] {
    return ids.map((id, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${id}`,
            value: id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, id },
        };
    });
}

/** The Snowflake simulation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SnowflakeInput | null) ?? {};
    const workerBits = typeof task.workerBits === "number" ? Math.max(1, Math.min(10, Math.floor(task.workerBits))) : 5;
    const seqBits = typeof task.seqBits === "number" ? Math.max(1, Math.min(12, Math.floor(task.seqBits))) : 12;
    const maxWorker = (1 << workerBits) - 1;
    const maxSeq = (1 << seqBits) - 1;
    const workerId = typeof task.workerId === "number"
        ? Math.max(0, Math.min(maxWorker, Math.floor(task.workerId)))
        : 1;
    // A custom epoch near "now" keeps the millisecond delta small enough that the
    // packed id stays exact in JavaScript's double-precision number type.
    const epoch = typeof task.epoch === "number" ? task.epoch : 1699999999000;
    const count = typeof task.count === "number" ? Math.max(1, Math.min(16, Math.floor(task.count))) : 5;
    let now = typeof task.now === "number" && Number.isFinite(task.now) ? Math.floor(task.now) : 1700000000000;

    const workerShift = seqBits;
    const timeShift = seqBits + workerBits;
    const maxDelta = Math.floor((2 ** 53 - 1 - maxWorker * 2 ** workerShift - maxSeq) / 2 ** timeShift);
    let lastTimestamp = -1;
    let sequence = 0;
    const ids: number[] = [];
    const fields: Array<ReturnType<typeof decode>> = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(ids, -1, false),
        edges: [],
        description: `Worker ${workerId} uses ${TIME_BITS} timestamp bits, ${workerBits} worker bits, and ${seqBits} sequence bits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { workerId, workerBits, seqBits, epoch, count, ids: [], fields: [], wraps: 0 },
    };
    step += 1;

    let wraps = 0;
    for (let i = 0; i < count; i += 1) {
        if (now < lastTimestamp) {
            now = lastTimestamp;
        }
        if (now === lastTimestamp) {
            sequence += 1;
            if (sequence > maxSeq) {
                sequence = 0;
                now += 1;
                wraps += 1;
            }
        } else {
            sequence = 0;
        }
        lastTimestamp = now;

        const deltaRaw = now - epoch;
        const delta = Math.max(0, Math.min(maxDelta, deltaRaw));
        const id = delta * 2 ** timeShift + workerId * 2 ** workerShift + sequence;
        ids.push(id);
        fields.push(decode(id, workerBits, seqBits, epoch));

        yield {
            stepNumber: step,
            entities: makeBars(ids, i, false),
            edges: [],
            description: `Generated id ${id}: timestamp ${now}, worker ${workerId}, sequence ${sequence}${sequence === 0 && wraps > 0 ? " (sequence rolled over)" : ""}.`,
            codeLineNumber: sequence === 0 && i > 0 ? 5 : 4,
            layout: "array",
            meta: {
                workerId,
                workerBits,
                seqBits,
                epoch,
                count,
                ids: [...ids],
                fields: JSON.stringify(fields),
                wraps,
                lastTimestamp,
                sequence,
            },
        };
        step += 1;
    }

    const increasing = ids.every((id, index) => index === 0 || id > ids[index - 1]!);
    yield {
        stepNumber: step,
        entities: makeBars(ids, count - 1, true),
        edges: [],
        description: `Generated ${count} ids across worker ${workerId}; strictly increasing: ${increasing}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            workerId,
            workerBits,
            seqBits,
            epoch,
            count,
            ids: [...ids],
            fields: JSON.stringify(fields),
            wraps,
            increasing,
        },
    };
}

/** The Snowflake ID generation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A distributed system cannot afford a single counter that every machine must ask, so Snowflake splits one integer into fields that different sources own. The timestamp supplies the high bits, a worker id separates machines, and a small counter separates IDs created in the same millisecond. Because the timestamp sits at the top, the resulting integers increase with time and can be sorted cheaply.",
        invariants: [
            "The sequence counter stays between zero and two to the sequence bits minus one.",
            "The worker id fits in the configured worker bits.",
            "IDs are strictly increasing within one worker as long as the clock does not move backward.",
        ],
        correctness:
            "Two IDs from the same worker are distinguished by either their timestamp or their sequence number, so they cannot collide. Two IDs from different workers carry different worker fields, so they cannot collide either. Since the timestamp occupies the most significant field, a later timestamp always yields a larger id, which gives the approximate sort order. When the sequence fills, advancing the logical clock by one millisecond and resetting the counter preserves monotonicity and avoids a collision.",
        complexityRationale:
            "Generating one id reads the clock, increments a counter, and combines a few bit fields, all constant work. Storing k ids and their decoded fields costs O(k) space.",
        uses: [
            "Primary keys for sharded databases such as Twitter's timeline storage",
            "Trace and event identifiers in distributed systems",
            "Orderable identifiers that avoid a central coordinator",
        ],
        references: [
            "Twitter, Snowflake: A Network Service for Generating Unique ID Numbers, 2010",
            "Kleppmann, Designing Data-Intensive Applications, Chapter 8",
        ],
        workedExample:
            "With worker id 1, five worker bits, and twelve sequence bits, a request at timestamp T yields T minus epoch shifted left seventeen bits, plus 1 shifted left twelve bits, plus sequence zero. Two more ids in the same millisecond use sequence one and two. If the counter reached 4095, the next id would advance the timestamp by one and reset the sequence to zero.",
    },
    id: "snowflake-id-generation",
    name: "Snowflake ID Generation",
    category: "parallel-distributed",
    complexity: { time: "O(1) per id", space: "O(k)" },
    defaultInput: { workerId: 1, workerBits: 5, seqBits: 12, epoch: 1699999999000, now: 1700000000000, count: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the worker id, bit widths, epoch, and count",
        "set the last timestamp and sequence counter to zero",
        "for each requested identifier",
        "if the clock equals the last timestamp, increment the sequence",
        "otherwise reset the sequence to zero",
        "if the sequence overflows, advance the clock and reset it",
        "pack timestamp, worker id, and sequence into one integer",
        "decode the fields and emit a frame",
        "done: report all ids and confirm they increase",
    ],
};

export default module;
