/**
 * uniform-broadcast.ts - Uniform Reliable Broadcast (Echo / Ready)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Uniform reliable broadcast guarantees that if any correct process delivers a
 * message, every correct process delivers it. Each process echoes the message
 * to the group and emits a ready hint once it has seen enough echoes. A process
 * delivers only after collecting two f plus one echoes or ready hints. Because
 * at most f processes are faulty, at least one correct process must have echoed
 * before any delivery, and that process keeps the witness alive for everyone.
 *
 * This deterministic model counts echoes and ready hints and applies the
 * thresholds; it does not simulate network scheduling, signatures, or adaptive
 * Byzantine behavior.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages per phase for n processes
 *   Space: O(n) for the per-process echo and ready sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The sender and processes are nodes; directed edges carry each phase.
 *   - A delivered message is green, a missing echo is red, ready is yellow.
 *   - The final frame is green for all correct processes or red for none.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input {
    processes?: number;
    faults?: number;
    senderHonest?: boolean;
    deliveredTo?: number;
}

function makeNodes(n: number, states: EntityState[]): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: i === 0 ? "S" : `P${i}`,
        value: i,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: i === 0 ? "sender" : "process", index: i },
    }));
}

function makeEdges(n: number, reached: Set<number>, phase: string): VisualEdge[] {
    return Array.from({ length: n - 1 }, (_, idx) => {
        const i = idx + 1;
        const got = reached.has(i);
        const state: EntityState = phase === "setup" ? "idle" : got ? (phase === "echo" ? "comparing" : "sorted") : "error";
        return {
            id: `send-${i}`,
            sourceId: "p-0",
            targetId: `p-${i}`,
            label: phase === "setup" ? "-" : got ? phase : "missing",
            state,
            directed: true,
        };
    });
}

/** Uniform broadcast generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = typeof task.processes === "number" && Number.isFinite(task.processes)
        ? Math.max(3, Math.min(7, Math.floor(task.processes)))
        : 4;
    const maxFaults = Math.floor((n - 1) / 3);
    const f = typeof task.faults === "number" && Number.isFinite(task.faults)
        ? Math.max(0, Math.min(maxFaults, Math.floor(task.faults)))
        : Math.min(1, maxFaults);
    const honest = task.senderHonest !== false;
    const sentCount = typeof task.deliveredTo === "number" && Number.isFinite(task.deliveredTo)
        ? Math.max(0, Math.min(n - 1, Math.floor(task.deliveredTo)))
        : n - 1;
    const echoCount = honest ? n - f : Math.min(sentCount, n - f);
    const threshold = 2 * f + 1;
    const deliver = echoCount >= threshold;
    // Uniformity: every correct process shares the same deliver decision.
    const uniform = true;

    const reached = new Set<number>();
    for (let i = 1; i <= echoCount; i += 1) reached.add(i);
    const states = (phase: string): EntityState[] =>
        Array.from({ length: n }, (_, i) => {
            if (i === 0) return phase === "setup" ? "idle" : honest || echoCount > 0 ? "active" : "error";
            if (phase === "setup") return "idle";
            if (phase === "send") return reached.has(i) ? "comparing" : "unvisited";
            if (phase === "echo" || phase === "ready") return reached.has(i) ? "comparing" : "error";
            return deliver ? "sorted" : "idle";
        });

    const meta = (phase: string, step: number, done: boolean) => ({
        n,
        f,
        threshold,
        senderHonest: honest,
        echoCount,
        reached: [...reached],
        deliver,
        uniform,
        phase,
        done,
        step,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(n, states("setup")),
        edges: makeEdges(n, reached, "setup"),
        description: `Uniform broadcast among ${n} processes with up to ${f} faulty; delivery needs ${threshold} echoes.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta("setup", step, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(n, states("send")),
        edges: makeEdges(n, reached, "send"),
        description: honest
            ? "The sender transmits the message to every correct process."
            : `A faulty sender transmits to only ${echoCount} correct process(es).`,
        codeLineNumber: 1,
        layout: "graph",
        meta: meta("send", step, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(n, states("echo")),
        edges: makeEdges(n, reached, "echo"),
        description: `${echoCount} process(es) echo the message; ${threshold} echoes are the delivery gate.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: meta("echo", step, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(n, states("ready")),
        edges: makeEdges(n, reached, "ready"),
        description: deliver
            ? `Enough echoes were seen: a correct process emits ready after ${threshold} witnesses.`
            : "Too few echoes: no correct process may emit ready, so nobody can deliver.",
        codeLineNumber: 4,
        layout: "graph",
        meta: meta("ready", step, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(n, states("done")),
        edges: makeEdges(n, reached, "done"),
        description: deliver
            ? `All correct processes deliver the message uniformly (uniformity holds).`
            : "No correct process delivers, which is also a uniform outcome.",
        codeLineNumber: 5,
        layout: "graph",
        meta: meta("done", step, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If one honest process decides to deliver a broadcast, everyone must decide the same way. The trick is to make delivery depend on a witness that at least one honest process holds: collect two f plus one echoes before delivering. Since at most f processes can lie, one of those witnesses is honest and its echo can be relayed to every other correct process, so no split decision is possible.",
        invariants: [
            "A correct process delivers only after observing at least two f plus one echoes or ready hints.",
            "At least one correct process echoed whenever any delivery occurs.",
            "All correct processes share the same deliver decision, whether positive or negative.",
        ],
        correctness:
            "Suppose a correct process delivers. It saw at least two f plus one matching witnesses; at most f are faulty, so at least f plus one are correct. Those correct processes have the echo and will relay it, so every other correct process can also gather two f plus one witnesses and deliver. If no correct process ever reaches the threshold, none delivers. Either branch gives the same decision at every correct process, which is uniformity, and a delivered value always originated with the sender, which is integrity.",
        complexityRationale:
            "Each process sends an echo and a ready hint to the group, so the protocol exchanges O(n squared) point-to-point messages. Each process stores the echo and ready sets, O(n) space per process.",
        uses: [
            "Total-order and consensus protocols that need a reliable broadcast primitive",
            "Replicated state machines tolerating Byzantine faults",
            "Blockchain mempool dissemination with uniform delivery",
        ],
        references: [
            "Bracha, Asynchronous Byzantine Agreement Protocols, 1987",
            "Cachin, Kursawe, and Shoup, Random Oracles in Constantinople, 2001",
        ],
        workedExample:
            "With four processes and one faulty, the threshold is three echoes. An honest sender gives three correct echoes, so all deliver. A faulty sender that reaches only two correct processes yields two echoes, below three, so nobody delivers. Both outcomes are uniform across the correct processes.",
    },
    id: "uniform-broadcast",
    name: "Uniform Reliable Broadcast",
    category: "parallel-distributed",
    complexity: { time: "O(n^2) messages", space: "O(n) per process" },
    defaultInput: { processes: 4, faults: 1, senderHonest: true },
    visualType: "graph",
    run,
    pseudocode: [
        "set the delivery threshold to two f plus one echoes",
        "the sender transmits the message to the group",
        "each recipient echoes the message to all processes",
        "on collecting the threshold of echoes, emit a ready hint",
        "on f plus one ready hints, also emit ready",
        "on the threshold of ready hints, deliver the message",
        "done: all correct processes share the same deliver decision",
    ],
};

export default module;
