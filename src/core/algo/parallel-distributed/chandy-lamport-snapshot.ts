/**
 * chandy-lamport-snapshot.ts - Chandy-Lamport Distributed Snapshot
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Chandy-Lamport algorithm records a consistent global state of a
 * distributed system without stopping it. An initiator records its own state
 * and sends a marker on every outgoing channel. Each process records its state
 * the first time it sees a marker and records the messages arriving on every
 * other channel until a marker arrives there. Once every channel has been
 * recorded the snapshot is complete.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e) marker messages for e channels
 *   Space: O(p + e) for p process states and e channel records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Processes are graph nodes arranged on a directed ring of channels.
 *   - A node recording its state turns yellow, then green when complete.
 *   - The channel carrying the current marker is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Build the process nodes with their recorded local values. */
function makeNodes(
    values: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `process-${index}`,
        type: "node" as const,
        label: `P${index}:${value}`,
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: "process", index, localValue: value },
    }));
}

/** Build the directed ring channels, highlighting the active one. */
function makeEdges(n: number, active: number | null, state: EntityState): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < n; i += 1) {
        edges.push({
            id: `channel-${i}`,
            sourceId: `process-${i}`,
            targetId: `process-${(i + 1) % n}`,
            label: "marker",
            state: i === active ? state : "idle",
            directed: true,
        });
    }
    return edges;
}

/** The Chandy-Lamport snapshot generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Math.trunc(Number(v) || 0))
        : [4, 7, 2, 5];
    const n = values.length;
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeNodes(values, new Map()),
        edges: makeEdges(n, null, "idle"),
        description: `Recording a snapshot of ${n} processes connected by a directed ring of channels.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {
            recorded: new Array<number>(n).fill(0),
            snapshotSum: 0,
            markersSent: 0,
            phase: "setup",
        },
    };
    frame += 1;

    const recorded = new Array<number>(n).fill(0);
    let markersSent = 0;
    for (let i = 0; i < n; i += 1) {
        recorded[i] = values[i] ?? 0;
        markersSent += 1;
        const states = new Map<number, EntityState>();
        for (let j = 0; j < i; j += 1) {
            states.set(j, "sorted");
        }
        states.set(i, "comparing");
        yield {
            stepNumber: frame,
            entities: makeNodes(values, states),
            edges: makeEdges(n, i, "active"),
            description: `Process ${i} records its local value ${values[i]} on first marker and forwards the marker.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: {
                recorded: [...recorded],
                snapshotSum: recorded.reduce((a, b) => a + b, 0),
                markersSent,
                phase: "recording",
            },
        };
        frame += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        finalStates.set(i, "sorted");
    }
    const sum = recorded.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: frame,
        entities: makeNodes(values, finalStates),
        edges: makeEdges(n, null, "sorted"),
        description: `Snapshot complete: every channel recorded, captured sum ${sum} from ${markersSent} marker(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { recorded: [...recorded], snapshotSum: sum, markersSent, phase: "done" },
    };
}

/** The Chandy-Lamport snapshot module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Take a photograph of a distributed system without pausing it. A marker travels along the channels; the first time a process sees one it writes down its own state, and it keeps recording anything arriving on other channels until their markers show up. The markers trace a consistent cut through the computation.",
        invariants: [
            "Each process records its local state exactly once, at its first marker.",
            "A channel is recorded once, when a marker arrives on it.",
            "The captured local values sum to the total present at the cut.",
        ],
        correctness:
            "The marker protocol ensures that any application message sent before a process records its state is included either in the sender's channel record or in the receiver's local state, but never missed or duplicated. The set of process states and channel records therefore forms a consistent cut: it is a global state the system could actually have passed through. With no application messages in flight this toy, the recorded values sum exactly to the initial total.",
        complexityRationale:
            "An initiator sends one marker per outgoing channel and each process forwards one on each channel, so O(e) markers for e channels. The snapshot stores one state per process and one message log per channel, which is O(p + e) space.",
        uses: [
            "Checkpointing long-running distributed computations",
            "Consistent monitoring and debugging of message-passing systems",
            "Recovering a global state after a failure",
        ],
        references: [
            "Chandy and Lamport, Distributed Snapshots: Determining Global States of Distributed Systems, 1985",
            "Mattern, Virtual Time and Global States of Distributed Systems, 1989",
        ],
        workedExample:
            "Four processes hold values 4, 7, 2, 5 on a ring. Process 0 starts, records 4, and sends a marker onward. Each successor records its value in turn. The completed snapshot is [4, 7, 2, 5] with sum 18.",
    },
    id: "chandy-lamport-snapshot",
    name: "Chandy-Lamport Snapshot",
    category: "parallel-distributed",
    complexity: { time: "O(e)", space: "O(p + e)" },
    defaultInput: { values: [4, 7, 2, 5] },
    visualType: "graph",
    run,
    pseudocode: [
        "initiator records its own local state",
        "initiator sends a marker on every outgoing channel",
        "on first marker a process records its local state",
        "the process forwards markers on all outgoing channels",
        "on later channels record messages until a marker arrives",
        "a channel is complete once its marker is seen",
        "when all channels are complete the snapshot is done",
        "done: report the recorded global state",
    ],
};

export default module;
