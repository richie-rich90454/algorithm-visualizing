/**
 * hybrid-logical-clock.ts - Hybrid Logical Clock Updates
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hybrid logical clock (HLC) combines a physical wall-clock reading with a
 * logical counter so timestamps are close to real time yet still respect
 * causality across a distributed system. Each node keeps a timestamp (physical
 * part, logical part). On a local event or a send it advances the physical
 * part to the current wall clock and bumps the logical part only when the wall
 * clock has not moved ahead. On receive it takes the maximum of local and
 * remote physical parts and sets the logical part based on which was larger.
 * The result orders causally related events while staying bounded close to
 * physical time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per event
 *   Space: O(1) per node for the current timestamp
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is an event: local, send, or receive on a named node.
 *   - The cell for the updated physical or logical part is highlighted.
 *   - The final frame reports each event's timestamp and the wall-clock offset.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ClockEvent {
    kind: "local" | "send" | "receive";
    node: string;
    wall?: number;
    remote?: [number, number];
}

interface HlcInput {
    wall?: number[];
    events?: ClockEvent[];
}

interface Timestamp {
    physical: number;
    logical: number;
}

/** Advance a clock for a local event or a send at the given wall time. */
function tick(current: Timestamp, wall: number): Timestamp {
    if (wall > current.physical) {
        return { physical: Math.floor(wall), logical: 0 };
    }
    return { physical: current.physical, logical: current.logical + 1 };
}

/** Merge a remote timestamp into a local clock for a receive event. */
function receive(current: Timestamp, wall: number, remote: Timestamp): Timestamp {
    const maxPhysical = Math.max(current.physical, remote.physical, Math.floor(wall));
    let logical: number;
    if (maxPhysical === current.physical && maxPhysical === remote.physical) {
        logical = Math.max(current.logical, remote.logical) + 1;
    } else if (maxPhysical === current.physical) {
        logical = current.logical + 1;
    } else if (maxPhysical === remote.physical) {
        logical = remote.logical + 1;
    } else {
        logical = 0;
    }
    return { physical: maxPhysical, logical };
}

/** Build the table cells for one frame of the HLC trace. */
function makeCells(rows: Array<{ label: string; physical: number; logical: number }>, active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r]!;
        const values = [row.label, row.physical, row.logical, `${row.physical}.${row.logical}`];
        for (let col = 0; col < 4; col += 1) {
            entities.push({
                id: `cell-${r}-${col}`,
                type: "cell",
                label: String(values[col] ?? ""),
                value: values[col] ?? "",
                state: done ? "sorted" : r === active ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col, event: r },
            });
        }
    }
    return entities;
}

