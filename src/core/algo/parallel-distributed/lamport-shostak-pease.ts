/**
 * lamport-shostak-pease.ts - Lamport-Shostak-Pease Synchronous Consensus
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is the classic majority-round consensus algorithm for a synchronous
 * system with crash failures. It runs f+1 rounds. In every round each correct
 * process broadcasts its estimate to all others; because channels are reliable
 * and the system is synchronous, every correct process receives the same set of
 * estimates from the same set of correct senders. Each process adopts the
 * strict majority value if one exists and otherwise keeps its own estimate.
 * With at least 2f+1 processes, 2f+1-f = f+1 correct senders remain, and a
 * majority among them always exists once f+1 is odd, so all correct processes
 * align after the first round and keep the common value thereafter.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(f * n) messages over f+1 all-to-all rounds
 *   Space: O(n) per process for received estimates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are processes on a circle; the current broadcast is highlighted.
 *   - GREEN marks the adopted majority, RED marks a crashed process.
 *   - meta carries the round, majority value, estimates, and decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    processes?: number;
    values?: number[];
    crashed?: number[];
}

const defaultInput: Input = { processes: 5, values: [1, 0, 1, 0, 1], crashed: [3, 4] };

function nodePosition(i: number, n: number): [number, number] {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(180 * Math.cos(angle)), Math.round(180 * Math.sin(angle))];
}

function makeNodes(n: number, values: number[], crashed: boolean[], majority: number | null): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => {
        const [x, y] = nodePosition(i, n);
        const state: EntityState = crashed[i] ? "error" : majority !== null && values[i] === majority ? "sorted" : "idle";
        return {
            id: `proc-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: crashed[i] ? "crashed" : values[i] ?? 0,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { proc: i, estimate: values[i] ?? 0, crashed: !!crashed[i] },
        };
    });
}

/** All-to-all broadcast edges among correct processes. */
function makeEdges(n: number, crashed: boolean[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let a = 0; a < n; a += 1) {
        if (crashed[a]) continue;
        for (let b = 0; b < n; b += 1) {
            if (b === a || crashed[b]) continue;
            edges.push({
                id: `msg-${a}-${b}`,
                sourceId: `proc-${a}`,
                targetId: `proc-${b}`,
                label: "est",
                state: "active",
                directed: true,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Math.max(3, Math.min(7, Math.floor(task.processes ?? 5)));
    const crashed = Array.from({ length: n }, () => false);
    const crashList = Array.isArray(task.crashed) ? task.crashed : defaultInput.crashed ?? [];
    for (const c of crashList) {
        const idx = Math.max(0, Math.min(n - 1, Math.floor(c)));
        crashed[idx] = true;
    }
    const fCount = crashed.filter(Boolean).length;
    const rounds = fCount + 1;
    const values: number[] = Array.from({ length: n }, (_, i) => {
        const v = Array.isArray(task.values) ? task.values[i] : (defaultInput.values ?? [])[i];
        return v === 1 ? 1 : 0;
    });
    const survivorValues = (): number[] => values.filter((_, i) => !crashed[i]);
    let step = 0;
    let decided = -1;

    const meta = (round: number, majority: number | null, last: string) => ({
        processes: n,
        crashes: fCount,
        rounds,
        round,
        majority: majority === null ? "none" : majority,
        estimates: values.map((v) => v),
        survivors: survivorValues(),
        decided,
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeNodes(n, values, crashed, null),
        edges: [],
        description: `LSP consensus on ${n} processes with ${fCount} crash failure(s), running ${rounds} round(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta(0, null, "initialized"),
    };

    for (let round = 1; round <= rounds; round += 1) {
        const received = survivorValues();
        const ones = received.filter((v) => v === 1).length;
        const zeros = received.length - ones;
        let majority: number | null = null;
        if (ones > received.length / 2) majority = 1;
        else if (zeros > received.length / 2) majority = 0;
        if (majority !== null) {
            for (let i = 0; i < n; i += 1) {
                if (!crashed[i]) values[i] = majority;
            }
        }
        const desc = majority === null
            ? `Round ${round}: no strict majority among ${received.length} estimate(s); correct processes keep their own.`
            : `Round ${round}: strict majority ${majority} among ${received.length} estimate(s); all correct processes adopt it.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, values, crashed, majority),
            edges: makeEdges(n, crashed),
            description: desc,
            codeLineNumber: majority === null ? 3 : 4,
            layout: "point",
            meta: meta(round, majority, desc),
        };
    }

    const survivors = survivorValues();
    decided = survivors.length > 0 ? survivors[0]! : 0;
    const agree = survivors.every((v) => v === decided);
    const done = agree
        ? `All ${survivors.length} correct processes decided ${decided} after ${rounds} round(s).`
        : `No strict majority appeared; estimates stayed ${survivors.join(", ")} (needs n greater than 2f).`;
    yield {
        stepNumber: step,
        entities: makeNodes(n, values, crashed, decided),
        edges: [],
        description: done,
        codeLineNumber: 6,
        layout: "point",
        meta: meta(rounds, decided, done),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each round everyone shouts their current guess, then everyone who can be trusted listens to the same set of shouts. If one guess has more than half the votes, everybody switches to it; if not, everybody stays put. Since the honest group always sees the same votes and is large enough to have a clear winner, after one round they all agree, and later rounds can only keep that shared answer.",
        invariants: [
            "All correct processes receive the same multiset of estimates each round.",
            "A correct process changes its estimate only to a strict majority value.",
            "Once the correct estimates agree, later rounds keep them equal.",
        ],
        correctness:
            "In a synchronous system with crash failures, every correct process receives estimates from exactly the same set of f+1 or more correct senders. If a strict majority value exists, it is unique and identical for all receivers, so all adopt the same value; if none exists, all keep their own values. With n >= 2f+1 and an odd number of survivors, a strict majority always exists in round 1, so all correct processes align immediately and stay aligned. Validity holds because a uniform initial value is trivially the unique majority. Termination follows after f+1 rounds regardless of message delays within the synchronous bound.",
        complexityRationale:
            "Each of the f+1 rounds broadcasts an estimate from every correct process to every other, costing O(n) messages per round and O(f * n) total. Storing the received estimates for one round takes O(n) space per process.",
        uses: [
            "Synchronous fault-tolerant agreement in distributed control systems",
            "Replicating a value across servers that may crash during a round",
            "A canonical teaching algorithm for majority-based consensus",
        ],
        references: [
            "Lamport, Shostak, and Pease, The Byzantine Generals Problem, 1982",
            "Lynch, Distributed Algorithms, chapter on synchronous consensus",
        ],
        workedExample:
            "Five processes start [1, 0, 1, 0, 1] and processes 3 and 4 crash, leaving estimates [1, 0, 1]. The strict majority is 1, so all three correct processes adopt 1 in round one. With f=2 the algorithm runs three rounds, but agreement is already reached after the first.",
    },
    id: "lamport-shostak-pease",
    name: "Lamport-Shostak-Pease Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(f * n) messages", space: "O(n)" },
    defaultInput,
    visualType: "point",
    run,
    pseudocode: [
        "assume at most f crashes and n greater than 2f",
        "each correct process starts with an estimate",
        "for round one to f+1 do the following",
        "broadcast the current estimate to all processes",
        "collect estimates sent by correct processes",
        "if a strict majority value exists, adopt it",
        "otherwise keep the current estimate",
        "after f+1 rounds decide the common estimate",
    ],
};

export default module;
