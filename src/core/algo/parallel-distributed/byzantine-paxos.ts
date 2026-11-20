/**
 * byzantine-paxos.ts - Byzantine Paxos (Single-Decree Teaching Core)
 *
 * Byzantine Paxos decides a single value even when some participants send
 * conflicting or fabricated messages. An acceptor adopts a value only after it
 * sees that value supported by a quorum of distinct processes. Because any two
 * quorums overlap in at least one honest process, two different values cannot
 * both gather a quorum, so honest acceptors never decide different values.
 *
 * This teaching simulation models an honest leader proposing one value while f
 * Byzantine processes send a competing value to every honest acceptor.
 *
 * Limits: a single decree, one round, a static faulty set, and a fixed quorum of
 * n minus f matching the classic n greater than 3f bound; no view changes.
 *
 * Time: O(n^2) to tally votes. Space: O(n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    states: Array<{ votes: Map<number, number>; decision: number | null }>,
    active: number,
): VisualEntity[] {
    return states.map((state, index) => {
        const decisionText = state.decision === null ? "none" : `v${state.decision}`;
        const tally = [...state.votes.entries()].map(([v, c]) => `${v}:${c}`).join(" ");
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `P${index}:${decisionText}`,
            value: state.decision === null ? -1 : state.decision,
            state: index === active ? ("active" as const) : (state.decision === null ? ("idle" as const) : ("sorted" as const)),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, decision: state.decision ?? -1, tally, row: 0, col: index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { processes?: number; faults?: number; leaderValue?: number; byzantineValue?: number }
        | null
    ) ?? {};
    const n = Math.max(1, Math.min(12, Math.floor(Number(task.processes ?? 4)) || 4));
    const f = Math.max(0, Math.min(n, Math.floor(Number(task.faults ?? 1))));
    const leaderValue = Number(task.leaderValue ?? 1);
    const byzantineValue = Number(task.byzantineValue ?? 0);
    const quorum = n - f;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([], -1),
        edges: [],
        description: `Run single-decree Byzantine Paxos with ${n} processes, ${f} faulty, quorum ${quorum}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, f, quorum, leaderValue, byzantineValue },
    };
    step += 1;

    if (n <= 3 * f) {
        yield {
            stepNumber: step,
            entities: makeCells([], -1),
            edges: [],
            description: "Byzantine agreement requires more than three times the fault count in processes.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { valid: false, n, f },
        };
        return;
    }

    const honestAcceptors = n - f;
    const states: Array<{ votes: Map<number, number>; decision: number | null }> = [];
    for (let i = 0; i < honestAcceptors; i += 1) {
        const votes = new Map<number, number>();
        votes.set(leaderValue, (votes.get(leaderValue) ?? 0) + honestAcceptors);
        votes.set(byzantineValue, (votes.get(byzantineValue) ?? 0) + f);
        let decision: number | null = null;
        let bestCount = 0;
        for (const [value, count] of votes) {
            if (count >= quorum && count > bestCount) {
                decision = value;
                bestCount = count;
            }
        }
        states.push({ votes, decision });
        yield {
            stepNumber: step,
            entities: makeCells(states, i),
            edges: [],
            description: `Acceptor ${i} saw ${honestAcceptors} vote(s) for ${leaderValue} and ${f} for ${byzantineValue}; decided ${decision === null ? "nothing" : decision}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                acceptor: i,
                votes: Object.fromEntries(votes),
                quorum,
                decision,
            },
        };
        step += 1;
    }

    const decisions = states.map((s) => s.decision).filter((d): d is number => d !== null);
    const agreement = decisions.length === states.length && decisions.every((d) => d === (decisions[0] as number));
    const validity = decisions.length > 0 && decisions.every((d) => d === leaderValue);
    yield {
        stepNumber: step,
        entities: makeCells(states, -1),
        edges: [],
        description: `Decided values ${[...new Set(decisions)].join(", ") || "none"}; agreement ${agreement}, validity ${validity}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            decisions: decisions.slice(),
            agreement,
            validity,
            quorum,
            n,
            f,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Byzantine Paxos makes a decision only when a value is backed by enough distinct processes. The quorum is chosen so large that any two quorums must share at least one honest participant, and an honest participant never backs two different values in the same round. That overlap is what prevents two conflicting values from both being chosen.",
        invariants: [
            "The quorum is n minus f, which exceeds two thirds of the processes when n is greater than 3f.",
            "Any two quorums overlap in at least f+1 processes, hence in at least one honest process.",
            "An honest acceptor decides only a value that reached the quorum.",
        ],
        correctness:
            "Suppose two different values v and w were both decided. Each gathered at least quorum votes, so the two supporting sets overlap because two quorums sum to more than n. The overlapping process must be honest and would have had to support both v and w in one round, which honest processes never do. Contradiction, so agreement holds. Validity holds because the honest leader's value collects n-f votes and reaches the quorum. The simulation tallies those votes for each acceptor and checks both properties directly.",
        complexityRationale:
            "Each of the honest acceptors tallies a constant-size vote map, and there are n minus f of them, so the work and stored state are both O(n) in this single-round model; the message pattern behind it is O(n^2).",
        uses: [
            "Replicated state machines that tolerate arbitrary faults",
            "Consensus layers of permissioned blockchains",
            "Fault-tolerant configuration and key management services",
        ],
        references: [
            "Castro and Liskov, Practical Byzantine Fault Tolerance, OSDI 1999",
            "Lamport, Shostak and Pease, The Byzantine Generals Problem, ACM TOPLAS 1982",
        ],
        workedExample:
            "With four processes and one faulty node, the quorum is three. The honest leader's value receives three votes from honest acceptors while the faulty node's competing value receives only one, so every honest acceptor decides the leader's value and the two acceptors never disagree.",
    },
    id: "byzantine-paxos",
    name: "Byzantine Paxos (Teaching Core)",
    category: "parallel-distributed",
    complexity: { time: "O(n^2) messages", space: "O(n)" },
    defaultInput: { processes: 4, faults: 1, leaderValue: 1, byzantineValue: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the process count, fault bound and competing values",
        "require more than three times as many processes as faults",
        "set the quorum to n minus f",
        "for each honest acceptor tally leader and Byzantine votes",
        "decide any value whose tally reaches the quorum",
        "check that all honest decisions match",
        "verify that the decided value is the honest leader's value",
    ],
};

export default module;
