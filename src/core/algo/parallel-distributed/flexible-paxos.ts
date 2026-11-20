/**
 * flexible-paxos.ts - Flexible Paxos (Relaxed Quorum Intersection)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Classic Paxos insists that both the prepare quorum Q1 and the accept quorum
 * Q2 be majorities. Flexible Paxos observes that safety only needs Q1 and Q2
 * to intersect: Q1 + Q2 > N. This allows a large fast prepare quorum and a
 * small accept quorum (or the reverse) while preserving agreement.
 *
 * This is a deterministic teaching simulation. Phase 1 contacts the first Q1
 * acceptors and learns the highest value any of them accepted; phase 2 sends
 * that learned value to Q2 acceptors. A value is reported as chosen only when
 * the two quorums intersect (Q1 + Q2 > N).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(Q1 + Q2) messages for one decided value
 *   Space: O(N) for acceptor state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The proposer and each acceptor are graph nodes.
 *   - Directed edges show prepare and accept RPCs.
 *   - Green acceptors promised or accepted; red marks a value not chosen.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface FlexiblePaxosData {
    acceptors: number;
    quorum1: number;
    quorum2: number;
    safe: boolean;
    proposedValue: number;
    learnedValue: number;
    chosen: boolean;
    chosenValue: number;
    phase1: number[];
    phase2: number[];
}

/** Deterministic Flexible Paxos decision for one proposal. */
export function simulateFlexiblePaxos(
    acceptors: number,
    quorum1: number,
    quorum2: number,
    accepted: number[],
    proposedValue: number,
): FlexiblePaxosData {
    const n = Math.max(1, Math.floor(acceptors));
    const q1 = Math.min(n, Math.max(1, Math.floor(quorum1)));
    const q2 = Math.min(n, Math.max(1, Math.floor(quorum2)));
    const safe = q1 + q2 > n;
    const phase1 = Array.from({ length: q1 }, (_, i) => i);
    const phase2 = Array.from({ length: q2 }, (_, i) => i);

    let highest = -1;
    let learnedValue = proposedValue;
    for (const index of phase1) {
        const value = accepted[index] ?? -1;
        if (value > highest) {
            highest = value;
            learnedValue = value;
        }
    }

    const chosen = safe;
    return {
        acceptors: n,
        quorum1: q1,
        quorum2: q2,
        safe,
        proposedValue,
        learnedValue,
        chosen,
        chosenValue: chosen ? learnedValue : -1,
        phase1,
        phase2,
    };
}

/** Proposer plus acceptor nodes. */
function makeNodes(data: FlexiblePaxosData, states: EntityState[]): VisualEntity[] {
    const nodes: VisualEntity[] = [{
        id: "proposer",
        type: "node",
        label: "P",
        value: "proposer",
        state: "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: "proposer" },
    }];
    states.forEach((state, index) => {
        nodes.push({
            id: `acceptor-${index}`,
            type: "node",
            label: `A${index}`,
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "acceptor", index },
        });
    });
    return nodes;
}

/** Directed RPC edges from the proposer to every acceptor. */
function makeEdges(data: FlexiblePaxosData, active: Set<number>, state: EntityState): VisualEdge[] {
    return Array.from({ length: data.acceptors }, (_, index) => ({
        id: `rpc-${index}`,
        sourceId: "proposer",
        targetId: `acceptor-${index}`,
        label: active.has(index) ? "sent" : "idle",
        state: active.has(index) ? state : "idle",
        directed: true,
    }));
}

