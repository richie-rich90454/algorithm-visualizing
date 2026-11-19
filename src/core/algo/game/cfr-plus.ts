/**
 * cfr-plus.ts - CFR+ Regret Matching in a Normal-Form Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CFR+ strengthens counterfactual regret minimization with two changes:
 * regrets are floored at zero after every update, and the two players are
 * updated on alternating iterations. Strategies are formed from the positive
 * parts of the regrets, and the average of the strategies played converges to
 * a Nash equilibrium in two-player zero-sum games. This module works on a
 * small matrix game, where every player has a single information set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (rows * cols + rows + cols))
 *   Space: O(rows * cols) for the displayed payoff matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The payoff matrix fills the top rows; the next two rows show strategies.
 *   - Cells being updated are amber, and the leading action is green.
 *   - Limits: up to four actions per player, exact arithmetic on input numbers.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = number[];
const DEFAULT_PAYOFF = [
    [0, -1, 1],
    [1, 0, -1],
    [-1, 1, 0],
];

function regretMatch(regrets: Vec): Vec {
    const positive = regrets.map((r) => Math.max(0, r));
    const total = positive.reduce((a, b) => a + b, 0);
    if (total <= 0) return positive.map(() => 1 / Math.max(1, positive.length));
    return positive.map((r) => r / total);
}

function normalize(v: Vec): Vec {
    const total = v.reduce((a, b) => a + b, 0);
    return total > 0 ? v.map((x) => x / total) : v.map(() => 1 / Math.max(1, v.length));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoff?: number[][]; iterations?: number } | null) ?? {};
    const raw = task.payoff ?? DEFAULT_PAYOFF;
    const payoff = raw.map((row) => row.slice());
    const rows = payoff.length;
    const cols = rows > 0 ? (payoff[0]?.length ?? 0) : 0;
    if (rows < 1 || cols < 1) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "A nonempty payoff matrix with at least one action per player is required.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 1, cols: 1, iterations: 0, converged: false },
        };
        return;
    }
    const iterations = Math.max(10, Math.min(4000, Math.floor(task.iterations ?? 1200)));
    const width = Math.max(rows, cols);
    const regrets1: Vec = new Array(rows).fill(0);
    const regrets2: Vec = new Array(cols).fill(0);
    const cum1: Vec = new Array(rows).fill(0);
    const cum2: Vec = new Array(cols).fill(0);

    const average1 = (): Vec => normalize(cum1);
    const average2 = (): Vec => normalize(cum2);
    const exploitability = (p1: Vec, p2: Vec): number => {
        let best = -Infinity;
        let worst = Infinity;
        for (let i = 0; i < rows; i += 1) {
            let value = 0;
            for (let j = 0; j < cols; j += 1) value += (payoff[i]?.[j] ?? 0) * (p2[j] ?? 0);
            best = Math.max(best, value);
        }
        for (let j = 0; j < cols; j += 1) {
            let value = 0;
            for (let i = 0; i < rows; i += 1) value += (p1[i] ?? 0) * (payoff[i]?.[j] ?? 0);
            worst = Math.min(worst, value);
        }
        return best - worst;
    };

    const entitiesFor = (p1: Vec, p2: Vec, activePlayer: number): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < rows; i += 1) {
            for (let j = 0; j < cols; j += 1) {
                entities.push({
                    id: `pay-${i}-${j}`,
                    type: "cell" as const,
                    label: String(payoff[i]?.[j] ?? 0),
                    value: payoff[i]?.[j] ?? 0,
                    state: i === j && activePlayer === 0 ? "comparing" : "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: i, col: j, kind: "payoff" },
                });
            }
        }
        const addStrategyRow = (row: number, probs: Vec, player: number): void => {
            const best = probs.indexOf(Math.max(...probs));
            for (let a = 0; a < probs.length; a += 1) {
                entities.push({
                    id: `strat-${player}-${a}`,
                    type: "cell" as const,
                    label: `${a}: ${(probs[a] ?? 0).toFixed(2)}`,
                    value: probs[a] ?? 0,
                    state: activePlayer === player ? (a === best ? "sorted" : "active") : "visited",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col: a, kind: `player${player}` },
                });
            }
        };
        addStrategyRow(rows, p1, 0);
        addStrategyRow(rows + 1, p2, 1);
        return entities;
    };

    const makeFrame = (
        step: number,
        iteration: number,
        p1: Vec,
        p2: Vec,
        activePlayer: number,
        codeLine: number,
        converged = false,
    ): VisualFrame => ({
        stepNumber: step,
        entities: entitiesFor(p1, p2, activePlayer),
        edges: [],
        description: converged
            ? `CFR+ finished after ${iterations} iterations: average strategies ${average1().map((x) => x.toFixed(2)).join("/")} and ${average2().map((x) => x.toFixed(2)).join("/")}, exploitability ${exploitability(average1(), average2()).toFixed(3)}.`
            : `Iteration ${iteration}: player ${activePlayer + 1} updates clipped regrets and accumulates the current strategy.`,
        codeLineNumber: codeLine,
        layout: "grid",
        meta: {
            rows: rows + 2,
            cols: width,
            iterations,
            iteration,
            p1: [...p1],
            p2: [...p2],
            avg1: average1(),
            avg2: average2(),
            regret1: [...regrets1],
            regret2: [...regrets2],
            exploitability: exploitability(average1(), average2()),
            converged,
        },
    });

    let step = 0;
    yield makeFrame(step++, 0, regretMatch(regrets1), regretMatch(regrets2), 0, 0);
    const sampleEvery = Math.max(1, Math.floor(iterations / 8));
    for (let t = 1; t <= iterations; t += 1) {
        const p1 = regretMatch(regrets1);
        const p2 = regretMatch(regrets2);
        const activePlayer = (t - 1) % 2;
        if (activePlayer === 0) {
            const actionValues: Vec = p1.map((_q1, i) => {
                let value = 0;
                for (let j = 0; j < cols; j += 1) value += (payoff[i]?.[j] ?? 0) * (p2[j] ?? 0);
                return value;
            });
            const mean = p1.reduce((acc, p, i) => acc + p * (actionValues[i] ?? 0), 0);
            for (let i = 0; i < rows; i += 1) {
                regrets1[i] = Math.max(0, (regrets1[i] ?? 0) + ((actionValues[i] ?? 0) - mean));
                cum1[i] = (cum1[i] ?? 0) + (p1[i] ?? 0);
            }
        } else {
            const actionValues: Vec = p1.map((q1, i) => {
                let value = 0;
                for (let j = 0; j < cols; j += 1) value += q1 * -(payoff[i]?.[j] ?? 0);
                return value;
            });
            const mean = p2.reduce((acc, p, j) => acc + p * (actionValues[j] ?? 0), 0);
            for (let j = 0; j < cols; j += 1) {
                regrets2[j] = Math.max(0, (regrets2[j] ?? 0) + ((actionValues[j] ?? 0) - mean));
                cum2[j] = (cum2[j] ?? 0) + (p2[j] ?? 0);
            }
        }
        if (t % sampleEvery === 0 || t === iterations) {
            yield makeFrame(step++, t, p1, p2, activePlayer, 5);
        }
    }
    yield makeFrame(step++, iterations, average1(), average2(), 0, 7, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CFR+ keeps a regret score for every action and plays an action in proportion to how much positive regret it has earned. After each play it clipped negative regrets to zero, which stops old mistakes from lingering, and it lets the two players learn on alternating rounds. Averaging all the strategies played washes out the early exploration and approaches equilibrium.",
        invariants: [
            "Every regret value is nonnegative because updates are clipped at zero.",
            "A strategy places all mass on actions with positive regret, or is uniform when none exist.",
            "Each player's cumulative strategy is a sum of strategies actually played.",
        ],
        correctness:
            "The instantaneous regret of an action is its payoff minus the strategy's mean payoff, so adding it to the stored regret accumulates the standard regret sum; flooring at zero only removes negative contributions that cannot help future regret matching. For two-player zero-sum games the sum of average regrets is bounded by a constant times the square root of the iterations, so it vanishes on average, and vanishing average regret is equivalent to the average strategy profile being a Nash equilibrium.",
        complexityRationale:
            "On one iteration each player forms a strategy from its regrets, evaluates every one of its actions against the opponent's strategy, which costs O(rows * cols), and updates its own vector. Over the iteration budget the time is O(iterations * rows * cols), and the payoff matrix plus the two strategy vectors use O(rows * cols) space.",
        uses: [
            "Computing Nash equilibria of matrix games as a teaching baseline",
            "The learning core of modern imperfect-information game solvers",
            "Benchmarking regret-based learning against other equilibrium algorithms",
        ],
        references: [
            "Tammelin, Neller, Johanson, and Burch, Solving Heads-Up Limit Hold'em Poker (2015)",
            "Shoham and Leyton-Brown, Multiagent Systems, chapter on regret minimization (2008)",
        ],
        workedExample:
            "In rock-paper-scissors, all regrets start at zero so both players use a uniform strategy. After player one sees that rock ties rock, loses to paper, and beats scissors, its regrets develop a pattern that favors whichever action punishes the opponent's recent play. Clipping and alternating updates keep the process stable, and after many rounds each action is played about one third of the time.",
    },
    id: "cfr-plus",
    name: "CFR+ (Regret Matching Plus)",
    category: "game",
    complexity: { time: "O(t * rows * cols)", space: "O(rows * cols)" },
    defaultInput: { payoff: DEFAULT_PAYOFF, iterations: 1200 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every action regret and cumulative strategy to zero",
        "form each player's strategy from positive regrets",
        "evaluate each action against the opponent's current strategy",
        "compute the mean payoff for the active player",
        "add each action's payoff gap to its regret and clip at zero",
        "add the current strategy to the cumulative strategy",
        "switch the active player on the next iteration",
        "repeat until the iteration budget is exhausted",
        "normalize cumulative strategies and report the equilibrium",
    ],
};

export default module;
