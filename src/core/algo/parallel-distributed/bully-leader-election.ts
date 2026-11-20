/**
 * bully-leader-election.ts - Bully Leader Election
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In the bully algorithm every process has a unique numeric identifier and any
 * process can start an election. The initiator sends election messages to all
 * higher-identified processes. Each one that replies takes over the election,
 * so only the highest identified process that is still alive receives no reply
 * and declares itself coordinator. It then announces its win to the others.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) messages in the worst case for n processes
 *   Space: O(n) for the alive set and the message log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Processes are cells ordered by identifier.
 *   - Failed processes are red, the active initiator is yellow.
 *   - Responding processes are purple, the elected coordinator is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one process cell. */
function makeCells(
    ids: number[],
    down: Set<number>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return ids.map((id, index) => ({
        id: `process-${id}`,
        type: "cell" as const,
        label: String(id),
        value: id,
        state: states.get(id) ?? (down.has(id) ? "error" : "unvisited"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, processId: id },
    }));
}

/** The bully leader election generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { processIds?: number[]; down?: number[]; initiator?: number } | null
    ) ?? {};
    const ids = Array.isArray(task.processIds) ? [...task.processIds] : [0, 1, 2, 3, 4];
    const down = new Set<number>(Array.isArray(task.down) ? task.down : [2]);
    const initiator = typeof task.initiator === "number" ? task.initiator : 1;

    const alive = ids.filter((id) => !down.has(id));
    const coordinator = alive.length > 0 ? Math.max(...alive) : -1;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(ids, down),
        edges: [],
        description: `Election started by process ${initiator} among ${ids.length} processes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: ids.length, coordinator: -1, messages: 0 },
    };
    step += 1;

    let messages = 0;
    if (down.has(initiator) || alive.length === 0) {
        const currentStates = new Map<number, EntityState>();
        for (const id of alive) {
            currentStates.set(id, id === coordinator ? "sorted" : "visited");
        }
        yield {
            stepNumber: step,
            entities: makeCells(ids, down, currentStates),
            edges: [],
            description:
                coordinator === -1
                    ? "No process is alive, so there is no coordinator."
                    : `Process ${initiator} is down; the current coordinator is ${coordinator}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows: 1, cols: ids.length, coordinator, messages },
        };
        return;
    }

    const initiatorStates = new Map<number, EntityState>([[initiator, "active"]]);
    yield {
        stepNumber: step,
        entities: makeCells(ids, down, initiatorStates),
        edges: [],
        description: `Process ${initiator} sends ELECTION to every higher-identified process.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 1, cols: ids.length, coordinator: -1, messages: 0 },
    };
    step += 1;

    for (const id of ids.filter((value) => value > initiator && !down.has(value))) {
        messages += 1;
        const states = new Map<number, EntityState>([[id, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(ids, down, states),
            edges: [],
            description: `Process ${id} replies OK and starts its own election.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: 1, cols: ids.length, coordinator: -1, messages },
        };
        step += 1;
    }

    messages += 1;
    const finalStates = new Map<number, EntityState>();
    for (const id of alive) {
        finalStates.set(id, id === coordinator ? "sorted" : "visited");
    }
    yield {
        stepNumber: step,
        entities: makeCells(ids, down, finalStates),
        edges: [],
        description: `Process ${coordinator} received no reply from a higher process and is the new coordinator.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: ids.length, coordinator, messages },
    };
}

/** The bully leader election module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A lower-identified process cannot win while a higher one is alive, so it asks every higher process to take over. Each one that answers starts its own election. The process that gets no answer from anyone above it is the largest surviving identifier and becomes coordinator.",
        invariants: [
            "A process with a lower identifier never overrules a higher one that is alive.",
            "Only a process that receives no reply from a higher process may declare victory.",
            "Failed processes never reply to election messages.",
        ],
        correctness:
            "Let m be the largest identifier among alive processes. Any other alive process sends to m, so m receives a message and takes part. Since no alive process has an identifier above m, m gets no reply from a higher process and wins. No other process can win because it would have to receive a reply from m.",
        complexityRationale:
            "In the worst case each process sends an election to every higher process, so O(n^2) messages are exchanged. The alive set and the message log use O(n) space.",
        uses: [
            "Coordinator selection in distributed databases",
            "Leader choice in replicated services",
            "Classical consensus teaching examples",
        ],
        references: [
            "Garcia-Molina, Elections in a Distributed Computing System, 1982",
            "Lamport, On Distributed Communications Networks, 1964",
        ],
        workedExample:
            "With processes 0 through 4, process 2 down, and initiator 1, process 1 asks 3 and 4. Both reply and start elections; 4 gets no reply from a higher process and becomes coordinator.",
    },
    id: "bully-leader-election",
    name: "Bully Leader Election",
    category: "parallel-distributed",
    complexity: { time: "O(n^2) messages", space: "O(n)" },
    defaultInput: { processIds: [0, 1, 2, 3, 4], down: [2], initiator: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "mark each process as alive or failed",
        "let the initiator send ELECTION to higher identifiers",
        "for each higher alive process that responds",
        "that process takes over and starts its own election",
        "a process with no higher responder wins",
        "the winner broadcasts COORDINATOR to the others",
        "done: report the elected coordinator",
    ],
};

export default module;
