/**
 * chandy-misra-misra.ts - Chandy-Misra-Misra Distributed Deadlock Detection
 *
 * A fully distributed edge-chasing probe protocol. The initiator sends a probe
 * along each wait-for edge it owns. A receiver discards a probe when it is not
 * blocked, propagates it along all of its own wait-for edges when it is blocked,
 * and declares a deadlock when the probe returns to the initiator.
 *
 * Time:  O(V + E) probes in the worst case, each processed once
 * Space: O(V + E) for the wait-for graph and the seen-probe set
 *
 * Visualization: the wait-for graph is drawn with nodes; the probe's current
 * edge glows, red means detected, and gray means discarded.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type WaitEdge = [string, string];
type Probe = { initiator: string; sender: string; receiver: string };

/** Independent reachability test: can `start` reach itself through >= 1 edge? */
export function inCycle(start: string, nodes: string[], edges: WaitEdge[]): boolean {
    const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
    for (const [a, b] of edges) {
        if (adj.has(a)) (adj.get(a) as string[]).push(b);
    }
    const seen = new Set<string>();
    const stack = [...(adj.get(start) ?? [])];
    while (stack.length > 0) {
        const v = stack.pop() as string;
        if (v === start) return true;
        if (seen.has(v)) continue;
        seen.add(v);
        stack.push(...(adj.get(v) ?? []));
    }
    return false;
}

