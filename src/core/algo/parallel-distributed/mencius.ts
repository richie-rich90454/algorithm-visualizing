/**
 * mencius.ts - Mencius Consensus (Rotating-Leader Multi-Paxos)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mencius removes the single bottleneck of Multi-Paxos by giving every replica
 * a permanent, round-robin slice of the command slots. Replica i owns slot s
 * whenever s mod N = i. A replica with no pending command for its slot emits a
 * no-op "skip" so that other replicas are never blocked behind an idle leader.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(slots * N) messages to decide a log of slots
 *   Space: O(slots + N) for the log and the per-replica queues
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each decided slot is a bar labeled with its command or "skip".
 *   - The slot being proposed is yellow; the accepted slot turns green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Command {
    id: string;
    origin: number;
}

type Phase = "idle" | "propose" | "accept";

/** Build one bar per decided slot. */
function makeSlotBars(decided: Array<string | null>, current: number, phase: Phase): VisualEntity[] {
    return decided.map((value, index) => {
        let state: EntityState = "sorted";
        if (index === current && phase === "propose") {
            state = "comparing";
        } else if (index === current && phase === "accept") {
            state = "active";
        }
        return {
            id: `slot-${index}`,
            type: "bar" as const,
            label: value === null ? "skip" : value,
            value: value === null ? 0 : 1,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, owner: index % 3, skip: value === null },
        };
    });
}

/** Replay the deterministic round-robin slot assignment of Mencius. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; commands?: Command[] } | null) ?? {};
    const replicas =
        typeof task.replicas === "number" ? Math.max(1, Math.floor(task.replicas)) : 3;
    const commands: Command[] = Array.isArray(task.commands)
        ? task.commands.map((cmd) => ({
              id: String(cmd?.id ?? "?"),
              origin: ((Number(cmd?.origin) || 0) % replicas + replicas) % replicas,
          }))
        : [
              { id: "a", origin: 0 },
              { id: "b", origin: 0 },
              { id: "c", origin: 1 },
              { id: "d", origin: 2 },
          ];

    const queues: Command[][] = Array.from({ length: replicas }, () => []);
    for (const cmd of commands) {
        queues[cmd.origin]?.push(cmd);
    }

    const decided: Array<string | null> = [];
    let slot = 0;
    const maxSlots = commands.length * replicas + replicas;
    const log = (): string[] => decided.filter((value): value is string => value !== null);

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Starting Mencius with ${replicas} replicas and ${commands.length} queued command(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { replicas, slot: 0, decided: [], skips: 0, committed: 0 },
    };

    while (slot < maxSlots && queues.some((queue) => queue.length > 0)) {
        const owner = slot % replicas;
        const command = queues[owner]?.shift();
        decided.push(command ? command.id : null);
        const isSkip = command === undefined;
        yield {
            stepNumber: slot * 2 + 1,
            entities: makeSlotBars(decided, slot, "propose"),
            edges: [],
            description: `Slot ${slot} belongs to replica ${owner}; it proposes ${isSkip ? "a skip because its queue is empty" : `command ${command?.id}`}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                replicas,
                slot,
                owner,
                decided: log(),
                skips: decided.filter((value) => value === null).length,
                committed: 0,
            },
        };

        yield {
            stepNumber: slot * 2 + 2,
            entities: makeSlotBars(decided, slot, "accept"),
            edges: [],
            description: `A quorum accepts slot ${slot}; ${isSkip ? "the skip is recorded so others may advance" : `command ${command?.id} is committed`}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                replicas,
                slot,
                owner,
                decided: log(),
                skips: decided.filter((value) => value === null).length,
                committed: log().length,
            },
        };
        slot += 1;
    }

    yield {
        stepNumber: slot * 2 + 1,
        entities: makeSlotBars(decided, -1, "idle"),
        edges: [],
        description: `Agreed log: ${log().join(", ") || "(empty)"} across ${slot} slot(s) with ${decided.filter((value) => value === null).length} skip(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            replicas,
            slot,
            decided: log(),
            skips: decided.filter((value) => value === null).length,
            committed: log().length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of one leader deciding every slot, give each server a permanent slice of the slot numbering: server i decides slots i, i+N, i+2N, and so on. When its turn comes and it has no client request, it publishes a harmless skip rather than stalling the whole log. Requests from busy servers are therefore spread across the replicas, removing the single-leader bottleneck.",
        invariants: [
            "Replica i is the owner of exactly the slots congruent to i modulo N.",
            "A slot holds either one command from its owner's queue or a skip, never both.",
            "Once a quorum accepts a slot, its value is fixed for every replica.",
        ],
        correctness:
            "Every slot has a single owner, so two different commands are never proposed for the same slot. The Paxos ballots within a slot preserve the usual single-decree safety guarantee, so no two values can be chosen for one slot. Because an empty owner emits a skip, every slot is eventually filled; the concatenation of the non-skip values is the agreed log, identical on all correct replicas.",
        complexityRationale:
            "Deciding each slot costs one prepare and one accept round across the N replicas, so a log of m slots exchanges O(mN) messages. Storage is O(m) for the decided log plus O(N) queue heads at each replica.",
        uses: [
            "High-throughput replicated state machines where a single Paxos leader saturates",
            "Geo-distributed databases that spread proposal leadership across regions",
            "Consensus layers that must keep making progress when some replicas are idle",
        ],
        references: [
            "Mao, Jung, Morris, and Zhao, Mencius: Building Efficient Replicated State Machines for WANs, 2008",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "With three replicas, commands a and b arrive at replica 0, c at replica 1, and d at replica 2. Slot 0 (owner 0) takes a, slot 1 (owner 1) takes c, slot 2 (owner 2) takes d, and slot 3 (owner 0) takes b, producing the agreed log a, c, d, b with no skips.",
    },
    id: "mencius",
    name: "Mencius Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(slots * N)", space: "O(slots + N)" },
    defaultInput: {
        replicas: 3,
        commands: [
            { id: "a", origin: 0 },
            { id: "b", origin: 0 },
            { id: "c", origin: 1 },
            { id: "d", origin: 2 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "assign replica i to every slot s with s mod N = i",
        "for each slot in increasing order",
        "let owner = slot mod N; take its next command or a skip",
        "run a Paxos ballot to propose that value to all replicas",
        "collect a quorum of accepts and fix the slot value",
        "advance to the next slot even when the value was a skip",
        "done: concatenate the non-skip values as the agreed log",
    ],
};

export default module;