/** The hybrid logical clock generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HlcInput | null) ?? {};
    const walls: number[] = Array.isArray(task.wall) && task.wall.length > 0
        ? task.wall
        : [1, 1, 2, 2, 3, 5];
    const defaultEvents: ClockEvent[] = [
        { kind: "local", node: "A", wall: walls[0] },
        { kind: "send", node: "A", wall: walls[1] },
        { kind: "receive", node: "B", wall: walls[2], remote: [1, 1] },
        { kind: "local", node: "B", wall: walls[3] },
        { kind: "receive", node: "A", wall: walls[4], remote: [2, 1] },
        { kind: "send", node: "C", wall: walls[5] },
    ];
    const events: ClockEvent[] = Array.isArray(task.events) && task.events.length > 0
        ? task.events
        : defaultEvents;
    const clocks = new Map<string, Timestamp>();
    const rows: Array<{ label: string; physical: number; logical: number }> = [];
    let step = 0;

    const makeMeta = (done: boolean, lastKind: string, offset: number) => {
        const last = rows[rows.length - 1];
        return {
            events: rows.length,
            cols: 4,
            wall: walls.length,
            done,
            lastKind,
            physical: last?.physical ?? 0,
            logical: last?.logical ?? 0,
            maxOffset: offset,
            clocks: [...clocks].map(([node, ts]) => `${node}=${ts.physical}.${ts.logical}`),
        };
    };

    yield {
        stepNumber: step++,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Tracing ${events.length} events through a hybrid logical clock with physical wall readings.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: makeMeta(false, "init", 0),
    };

    let maxOffset = 0;
    for (let i = 0; i < events.length; i += 1) {
        const event = events[i]!;
        const wall = typeof event.wall === "number" ? Math.floor(event.wall) : (walls[i] ?? 0);
        const current = clocks.get(event.node) ?? { physical: 0, logical: 0 };
        let next: Timestamp;
        if (event.kind === "receive") {
            const remoteRaw = event.remote ?? [current.physical, current.logical];
            const remote: Timestamp = { physical: Math.floor(remoteRaw[0] ?? 0), logical: Math.max(0, Math.floor(remoteRaw[1] ?? 0)) };
            next = receive(current, wall, remote);
        } else {
            next = tick(current, wall);
        }
        clocks.set(event.node, next);
        rows.push({ label: `${event.kind}:${event.node}`, physical: next.physical, logical: next.logical });
        maxOffset = Math.max(maxOffset, Math.abs(next.physical - wall));
        yield {
            stepNumber: step++,
            entities: makeCells(rows, i, false),
            edges: [],
            description: `${event.kind} on ${event.node} at wall ${wall} produces timestamp ${next.physical}.${next.logical}.`,
            codeLineNumber: event.kind === "receive" ? 4 : 2,
            layout: "grid",
            meta: makeMeta(false, event.kind, maxOffset),
        };
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `All ${events.length} events stamped; timestamps stay within ${maxOffset} tick(s) of wall time.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: makeMeta(true, "done", maxOffset),
    };
}

/** The hybrid logical clock module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A pure logical clock keeps order but drifts far from real time, while a physical clock follows time but can go backward or tie. A hybrid clock keeps the wall time as the high part and a small counter as the low part. Normal events follow the wall clock, and only when events arrive out of order or tie does the counter advance, preserving causality.",
        invariants: [
            "If event A happens before event B, then A's timestamp is strictly less than B's.",
            "The logical part stays bounded by the maximum number of events at one physical tick.",
            "Every timestamp's physical part never decreases on a single node.",
        ],
        correctness:
            "For a local event or send, the wall reading is at least the last physical part, so either it advances and resets the counter or it ties and the counter increments; both cases make the timestamp increase. For a receive, the clock takes the maximum of local, remote, and wall time in the physical part and increments the counter whenever either source matched that maximum, so the new timestamp exceeds both the local and remote ones. Since every causal edge strictly increases the timestamp, happens-before order is preserved, and the counter only grows while physical time is tied or behind.",
        complexityRationale:
            "Each event reads the current timestamp, compares at most three physical values, and writes one new timestamp, which is constant time. Each node stores only its single current timestamp, so space is O(1) per node.",
        uses: [
            "Causally ordered timestamps in distributed databases such as CockroachDB",
            "Version vectors and conflict resolution without a central clock",
            "Event ordering in systems with imperfect but mostly synchronized clocks",
        ],
        references: [
            "Kulkarni, Demers, and Katz, Logical Physical Clocks, 2014",
            "Cockroach Labs, Living Without Atomic Clocks, 2017",
        ],
        workedExample:
            "Node A stamps a local event at wall 1 as 1.0, then a send at wall 1 as 1.1 because the wall did not advance. Node B receives the stamp 1.1 at wall 2; the wall is larger, so its clock becomes 2.0, and a local event at wall 2 becomes 2.1. When A receives the stamp 2.1 at wall 3, the wall again leads, so A advances to 3.0; every causal step produced a strictly larger timestamp.",
    },
    id: "hybrid-logical-clock",
    name: "Hybrid Logical Clock",
    category: "parallel-distributed",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        wall: [1, 1, 2, 2, 3, 5],
        events: [
            { kind: "local", node: "A", wall: 1 },
            { kind: "send", node: "A", wall: 1 },
            { kind: "receive", node: "B", wall: 2, remote: [1, 1] },
            { kind: "local", node: "B", wall: 2 },
            { kind: "receive", node: "A", wall: 3, remote: [2, 1] },
            { kind: "send", node: "C", wall: 5 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start each node with physical zero and logical zero",
        "for a local event or send read the current wall time w",
        "if w is greater than the physical part set physical to w and logical to zero",
        "otherwise keep the physical part and add one to the logical part",
        "for a receive let m be the largest of local, remote, and wall physical times",
        "set the logical part from whichever sources matched m, adding one on a tie",
        "record the timestamp for this event",
        "done: report all timestamps and the wall-clock offset",
    ],
};

export default module;
