/**
 * cheap-paxos.ts - Cheap Paxos Consensus
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cheap Paxos reaches consensus while tolerating f failures using f+1 acceptors
 * and f+1 learners. The acceptors alone cannot always form a majority after
 * failures, so a learner is promoted to an acceptor to restore a quorum. Once a
 * quorum exists the proposer runs the usual two phases: prepare and promise,
 * then accept and learn. Combining the roles only when needed is what makes the
 * configuration cheaper than keeping f+1 full acceptors plus a separate
 * fault-tolerant learner quorum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(f) messages per phase because the quorum size is about f/2
 *   Space: O(f) for the quorum and the list of promoted learners
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Nodes are acceptors on the top row and learners on the bottom row.
 *   - A failed component is red, a promoted learner is yellow, and the chosen
 *     quorum is green.
 *   - meta carries the quorum, promotion list, and the decided value.
 *
 * This is a deterministic teaching simulation: failures are declared up front,
 * messages never get lost beyond those failures, and a single proposal is
 * decided. No networking, real time, or leader election is modeled.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    faults?: number;
    failures?: number[];
    value?: string;
}

const DEFAULT_FAILURES = [0];

/** Build nodes for acceptors (top row) and learners (bottom row). */
function makeNodes(
    f: number,
    failures: Set<number>,
    promoted: Set<number>,
    quorum: Set<number>,
    decided: number,
): VisualEntity[] {
    const total = 2 * (f + 1);
    const entities: VisualEntity[] = [
        {
            id: "node-proposer",
            type: "node" as const,
            label: "PROP",
            value: 1,
            state: "path" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: -1, role: "proposer", failed: false, promoted: false, inQuorum: false, decided: false },
        },
    ];
    for (let i = 0; i < total; i += 1) {
        const isAcceptor = i <= f;
        const state: EntityState = failures.has(i)
            ? "error"
            : quorum.has(i)
                ? "sorted"
                : decided === i
                    ? "active"
                    : promoted.has(i)
                        ? "comparing"
                        : "idle";
        entities.push({
            id: `node-${i}`,
            type: "node" as const,
            label: `${isAcceptor ? "A" : "L"}${i}`,
            value: failures.has(i) ? 0 : 1,
            state,
            x: (i - (total - 1) / 2) * 110,
            y: isAcceptor ? -90 : 90,
            width: 0,
            height: 0,
            metadata: {
                index: i,
                role: isAcceptor ? "acceptor" : "learner",
                failed: failures.has(i),
                promoted: promoted.has(i),
                inQuorum: quorum.has(i),
                decided: decided === i,
            },
        });
    }
    return entities;
}

