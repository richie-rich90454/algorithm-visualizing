/**
 * token-ring-mutual-exclusion.ts - Token-Ring Mutual Exclusion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a token-ring mutual exclusion protocol a single permission token circulates
 * around a logical ring. A process may enter its critical section only while it
 * holds the token, then releases the token to its successor. Because there is
 * exactly one token, mutual exclusion is immediate; because the token keeps
 * circulating, every process eventually gets a turn.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) message passes per full tour of the ring
 *   Space: O(1) beyond the token and the ring membership
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Processes sit on a circle with directed ring edges.
 *   - The token holder glows while inside the critical section.
 *   - A pass to the successor lights up the traversed edge.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

/** Place N processes on a circle, coloring the holder and past visitors. */
function makeNodes(count: number, holder: number, visited: Set<number>): VisualEntity[] {
    return Array.from({ length: count }, (_, index) => {
        const angle = (2 * Math.PI * index) / count - Math.PI / 2;
        let state: EntityState = "idle";
        if (index === holder) {
            state = "active";
        } else if (visited.has(index)) {
            state = "sorted";
        }
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `P${index}`,
            value: index,
            state,
            x: 300 + 190 * Math.cos(angle),
            y: 300 + 190 * Math.sin(angle),
            width: 0,
            height: 0,
            metadata: { index, holder: index === holder },
        };
    });
}

/** Build directed ring edges, highlighting the most recent pass. */
function makeEdges(count: number, from: number): VisualEdge[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `edge-${index}-${(index + 1) % count}`,
        sourceId: `node-${index}`,
        targetId: `node-${(index + 1) % count}`,
        label: "",
        state: index === from ? "path" : "idle",
        directed: true,
    }));
}

/** Replay token passes around the ring for a number of complete rounds. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: number; rounds?: number } | null) ?? {};
    const processes =
        typeof task.processes === "number" ? Math.max(2, Math.floor(task.processes)) : 4;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 2;
    const entries = Array.from({ length: processes }, () => 0);
    const visited = new Set<number>();
    let holder = 0;
    let step = 1;

    yield {
        stepNumber: 0,
        entities: makeNodes(processes, holder, visited),
        edges: makeEdges(processes, -1),
        description: `Token starts at process 0 on a ring of ${processes} process(es).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { holder, passes: 0, rounds, entries: entries.slice(), inCS: -1 },
    };

    for (let round = 0; round < rounds; round += 1) {
        for (let index = 0; index < processes; index += 1) {
            const owner = holder;
            holder = owner;
            visited.add(owner);
            entries[owner] = (entries[owner] ?? 0) + 1;
            yield {
                stepNumber: step,
                entities: makeNodes(processes, holder, visited),
                edges: makeEdges(processes, -1),
                description: `Round ${round + 1}: process ${owner} holds the token and enters the critical section (visit ${entries[owner]}).`,
                codeLineNumber: 2,
                layout: "point",
                meta: { holder, passes: round * processes + index, rounds, entries: entries.slice(), inCS: owner },
            };
            step += 1;

            const successor = (owner + 1) % processes;
            yield {
                stepNumber: step,
                entities: makeNodes(processes, successor, visited),
                edges: makeEdges(processes, owner),
                description: `Process ${owner} leaves the section and passes the token to process ${successor}.`,
                codeLineNumber: 4,
                layout: "point",
                meta: { holder: successor, passes: round * processes + index + 1, rounds, entries: entries.slice(), inCS: -1 },
            };
            step += 1;
            holder = successor;
        }
    }

    yield {
        stepNumber: step,
        entities: makeNodes(processes, holder, new Set(Array.from({ length: processes }, (_, i) => i))),
        edges: makeEdges(processes, -1),
        description: `After ${rounds} round(s) each process entered ${rounds} time(s); the token rests at process ${holder}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { holder, passes: rounds * processes, rounds, entries: entries.slice(), inCS: -1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give the group exactly one ticket. Whoever currently holds the ticket may use the shared resource; everyone else waits. When finished, the holder hands the ticket to the next process in a fixed order. With only one ticket in circulation, two processes can never be inside at once, and the fixed order guarantees nobody is skipped forever.",
        invariants: [
            "Exactly one token exists, held by at most one process at any time.",
            "A process enters the critical section only while it holds the token.",
            "The token visits processes in a fixed cyclic order.",
        ],
        correctness:
            "Mutual exclusion follows directly from the uniqueness of the token: only its holder may be inside, so two processes cannot be inside together. Progress follows from the ring order: after a process returns the token, every other process receives it within N - 1 passes, so a process that requests entry waits at most one full tour. No process depends on a shared flag, so the protocol also tolerates message loss through token regeneration in practical implementations.",
        complexityRationale:
            "One critical-section visit ends with a single token pass to the successor, so a full tour uses N passes; entry latency is at most O(N). Storage is O(1) beyond the ring membership and the token itself.",
        uses: [
            "Mutual exclusion in token-ring networks and token-bus fieldbuses",
            "Database cache-coherence protocols based on a circulating token",
            "Distributed locking where fairness must be strictly ordered",
        ],
        references: [
            "Lamport, A Solution to the Mutual Exclusion Problem, 1986",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 6",
        ],
        workedExample:
            "On a ring P0, P1, P2, P3 with the token at P0, P0 enters and passes to P1; P1 enters and passes to P2; P2 enters and passes to P3; P3 enters and passes back to P0. After one round each process has entered exactly once and at no point were two processes inside.",
    },
    id: "token-ring-mutual-exclusion",
    name: "Token-Ring Mutual Exclusion",
    category: "parallel-distributed",
    complexity: { time: "O(N) per tour", space: "O(1)" },
    defaultInput: { processes: 4, rounds: 2 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize the ring and place the single token at process zero",
        "for each process in the current tour",
        "the token holder enters the critical section",
        "the holder leaves and sends the token to its successor",
        "the successor becomes the holder for the next step",
        "repeat for the requested number of full tours",
        "done: every process entered once per tour with no overlap",
    ],
};

export default module;
