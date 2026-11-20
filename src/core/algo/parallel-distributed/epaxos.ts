/**
 * epaxos.ts - EPaxos (Leaderless, Conflict-Based Consensus)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * EPaxos removes the fixed leader of Paxos. Any replica may propose a command
 * directly to a fast quorum. A command that has no earlier conflicting command
 * (one touching the same object with a lower sequence number) commits in one
 * round trip. Otherwise replicas detect the conflict and run a slow majority
 * phase to agree on an order before applying the command.
 *
 * This deterministic teaching simulation classifies each command as fast or
 * slow and then builds the single total execution order all replicas derive.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m log m) to order m commands; one round trip in the fast path
 *   Space: O(m) for command metadata and dependency records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per command, labeled with its object key and sequence.
 *   - Fast-path commands are green; slow-path commands are amber.
 *   - The final frame lists the agreed execution order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Command {
    id: string;
    key: string;
    seq: number;
}

export interface EPaxosData {
    count: number;
    fast: boolean[];
    order: number[];
    conflicts: number[];
}

/** Classify commands into fast/slow paths and compute the agreed order. */
export function simulateEPaxos(commands: Command[]): EPaxosData {
    const count = commands.length;
    const fast: boolean[] = commands.map((cmd, i) =>
        !commands.some((other, j) =>
            j !== i && other.key === cmd.key &&
            (other.seq < cmd.seq || (other.seq === cmd.seq && j < i)),
        ),
    );
    const order = commands
        .map((cmd, index) => ({ cmd, index }))
        .sort((a, b) =>
            a.cmd.seq - b.cmd.seq ||
            a.cmd.key.localeCompare(b.cmd.key) ||
            a.index - b.index,
        )
        .map((entry) => entry.index);
    const conflicts = commands.map((_, i) => fast[i] ? 0 : 1);
    return { count, fast, order, conflicts };
}

/** Grid cells, one per command. */
function makeCells(commands: Command[], states: EntityState[]): VisualEntity[] {
    return commands.map((cmd, index) => ({
        id: `cmd-${index}`,
        type: "cell" as const,
        label: `${cmd.key}:${cmd.seq}`,
        value: cmd.id,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, key: cmd.key, seq: cmd.seq, row: Math.floor(index / 4), col: index % 4 },
    }));
}

/** The EPaxos generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { commands?: Command[] } | null) ?? {};
    const commands: Command[] = Array.isArray(task.commands) && task.commands.length > 0
        ? task.commands.map((c, i) => ({
            id: typeof c?.id === "string" ? c.id : `c${i}`,
            key: typeof c?.key === "string" ? c.key : "x",
            seq: typeof c?.seq === "number" ? c.seq : i,
        }))
        : [
            { id: "a", key: "x", seq: 1 },
            { id: "b", key: "y", seq: 2 },
            { id: "c", key: "x", seq: 3 },
            { id: "d", key: "z", seq: 4 },
        ];
    const data = simulateEPaxos(commands);
    const idle = (): EntityState[] => Array<EntityState>(data.count).fill("idle");

    yield {
        stepNumber: 0,
        entities: makeCells(commands, idle()),
        edges: [],
        description: `EPaxos over ${data.count} commands; a replica proposes each command directly without electing a leader.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { count: data.count, fastCount: data.fast.filter(Boolean).length, phase: "setup" },
    };

    const fastStates = data.fast.map((isFast) => (isFast ? "sorted" : "idle"));
    yield {
        stepNumber: 1,
        entities: makeCells(commands, fastStates),
        edges: [],
        description: `Fast path: ${data.fast.filter(Boolean).length} command(s) have no earlier conflicting command and commit in one round trip.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { count: data.count, fastCount: data.fast.filter(Boolean).length, phase: "fast" },
    };

    const slowStates = idle().map((_, i) => (data.fast[i] ? "sorted" : "comparing"));
    yield {
        stepNumber: 2,
        entities: makeCells(commands, slowStates),
        edges: [],
        description: `${data.conflicts.filter(Boolean).length} conflicting command(s) need the slow majority phase to fix their order.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { count: data.count, slowCount: data.conflicts.filter(Boolean).length, phase: "slow" },
    };

    const finalStates = idle().map((_, i) => (data.fast[i] ? "sorted" : "active"));
    yield {
        stepNumber: 3,
        entities: makeCells(commands, finalStates),
        edges: [],
        description: `All replicas agree on the execution order ${data.order.map((i) => commands[i]?.id).join(" -> ")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { count: data.count, order: data.order, phase: "done" },
    };
}

/** The EPaxos module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of electing a leader, let every replica propose commands. If a command touches an object that no earlier concurrent command touches, a fast quorum can accept it right away. When two commands conflict, replicas exchange their dependency records and run one extra majority round so everyone applies them in the same order.",
        invariants: [
            "Commands touching the same object key are the only ones that conflict.",
            "The first command for a key by sequence number can use the fast path.",
            "Every replica derives the same total order from sequence numbers.",
        ],
        correctness:
            "Two conflicting commands cannot both commit on the fast path because only the earliest one for a key qualifies; any later one runs the slow path. The slow phase collects a majority that has seen the earlier command, so the dependency is preserved. Ordering by sequence number with deterministic tie-breaks gives every replica the same sequence, which satisfies agreement and ensures conflicting commands are applied consistently.",
        complexityRationale:
            "A fast-path command needs one round trip to a fast quorum, O(N) messages; a conflicting command adds a majority round. Sorting m commands costs O(m log m). The state is a dependency record per command, O(m).",
        uses: [
            "Geo-replicated databases that want low latency without a single leader bottleneck",
            "Systems such as Facebook's EPaxos-based stores that tolerate conflicting concurrent writes",
            "Teaching leaderless consensus and conflict ordering",
        ],
        references: [
            "Moraru, Andersen, and Kaminsky, There Is More Consensus in Egalitarian Parliaments, 2013",
            "Lamport, The Part-Time Parliament, 1998",
        ],
        workedExample:
            "Commands a(key x, seq 1), b(key y, seq 2), c(key x, seq 3), and d(key z, seq 4) produce fast paths for a, b, and d because each is first for its key. Command c conflicts with a, so it takes the slow path. The agreed order is a, b, c, d by sequence number.",
    },
    id: "epaxos",
    name: "EPaxos",
    category: "parallel-distributed",
    complexity: { time: "O(m log m) ordering", space: "O(m)" },
    defaultInput: {
        commands: [
            { id: "a", key: "x", seq: 1 },
            { id: "b", key: "y", seq: 2 },
            { id: "c", key: "x", seq: 3 },
            { id: "d", key: "z", seq: 4 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each command choose a fast quorum and broadcast it",
        "if no earlier command touches the same object commit on the fast path",
        "otherwise record the conflicting dependencies",
        "run a majority slow phase to fix an order for conflicts",
        "order all commands by sequence number with stable tie-breaks",
        "apply commands in that order at every replica",
        "done: report the agreed execution order",
    ],
};

export default module;
