/**
 * fictitious-play.ts - Fictitious Play
 *
 * Each player assumes the opponent will repeat her historical mix of actions,
 * plays a best response to that empirical distribution, and updates the counts.
 * In games with a dominant strategy the empirical frequencies converge to it;
 * in zero-sum games they approach equilibrium play on average.
 *
 * Time O(rounds * players * actions^2); space O(players * actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Payoffs = [[number, number], [number, number]];

function bestResponse(row: [number, number]): number {
    return (row[0] ?? 0) >= (row[1] ?? 0) ? 0 : 1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoffsA?: Payoffs; payoffsB?: Payoffs; rounds?: number } | null) ?? {};
    const A: Payoffs = task.payoffsA ?? [[4, 1], [3, 0]];
    const B: Payoffs = task.payoffsB ?? [[3, 1], [2, 0]];
    const rounds = typeof task.rounds === "number" ? Math.max(2, Math.min(60, Math.floor(task.rounds))) : 20;
    const countA = [0, 0];
    const countB = [0, 0];

    const cells = (brA: number, brB: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let a = 0; a < 2; a += 1) {
            for (let b = 0; b < 2; b += 1) {
                const idx = a * 2 + b;
                out.push({
                    id: `pay-${a}-${b}`,
                    type: "cell",
                    label: `${A[a]?.[b] ?? 0},${B[a]?.[b] ?? 0}`,
                    value: A[a]?.[b] ?? 0,
                    state: (a === brA && b === brB ? "sorted" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: a, col: b, kind: "payoff" },
                });
            }
        }
        out.push({
            id: "count-A0", type: "cell", label: `A0:${countA[0]}`,
            value: countA[0] ?? 0, state: "highlight" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 2, col: 0, kind: "count" },
        });
        out.push({
            id: "count-A1", type: "cell", label: `A1:${countA[1]}`,
            value: countA[1] ?? 0, state: "highlight" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 2, col: 1, kind: "count" },
        });
        out.push({
            id: "count-B0", type: "cell", label: `B0:${countB[0]}`,
            value: countB[0] ?? 0, state: "comparing" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 3, col: 0, kind: "count" },
        });
        out.push({
            id: "count-B1", type: "cell", label: `B1:${countB[1]}`,
            value: countB[1] ?? 0, state: "comparing" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 3, col: 1, kind: "count" },
        });
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step, entities: cells(-1, -1), edges: [],
        description: `Fictitious play on a 2 by 2 game for ${rounds} rounds; both players start with uniform beliefs.`,
        codeLineNumber: 0, layout: "grid",
        meta: { rounds, payA: A.flat(), payB: B.flat(), countA: [...countA], countB: [...countB], rows: 4, cols: 2 },
    };
    step += 1;

    for (let t = 0; t < rounds; t += 1) {
        const sumA = countA[0] + countA[1];
        const sumB = countB[0] + countB[1];
        const pA: [number, number] = sumA === 0 ? [0.5, 0.5] : [(countA[0] ?? 0) / sumA, (countA[1] ?? 0) / sumA];
        const pB: [number, number] = sumB === 0 ? [0.5, 0.5] : [(countB[0] ?? 0) / sumB, (countB[1] ?? 0) / sumB];
        const scoreA: [number, number] = [
            (A[0]?.[0] ?? 0) * pB[0] + (A[0]?.[1] ?? 0) * pB[1],
            (A[1]?.[0] ?? 0) * pB[0] + (A[1]?.[1] ?? 0) * pB[1],
        ];
        const scoreB: [number, number] = [
            (B[0]?.[0] ?? 0) * pA[0] + (B[1]?.[0] ?? 0) * pA[1],
            (B[0]?.[1] ?? 0) * pA[0] + (B[1]?.[1] ?? 0) * pA[1],
        ];
        const brA = bestResponse(scoreA);
        const brB = bestResponse(scoreB);
        countA[brA] = (countA[brA] ?? 0) + 1;
        countB[brB] = (countB[brB] ?? 0) + 1;
        if ((t + 1) % 4 === 0 || t === rounds - 1) {
            yield {
                stepNumber: step, entities: cells(brA, brB), edges: [],
                description: `Round ${t + 1}: A best-responds with action ${brA}, B with action ${brB} to the current empirical mixes.`,
                codeLineNumber: 3, layout: "grid",
                meta: { round: t + 1, brA, brB, pA: [...pA], pB: [...pB], scoreA: [...scoreA], scoreB: [...scoreB], countA: [...countA], countB: [...countB], rows: 4, cols: 2 },
            };
            step += 1;
        }
    }

    const freqA = [(countA[0] ?? 0) / rounds, (countA[1] ?? 0) / rounds];
    const freqB = [(countB[0] ?? 0) / rounds, (countB[1] ?? 0) / rounds];
    yield {
        stepNumber: step, entities: cells(0, 0), edges: [],
        description: `After ${rounds} rounds the empirical frequencies are A ${freqA.map((x) => x.toFixed(2)).join("/")} and B ${freqB.map((x) => x.toFixed(2)).join("/")}.`,
        codeLineNumber: 6, layout: "grid",
        meta: { freqA: [...freqA], freqB: [...freqB], countA: [...countA], countB: [...countB], rounds, rows: 4, cols: 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fictitious play treats the opponent's past moves as a forecast of future moves. Each round every player computes the action with the highest expected payoff against that forecast and then records it. As the history grows, the forecast improves and the play tends toward a stable pattern in many games.",
        invariants: [
            "Beliefs are the empirical frequencies of the opponent's past actions.",
            "Each action is a best response to the current belief.",
            "Counts increase by exactly one action per player per round.",
        ],
        correctness:
            "A best response is found by maximizing a linear expected-payoff function, so it is the exact optimum against the current belief. In games with a strictly dominant action the belief assigns it positive weight from the first round and the best response is always that action, so the empirical frequency converges to one; the recorded counts verify the limit.",
        complexityRationale:
            "Each round computes two expected-payoff vectors over a actions, costing O(a^2) per player, so r rounds take O(r * a^2) time and O(a) space for the counts.",
        uses: [
            "Modeling learning and convergence in normal-form games",
            "Baseline multi-agent learning in game theory courses",
            "Approximate equilibrium finding in small repeated games",
        ],
        references: [
            "Brown, Iterative Solution of Games by Fictitious Play (1951)",
            "Fudenberg and Levine, The Theory of Learning in Games (1998)",
        ],
        workedExample:
            "If row player payoffs are 4 versus 1 for action 0 and 3 versus 0 for action 1, the best response to a uniform column mix is action 0 because its average payoff is 2.5 against 1.5. Repeating this dominant choice drives the empirical frequency of action 0 toward one.",
    },
    id: "fictitious-play",
    name: "Fictitious Play",
    category: "game",
    complexity: { time: "O(rounds * a^2)", space: "O(a)" },
    defaultInput: { payoffsA: [[4, 1], [3, 0]], payoffsB: [[3, 1], [2, 0]], rounds: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize action counts to zero for both players",
        "for each round derive each player's belief from opponent counts",
        "compute each player's expected payoff for every action",
        "choose a best response and increment its count",
        "record the empirical mixes and chosen actions",
        "repeat until the round budget is exhausted",
        "report the final empirical frequencies of play",
    ],
};

export default module;
