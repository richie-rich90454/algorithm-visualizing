/**
 * tit-for-tat-strategy.ts - Tit-for-Tat in the Iterated Prisoner's Dilemma
 *
 * Player A starts by cooperating and then copies whatever player B did on the
 * previous round. Player B follows a named stationary strategy. Each round
 * pays both players according to the 2 by 2 prisoner's dilemma matrix, and the
 * cumulative scores show how reciprocity fares against each opponent.
 *
 * Time: O(rounds). Space: O(rounds) for the displayed history.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Move = "C" | "D";
interface Payoffs {
    cc: [number, number];
    cd: [number, number];
    dc: [number, number];
    dd: [number, number];
}

const DEFAULT_PAYOFFS: Payoffs = { cc: [3, 3], cd: [0, 5], dc: [5, 0], dd: [1, 1] };

/** Decide opponent B's move from the history of A's and B's past moves. */
function opponentMove(strategy: string, aHistory: Move[], bHistory: Move[]): Move {
    switch (strategy) {
        case "always-cooperate":
            return "C";
        case "grim":
            return bHistory.includes("D") || aHistory.includes("D") ? "D" : "C";
        case "alternator":
            return bHistory.length % 2 === 0 ? "C" : "D";
        case "always-defect":
        default:
            return "D";
    }
}

function payout(a: Move, b: Move, p: Payoffs): [number, number] {
    if (a === "C" && b === "C") return p.cc;
    if (a === "C" && b === "D") return p.cd;
    if (a === "D" && b === "C") return p.dc;
    return p.dd;
}

function makeCells(
    history: Array<{ a: Move; b: Move; pa: number; pb: number }>,
    totalA: number,
    totalB: number,
    current: number,
    final: boolean,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < history.length; r += 1) {
        const h = history[r];
        if (!h) continue;
        const values: Array<[string, number | string]> = [
            [h.a, h.a === "C" ? 1 : 0],
            [h.b, h.b === "C" ? 1 : 0],
            [String(h.pa), h.pa],
            [String(h.pb), h.pb],
        ];
        values.forEach(([label, value], col) => {
            cells.push({
                id: `cell-${r}-${col}`,
                type: "cell",
                label,
                value,
                state: final ? "visited" : r === current ? "comparing" : "visited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col, round: r + 1 },
            });
        });
    }
    const totals: Array<[string, number]> = [["A", totalA], ["B", totalB], [String(totalA), totalA], [String(totalB), totalB]];
    totals.forEach(([label, value], col) => {
        cells.push({
            id: `total-${col}`,
            type: "cell",
            label,
            value,
            state: final ? "sorted" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: history.length, col, total: value },
        });
    });
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rounds?: number; opponent?: string; payoff?: Payoffs } | null) ?? {};
    const rounds = Math.min(40, Math.max(1, Math.floor(typeof task.rounds === "number" ? task.rounds : 10)));
    const strategy = typeof task.opponent === "string" ? task.opponent : "always-defect";
    const payoff = task.payoff ?? DEFAULT_PAYOFFS;
    const aHistory: Move[] = [];
    const bHistory: Move[] = [];
    const history: Array<{ a: Move; b: Move; pa: number; pb: number }> = [];
    let totalA = 0;
    let totalB = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(history, 0, 0, -1, false),
        edges: [],
        description: `Tit-for-tat plays ${rounds} round(s) against ${strategy} with payoffs CC ${payoff.cc} and DD ${payoff.dd}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: rounds + 1, cols: 4, totalA: 0, totalB: 0, opponent: strategy },
    };
    step += 1;

    for (let r = 0; r < rounds; r += 1) {
        const a: Move = r === 0 ? "C" : bHistory[r - 1] ?? "C";
        const b = opponentMove(strategy, aHistory, bHistory);
        const [pa, pb] = payout(a, b, payoff);
        aHistory.push(a);
        bHistory.push(b);
        history.push({ a, b, pa, pb });
        totalA += pa;
        totalB += pb;
        yield {
            stepNumber: step,
            entities: makeCells(history, totalA, totalB, r, false),
            edges: [],
            description: `Round ${r + 1}: tit-for-tat plays ${a}, opponent plays ${b}; payoffs (${pa}, ${pb}).`,
            codeLineNumber: a === "C" ? 2 : 3,
            layout: "grid",
            meta: {
                rows: rounds + 1,
                cols: 4,
                totalA,
                totalB,
                opponent: strategy,
                lastA: a,
                lastB: b,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(history, totalA, totalB, -1, true),
        edges: [],
        description: `After ${rounds} round(s) tit-for-tat scored ${totalA} and ${strategy} scored ${totalB}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: rounds + 1,
            cols: 4,
            totalA,
            totalB,
            opponent: strategy,
            history: history.map((h) => `${h.a}${h.b}`),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cooperation is fragile in a one-shot dilemma, but repeated play changes the incentives. Tit-for-tat is the simplest reciprocal rule: be friendly on the first move, then mirror the opponent's last move. It rewards cooperation, punishes defection once, and forgives as soon as the opponent returns to cooperating.",
        invariants: [
            "The first move is always cooperate.",
            "From round two onward A's move equals B's move from the previous round.",
            "Cumulative scores are the sum of per-round payoffs for each player.",
        ],
        correctness:
            "The implementation maintains the full move history and reads B's previous move directly when choosing A's action, so the mirroring invariant holds by construction. Each round looks up exactly one payoff pair from the dilemma matrix and adds it to the running totals, so the final scores are the exact repeated-game payoffs for the given opponent strategy.",
        complexityRationale:
            "One constant-time decision and payoff lookup happen per round, giving O(rounds) time. The history table stored for replay uses O(rounds) space.",
        uses: [
            "Modeling reciprocity in repeated strategic interaction",
            "Axelrod-style tournament simulations of cooperation",
            "A baseline policy for multi-agent reinforcement learning comparisons",
        ],
        references: [
            "Axelrod, The Evolution of Cooperation, 1984",
            "Osborne, An Introduction to Game Theory, Chapter 14",
        ],
        workedExample:
            "Against always-defect with payoffs CC 3, CD 0, DC 5, DD 1, tit-for-tat cooperates once for zero and then defects every round for one, scoring 9 over ten rounds while the opponent scores 14.",
    },
    id: "tit-for-tat-strategy",
    name: "Tit-for-Tat Strategy",
    category: "game",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { rounds: 10, opponent: "always-defect" },
    visualType: "grid",
    run,
    pseudocode: [
        "read the number of rounds, the opponent strategy and the payoff matrix",
        "on round one let tit-for-tat cooperate",
        "on later rounds copy the opponent's previous move",
        "ask the opponent strategy for its current move",
        "look up both payoffs and add them to the running totals",
        "record the round in the history table",
        "report the final cumulative scores",
    ],
};

export default module;