/** Build the node entities for the wait-for graph. */
function makeNodes(nodes: string[], states: Map<string, EntityState>): VisualEntity[] {
    return nodes.map((id, i) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: id,
        state: states.get(id) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

/** Build directed wait-for edges with at most one highlighted. */
function makeEdges(edges: WaitEdge[], active: number | null): VisualEdge[] {
    return edges.map(([from, to], i) => ({
        id: `wait-${i}`,
        sourceId: `node-${from}`,
        targetId: `node-${to}`,
        label: "",
        state: i === active ? "active" : "idle",
        directed: true,
    }));
}

/** The Chandy-Misra-Misra generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: string[]; waits?: WaitEdge[]; initiator?: string } | null) ?? {};
    const nodes: string[] = Array.isArray(task.processes) && task.processes.length > 0
        ? task.processes.map(String)
        : ["P0", "P1", "P2", "P3"];
    const edges: WaitEdge[] = Array.isArray(task.waits)
        ? task.waits.filter((e) => Array.isArray(e) && e.length === 2).map((e) => [String(e[0]), String(e[1])])
        : [["P0", "P1"], ["P1", "P2"], ["P2", "P0"], ["P3", "P0"]];
    const initiator = typeof task.initiator === "string" && nodes.includes(task.initiator)
        ? task.initiator
        : (nodes[0] as string);
    const waiting = new Map<string, string[]>(nodes.map((n) => [n, []]));
    for (const [a, b] of edges) {
        if (waiting.has(a)) (waiting.get(a) as string[]).push(b);
    }

    const queue: Probe[] = (waiting.get(initiator) ?? []).map((k) => ({ initiator, sender: initiator, receiver: k }));
    const seen = new Set<string>();
    const key = (p: Probe): string => `${p.initiator}|${p.sender}|${p.receiver}`;
    let processed = 0;
    let deadlock = false;
    let detectedAt = "";
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(nodes, new Map()),
        edges: makeEdges(edges, null),
        description: `Process ${initiator} launches edge-chasing probes across ${nodes.length} processes and ${edges.length} wait edges.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "init", initiator, deadlock: false, probes: 0, action: "launch" },
    };
    step += 1;

    while (queue.length > 0) {
        const probe = queue.shift() as Probe;
        if (seen.has(key(probe))) continue;
        seen.add(key(probe));
        processed += 1;
        const edgeIndex = edges.findIndex(([a, b]) => a === probe.sender && b === probe.receiver);
        const states = new Map<string, EntityState>([[probe.receiver, "comparing"]]);
        let action: string;
        let codeLine: number;

        const dependencies = waiting.get(probe.receiver) ?? [];
        if (dependencies.length === 0) {
            action = `probe (${probe.initiator},${probe.sender},${probe.receiver}) discarded: ${probe.receiver} is not blocked`;
            states.set(probe.receiver, "unvisited");
            codeLine = 2;
        } else if (probe.receiver === probe.initiator) {
            action = `probe returned to ${probe.initiator}: deadlock detected`;
            deadlock = true;
            detectedAt = probe.sender;
            states.set(probe.receiver, "error");
            codeLine = 4;
        } else {
            for (const m of dependencies) {
                queue.push({ initiator: probe.initiator, sender: probe.receiver, receiver: m });
            }
            action = `probe forwarded by ${probe.receiver} to ${dependencies.join(", ")}`;
            states.set(probe.receiver, "active");
            codeLine = 3;
        }

        yield {
            stepNumber: step,
            entities: makeNodes(nodes, states),
            edges: makeEdges(edges, edgeIndex >= 0 ? edgeIndex : null),
            description: action,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase: "probe",
                initiator,
                deadlock,
                probes: processed,
                action,
                probe: [probe.initiator, probe.sender, probe.receiver],
                detectedAt,
            },
        };
        step += 1;
        if (deadlock) break;
    }

    const finalStates = new Map<string, EntityState>();
    for (const n of nodes) finalStates.set(n, deadlock && (n === initiator || n === detectedAt) ? "error" : "sorted");
    yield {
        stepNumber: step,
        entities: makeNodes(nodes, finalStates),
        edges: makeEdges(edges, null),
        description: deadlock
            ? `Deadlock confirmed for ${initiator} after ${processed} probe(s); the probe closed a cycle.`
            : `No deadlock for ${initiator}: all ${processed} probe(s) terminated without returning.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { phase: "done", initiator, deadlock, probes: processed, action: deadlock ? "detected" : "none", detectedAt },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of gathering the whole wait-for graph at one coordinator, let the suspicious process send a small probe called a triple along each edge it waits on. A blocked receiver forwards the probe along its own wait edges; an unblocked receiver drops it. If the probe ever comes back to the initiator, the chain of waiting has closed into a cycle, which is a deadlock.",
        invariants: [
            "A probe (initiator, sender, receiver) travels only along a wait-for edge from sender to receiver.",
            "A process forwards a probe only while it is itself blocked on at least one process.",
            "Each distinct probe triple is processed at most once, so the protocol terminates.",
        ],
        correctness:
            "Forwarding follows wait-for edges, so a probe traces a directed path of blocked processes. The probe reaches the initiator again if and only if there is a directed path from the initiator back to itself, which is exactly a cycle in the wait-for graph. An unblocked process terminates its branch because it cannot be part of a deadlock. Hence a returned probe certifies a deadlock and a fully exhausted probe set proves the initiator is not deadlocked.",
        complexityRationale:
            "Every possible probe triple (initiator, sender, receiver) maps to a wait-for edge and is processed at most once by the seen set, so at most O(E) probes with O(1) work each, O(E) time. Storing the graph, the queue, and the seen triples uses O(V + E) space.",
        uses: [
            "Deadlock detection in distributed databases and transaction monitors",
            "Cycle detection in peer-to-peer resource allocation",
            "Teaching fully distributed control without a global coordinator",
        ],
        references: [
            "Chandy, Misra, and Misra, Distributed Deadlock Detection, IEEE Transactions on Software Engineering, 1983",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, distributed deadlock section",
        ],
        workedExample:
            "With waits P0 -> P1 -> P2 -> P0 and P3 -> P0, initiating at P0 sends probes to P1. P1 forwards to P2, P2 forwards back to P0, and the probe returns to the initiator, confirming deadlock. Starting at P3 instead, the probe P3 -> P0 -> P1 -> P2 -> P0 never returns to P3, so P3 is reported as not deadlocked.",
    },
    id: "chandy-misra-misra",
    name: "Chandy-Misra-Misra Deadlock Detection",
    category: "parallel-distributed",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        processes: ["P0", "P1", "P2", "P3"],
        waits: [["P0", "P1"], ["P1", "P2"], ["P2", "P0"], ["P3", "P0"]],
        initiator: "P0",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "for each process the initiator waits on send probe(initiator, initiator, that process)",
        "while probes remain take the next probe (i, j, k)",
        "if k is not blocked on anyone discard the probe",
        "else if k equals i declare deadlock and stop",
        "else forward probe(i, k, m) to every m that k waits on",
        "skip any probe triple already processed",
        "if no probe returns report no deadlock",
        "done: report whether the initiator is in a wait cycle",
    ],
};

export default module;