/** Message edges from the proposer to the current quorum. */
function makeEdges(quorum: number[], label: string): VisualEdge[] {
    return quorum.map((member) => ({
        id: `msg-${label}-${member}`,
        sourceId: "node-proposer",
        targetId: `node-${member}`,
        label,
        state: "active" as EntityState,
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const f = typeof task.faults === "number" && Number.isFinite(task.faults)
        ? Math.max(1, Math.min(3, Math.round(task.faults)))
        : 1;
    const value = typeof task.value === "string" && task.value.length > 0 ? task.value : "v";
    const spec = Array.isArray(task.failures) ? task.failures : DEFAULT_FAILURES;
    const failures = new Set(
        spec
            .map((raw) => Math.floor(Number(raw)))
            .filter((id) => Number.isFinite(id) && id >= 0 && id < 2 * (f + 1))
            .slice(0, f),
    );

    const acceptors = Array.from({ length: f + 1 }, (_, i) => i);
    const learners = Array.from({ length: f + 1 }, (_, i) => f + 1 + i);
    const quorumSize = Math.floor(acceptors.length / 2) + 1;
    let activeAcceptors = acceptors.filter((a) => !failures.has(a));
    const promoted: number[] = [];
    const quorum = new Set<number>();
    let decided = -1;
    let decision = "";
    let learned: number[] = [];
    let phase = "init";
    let step = 1;

    const meta = (last: string) => ({
        faults: f,
        acceptors: acceptors.length,
        learners: learners.length,
        quorumSize,
        failures: [...failures].sort((a, b) => a - b),
        activeAcceptors: [...activeAcceptors],
        promoted: [...promoted],
        quorum: [...quorum].sort((a, b) => a - b),
        decided: decision,
        learned: [...learned].sort((a, b) => a - b),
        phase,
        last,
    });

    yield {
        stepNumber: 0,
        entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
        edges: [],
        description: `Cheap Paxos tolerates ${f} failure(s) with ${acceptors.length} acceptors and ${learners.length} learners; quorum is ${quorumSize}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta("configured"),
    };

    for (const learner of learners) {
        if (activeAcceptors.length >= quorumSize) {
            break;
        }
        if (failures.has(learner)) {
            continue;
        }
        activeAcceptors.push(learner);
        promoted.push(learner);
        phase = "promote";
        yield {
            stepNumber: step++,
            entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
            edges: [],
            description: `Only ${activeAcceptors.length - promoted.length} acceptor(s) survive, so learner L${learner} is promoted to restore the quorum.`,
            codeLineNumber: 2,
            layout: "point",
            meta: meta(`promoted L${learner}`),
        };
    }

    if (activeAcceptors.length < quorumSize) {
        phase = "blocked";
        const blocked = `Not enough live components remain to form a quorum of ${quorumSize}; no value is decided.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
            edges: [],
            description: blocked,
            codeLineNumber: 3,
            layout: "point",
            meta: meta(blocked),
        };
        return;
    }

    for (const member of activeAcceptors) {
        quorum.add(member);
    }
    const quorumList = [...quorum].sort((a, b) => a - b);
    phase = "prepare";
    yield {
        stepNumber: step++,
        entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
        edges: makeEdges(quorumList, "PREPARE"),
        description: `The proposer gathers promises from quorum {${quorumList.join(", ")}}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: meta("prepared"),
    };

    phase = "accept";
    decision = value;
    decided = quorumList[0] ?? -1;
    yield {
        stepNumber: step++,
        entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
        edges: makeEdges(quorumList, "ACCEPT"),
        description: `All ${quorumList.length} quorum members accept "${value}", so the value is chosen.`,
        codeLineNumber: 5,
        layout: "point",
        meta: meta("accepted"),
    };

    learned = learners.filter((learner) => !failures.has(learner) && !promoted.includes(learner));
    decided = -1;
    phase = "learn";
    yield {
        stepNumber: step++,
        entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
        edges: [],
        description: `Live learners {${learned.join(", ")}} all learn the decided value "${value}".`,
        codeLineNumber: 6,
        layout: "point",
        meta: meta("learned"),
    };

    phase = "done";
    yield {
        stepNumber: step++,
        entities: makeNodes(f, failures, new Set(promoted), quorum, decided),
        edges: [],
        description: `Consensus reached with ${failures.size} failure(s) and ${promoted.length} promotion(s): every live learner holds "${value}".`,
        codeLineNumber: 7,
        layout: "point",
        meta: meta("done"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Paxos majority normally needs several acceptors. Cheap Paxos observes that spare learners already track decisions, so when acceptors fail it simply promotes a learner into the acceptor role. With f failures it keeps f+1 acceptors and f+1 learners, which is enough to rebuild a quorum and still let the remaining learners hear the answer. The roles are borrowed only when the failures demand it.",
        invariants: [
            "The quorum always contains a majority of the currently active acceptors.",
            "A promoted learner joins the acceptor set before any phase begins.",
            "Every live learner that is not promoted learns the same decided value.",
        ],
        correctness:
            "After at most f failures at least f+2 of the 2f+2 components survive, and promoting learners yields a set of floor((f+1)/2)+1 active acceptors, which is a majority. A Paxos majority intersects every other majority, so at most one value can be chosen. The two phases then let a proposer with that majority fix the value and broadcast it; because all surviving unpromoted learners receive the same chosen value, agreement and validity hold. Promotion does not weaken the quorum because the promoted learner is treated as a full acceptor from then on.",
        complexityRationale:
            "A quorum has floor((f+1)/2)+1 members, so each of the two phases sends that many requests and replies, O(f) messages. The promoted list and quorum set are also O(f) space.",
        uses: [
            "Replicated state machines that want to spend few nodes on consensus",
            "Clusters where learners are cheap and acceptors are expensive",
            "Teaching the difference between acceptor and learner roles in Paxos",
        ],
        references: [
            "Lamport and Massa, Cheap Paxos, 2004",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "With f equal to one there are two acceptors and two learners and the quorum is two. If acceptor A0 fails, only A1 remains, so learner L2 is promoted. The quorum {A1, L2} promises and accepts the value v; the surviving learner L3 learns v, so consensus succeeds despite the acceptor failure.",
    },
    id: "cheap-paxos",
    name: "Cheap Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(f) messages per phase", space: "O(f)" },
    defaultInput: { faults: 1, failures: DEFAULT_FAILURES, value: "v" },
    visualType: "point",
    run,
    pseudocode: [
        "configure f+1 acceptors and f+1 learners to tolerate f failures",
        "count surviving acceptors and compare with the quorum size",
        "while the quorum is short, promote a surviving learner",
        "if no quorum can be formed, stop without deciding",
        "send PREPARE to the quorum and collect promises",
        "send ACCEPT for the proposed value to the quorum",
        "broadcast the chosen value to the surviving learners",
        "done: confirm that every live learner holds one value",
    ],
};

export default module;