/** The Flexible Paxos generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        acceptors?: number; quorum1?: number; quorum2?: number;
        accepted?: number[]; value?: number;
    } | null) ?? {};
    const acceptors = typeof task.acceptors === "number" ? Math.max(1, Math.floor(task.acceptors)) : 5;
    const accepted = Array.isArray(task.accepted) ? [...task.accepted] : [-1, -1, -1, -1, -1];
    const value = typeof task.value === "number" ? task.value : 42;
    const data = simulateFlexiblePaxos(
        acceptors,
        task.quorum1 ?? 4,
        task.quorum2 ?? 2,
        accepted,
        value,
    );
    const idle = (): EntityState[] => Array<EntityState>(data.acceptors).fill("idle");

    yield {
        stepNumber: 0,
        entities: makeNodes(data, idle()),
        edges: makeEdges(data, new Set(), "idle"),
        description: `Flexible Paxos with ${data.acceptors} acceptors: prepare quorum ${data.quorum1}, accept quorum ${data.quorum2}; intersection requires their sum to exceed ${data.acceptors}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { acceptors: data.acceptors, quorum1: data.quorum1, quorum2: data.quorum2, safe: data.safe, phase: "setup", chosen: 0 },
    };

    const p1States = idle().map((_, i) => (data.phase1.includes(i) ? "sorted" : "idle"));
    yield {
        stepNumber: 1,
        entities: makeNodes(data, p1States),
        edges: makeEdges(data, new Set(data.phase1), "active"),
        description: `Phase 1: prepare sent to ${data.quorum1} acceptor(s); promises gathered from indices ${data.phase1.join(", ")}.`,
        codeLineNumber: 1,
        layout: "graph",
        meta: { acceptors: data.acceptors, quorum1: data.quorum1, quorum2: data.quorum2, safe: data.safe, phase: "prepare", chosen: 0 },
    };

    yield {
        stepNumber: 2,
        entities: makeNodes(data, p1States),
        edges: makeEdges(data, new Set(data.phase1), "comparing"),
        description: `Highest value seen in the prepare quorum is ${data.learnedValue}; the proposer must carry that value into phase 2.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { acceptors: data.acceptors, quorum1: data.quorum1, quorum2: data.quorum2, safe: data.safe, phase: "learn", learnedValue: data.learnedValue, chosen: 0 },
    };

    const p2States = idle().map((_, i) => (data.phase2.includes(i) ? "active" : "idle"));
    yield {
        stepNumber: 3,
        entities: makeNodes(data, p2States),
        edges: makeEdges(data, new Set(data.phase2), "active"),
        description: `Phase 2: accept(${data.learnedValue}) sent to ${data.quorum2} acceptor(s) at indices ${data.phase2.join(", ")}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { acceptors: data.acceptors, quorum1: data.quorum1, quorum2: data.quorum2, safe: data.safe, phase: "accept", chosen: 0 },
    };

    const finalStates = idle().map((_, i) => {
        if (!data.chosen) return "error";
        return data.phase2.includes(i) ? "sorted" : "idle";
    });
    yield {
        stepNumber: 4,
        entities: makeNodes(data, finalStates),
        edges: makeEdges(data, new Set(data.phase2), data.chosen ? "active" : "error"),
        description: data.chosen
            ? `Quorums intersect (${data.quorum1} + ${data.quorum2} > ${data.acceptors}); value ${data.chosenValue} is chosen and final.`
            : `Quorums do not intersect (${data.quorum1} + ${data.quorum2} <= ${data.acceptors}); safety cannot be guaranteed, so no value is declared chosen.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            acceptors: data.acceptors,
            quorum1: data.quorum1,
            quorum2: data.quorum2,
            safe: data.safe,
            phase: "done",
            chosen: data.chosen ? 1 : 0,
            chosenValue: data.chosenValue,
        },
    };
}

/** The Flexible Paxos module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Paxos safety comes from quorums overlapping, not from both being majorities. If the prepare quorum and the accept quorum always share at least one acceptor, that shared acceptor carries any previously chosen value forward. We can therefore trade quorum sizes: a big prepare round and a small accept round still decide safely.",
        invariants: [
            "Q1 acceptors answer prepare and report the highest value they accepted.",
            "The proposer must propose the highest value learned in phase 1.",
            "A value is declared chosen only when Q1 + Q2 exceeds N.",
        ],
        correctness:
            "Suppose value v was chosen by an accept quorum Q2. Any later proposal's prepare quorum Q1 intersects Q2 because Q1 + Q2 > N, so at least one acceptor in Q1 accepted v. Since v had a higher ballot than any earlier value, that acceptor reports v, and the new proposer is forced to propose v. Hence two different values can never be chosen, which is the agreement property of consensus.",
        complexityRationale:
            "One decision sends prepare messages to Q1 acceptors and accept messages to Q2 acceptors, so the message cost is O(Q1 + Q2), at most O(N). Each acceptor stores only its highest promise ballot and accepted value, giving O(N) state.",
        uses: [
            "Tuning quorum sizes in geo-replicated consensus to match latency and fault assumptions",
            "Fast decision rounds when failures are rare and a large prepare quorum is cheap",
            "Teaching the quorum-intersection condition behind Paxos variants",
        ],
        references: [
            "Howard, Kinnan, and Mortier, Flexible Paxos: Quorum Intersection Revisited, 2016",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "With five acceptors, a prepare quorum of four and an accept quorum of two sum to six, which exceeds five, so the quorums intersect. If acceptor 3 had accepted value 9, phase 1 learns 9 and phase 2 proposes 9 to two acceptors. With a prepare quorum of two and accept quorum of two the sum is four, so no value is declared chosen.",
    },
    id: "flexible-paxos",
    name: "Flexible Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(Q1+Q2) messages", space: "O(N)" },
    defaultInput: { acceptors: 5, quorum1: 4, quorum2: 2, accepted: [-1, -1, -1, 9, -1], value: 42 },
    visualType: "graph",
    run,
    pseudocode: [
        "choose prepare quorum Q1 and accept quorum Q2 with Q1 + Q2 > N",
        "send prepare with ballot b to the acceptors in Q1",
        "collect promises and the highest value each acceptor accepted",
        "let v be that highest value, or the proposal value if none",
        "send accept(b, v) to the acceptors in Q2",
        "collect accepted replies from Q2",
        "declare v chosen because the quorums intersect",
        "done: report the chosen value and quorum sizes",
    ],
};

export default module;
