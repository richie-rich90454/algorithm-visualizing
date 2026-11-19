/**
 * minimax-regret.ts - Minimax Regret Criterion
 *
 * A decision maker does not know which state of nature will occur. For each
 * state, regret is the amount lost by not having chosen the best action for
 * that state. Minimax regret picks the action whose worst-case regret is as
 * small as possible, a cautious alternative to maximizing expected value.
 *
 * Time: O(a * s) for a actions and s states. Space: O(a * s) for the regret table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RegretResult {
    best: number[];
    regret: number[][];
    worst: number[];
    chosen: number[];
    answer: number;
}

function solve(payoffs: number[][]): RegretResult {
    const actions = payoffs.length;
    const states = actions > 0 ? (payoffs[0]?.length ?? 0) : 0;
    const best = new Array<number>(states).fill(Number.NEGATIVE_INFINITY);
    for (const row of payoffs) {
        for (let s = 0; s < states; s += 1) best[s] = Math.max(best[s] ?? 0, row[s] ?? 0);
    }
    const regret: number[][] = [];
    const worst: number[] = [];
    for (let a = 0; a < actions; a += 1) {
        const line: number[] = [];
        let maximum = 0;
        for (let s = 0; s < states; s += 1) {
            const value = (best[s] ?? 0) - (payoffs[a]?.[s] ?? 0);
            line.push(value);
            maximum = Math.max(maximum, value);
        }
        regret.push(line);
        worst.push(maximum);
    }
    const answer = worst.length > 0 ? Math.min(...worst) : 0;
    const chosen = worst.map((w, a) => (w === answer ? a : -1)).filter((a) => a >= 0);
    return { best, regret, worst, chosen, answer };
}

function makeCells(result: RegretResult, upTo: number, final: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let a = 0; a < result.regret.length; a += 1) {
        const line = result.regret[a] ?? [];
        for (let s = 0; s < line.length; s += 1) {
            const value = line[s] ?? 0;
            let state: EntityState = "idle";
            if (final) state = result.chosen.includes(a) ? "sorted" : "visited";
            else if (a <= upTo) state = a === upTo ? "comparing" : "visited";
            cells.push({
                id: `cell-${a}-${s}`,
                type: "cell",
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: a, col: s, action: a, state: s, regret: value, worst: result.worst[a] ?? 0 },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoffs?: number[][] } | null) ?? {};
    const payoffs: number[][] = Array.isArray(task.payoffs) && task.payoffs.length > 0
        ? task.payoffs.map((row) => (Array.isArray(row) ? row.map(Number) : []))
        : [[10, 2, -2], [6, 4, 0], [1, 5, 12]];
    const result = solve(payoffs);
    const actions = payoffs.length;
    const states = actions > 0 ? (payoffs[0]?.length ?? 0) : 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(result, -1, false),
        edges: [],
        description: `Building the regret table for ${actions} action(s) across ${states} possible state(s) of nature.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: actions, cols: states, best: [...result.best], worst: [], chosen: [], answer: 0 },
    };
    step += 1;

    for (let a = 0; a < actions; a += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result, a, false),
            edges: [],
            description: `Action ${a}: regrets [${(result.regret[a] ?? []).join(", ")}] with worst-case regret ${result.worst[a]}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: actions, cols: states, best: [...result.best], worst: [...result.worst], chosen: [], answer: 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result, actions - 1, true),
        edges: [],
        description: `Minimax regret is ${result.answer}, attained by action${result.chosen.length === 1 ? "" : "s"} ${result.chosen.join(", ")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: actions, cols: states, best: [...result.best], worst: [...result.worst], chosen: [...result.chosen], answer: result.answer },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Regret measures how much better you could have done if you had known the state of nature in advance. Fill each column with the difference between that column's best payoff and each action's payoff, then look at each action's largest regret. Choosing the action with the smallest maximum regret protects against the worst case without assuming probabilities.",
        invariants: [
            "Every regret entry is nonnegative and equals best in the state minus the action's payoff.",
            "At least one action has regret zero in each state.",
            "The chosen action minimizes the maximum regret over all states.",
        ],
        correctness:
            "For a fixed state the maximum payoff defines the hypothetically perfect choice, so the computed differences are exactly the opportunities forgone. The worst-case regret of an action is the maximum of those differences over states, and taking the minimum of these maxima implements the minimax regret criterion. Every tie is reported so no optimal action is omitted.",
        complexityRationale:
            "Finding each column maximum and then each row maximum scans the a by s payoff table a constant number of times, giving O(a * s) time. The regret table and worst-case array occupy O(a * s) and O(a) space respectively.",
        uses: [
            "Decision analysis when outcome probabilities are unknown",
            "Robust planning under uncertain demand or weather",
            "Comparing cautious criteria with expected-value maximization",
        ],
        references: [
            "Savage, The Foundations of Statistics, 1954",
            "Luce and Raiffa, Games and Decisions, Chapter 13",
        ],
        workedExample:
            "For payoffs 10,2,-2; 6,4,0; 1,5,12 the column maxima are 10,5,12. The regrets are 0,3,14 for action 0; 4,1,12 for action 1; and 9,0,0 for action 2. The worst regrets are 14, 12 and 9, so action 2 is chosen.",
    },
    id: "minimax-regret",
    name: "Minimax Regret Criterion",
    category: "game",
    complexity: { time: "O(a * s)", space: "O(a * s)" },
    defaultInput: { payoffs: [[10, 2, -2], [6, 4, 0], [1, 5, 12]] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the payoff table with one row per action and column per state",
        "find the maximum payoff in each state column",
        "for every action and state subtract the payoff from that column maximum",
        "the difference is the regret of not choosing the best action there",
        "record the largest regret each action could suffer",
        "choose every action whose largest regret is the smallest",
        "report the minimax regret value and the chosen actions",
    ],
};

export default module;
