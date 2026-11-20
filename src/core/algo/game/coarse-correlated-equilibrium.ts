/**
 * coarse-correlated-equilibrium.ts - Coarse Correlated Equilibrium by Regret Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A coarse correlated equilibrium is a joint distribution over action profiles
 * in which no player gains by swapping to a different fixed action before the
 * outcome is drawn. Regret matching is a no-regret learning rule: each player
 * raises the probability of actions with positive cumulative regret. The time
 * average of no-regret play converges to a coarse correlated equilibrium, so
 * this module plays the game for many rounds and reports the empirical joint
 * distribution together with its largest swapping gain.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * (na * nb + na + nb)) for T rounds
 *   Space: O(na * nb + na + nb) for counts and regret vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid cell is one joint action profile and shows its empirical mass.
 *   - Cells with positive probability are GREEN; the rest stay idle.
 *   - Sampled rounds show progress; the final frame reports the swapping gain.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function maxSwapRegret(payoff: number[][], dist: number[], n: number, m: number, rowPlayer: boolean): number {
    let worst = -Infinity;
    if (rowPlayer) {
        for (let i = 0; i < n; i += 1) {
            for (let alt = 0; alt < n; alt += 1) {
                let gain = 0;
                for (let j = 0; j < m; j += 1) {
                    gain += (dist[i * m + j] ?? 0) * ((payoff[alt]?.[j] ?? 0) - (payoff[i]?.[j] ?? 0));
                }
                worst = Math.max(worst, gain);
            }
        }
    } else {
        for (let j = 0; j < m; j += 1) {
            for (let alt = 0; alt < m; alt += 1) {
                let gain = 0;
                for (let i = 0; i < n; i += 1) {
                    gain += (dist[i * m + j] ?? 0) * ((payoff[i]?.[alt] ?? 0) - (payoff[i]?.[j] ?? 0));
                }
                worst = Math.max(worst, gain);
            }
        }
    }
    return worst;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { payoffA?: number[][]; payoffB?: number[][]; iterations?: number; seed?: number } | null
    ) ?? {};
    const payoffA = (task.payoffA ?? [[3, 0], [0, 2]]).map((row) => row.slice());
    const payoffB = (task.payoffB ?? [[1, 0], [0, 3]]).map((row) => row.slice());
    const n = payoffA.length;
    const m = n > 0 ? (payoffA[0]?.length ?? 0) : 0;
    const iterations = Math.max(200, Math.min(200000, Math.floor(task.iterations ?? 30000)));
    let seed = (task.seed ?? 12345) | 0;
    const rng = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x80000000;
    };

    const makeCells = (dist: number[]): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < m; j += 1) {
                const p = dist[i * m + j] ?? 0;
                cells.push({
                    id: `outcome-${i}-${j}`,
                    type: "cell" as const,
                    label: `(${i},${j}) ${p.toFixed(3)}`,
                    value: p,
                    state: p > 1e-9 ? "sorted" : "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: i, col: j, kind: "probability" },
                });
            }
        }
        return cells;
    };

    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        dist: number[],
        round: number,
        regretA: number[],
        regretB: number[],
        converged: boolean,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(dist),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            rows: n,
            cols: m,
            round,
            distribution: [...dist],
            maxSwapRegret: Math.max(
                maxSwapRegret(payoffA, dist, n, m, true),
                maxSwapRegret(payoffB, dist, n, m, false),
            ),
            regretA: [...regretA],
            regretB: [...regretB],
            converged,
        },
    });

    if (n < 1 || m < 1 || payoffB.length !== n || payoffB.some((r) => r.length !== m)) {
        yield snap("Both players need matching nonempty payoff tables.", 0, [], 0, [], [], false);
        return;
    }

    const regretA = new Array<number>(n).fill(0);
    const regretB = new Array<number>(m).fill(0);
    const counts = new Array<number>(n * m).fill(0);
    const choose = (regret: number[]): number => {
        const positive = regret.map((r) => Math.max(0, r));
        const sum = positive.reduce((a, b) => a + b, 0);
        if (sum <= 1e-12) return Math.floor(rng() * regret.length) % regret.length;
        let ticket = rng() * sum;
        for (let i = 0; i < regret.length; i += 1) {
            ticket -= positive[i] as number;
            if (ticket <= 0) return i;
        }
        return regret.length - 1;
    };

    const sampleEvery = Math.max(1, Math.floor(iterations / 60));
    yield snap("Begin regret matching; every action starts with zero regret.", 0,
        new Array<number>(n * m).fill(0), 0, regretA, regretB, false);

    for (let t = 0; t < iterations; t += 1) {
        const a = choose(regretA);
        const b = choose(regretB);
        for (let alt = 0; alt < n; alt += 1) {
            regretA[alt] = (regretA[alt] as number) + ((payoffA[alt]?.[b] ?? 0) - (payoffA[a]?.[b] ?? 0));
        }
        for (let alt = 0; alt < m; alt += 1) {
            regretB[alt] = (regretB[alt] as number) + ((payoffB[a]?.[alt] ?? 0) - (payoffB[a]?.[b] ?? 0));
        }
        counts[a * m + b] = (counts[a * m + b] as number) + 1;

        if ((t + 1) % sampleEvery === 0) {
            const dist = counts.map((c) => c / (t + 1));
            yield snap(
                `Round ${t + 1}: sampled joint frequencies; regrets guide the next actions.`,
                4,
                dist,
                t + 1,
                regretA,
                regretB,
                false,
            );
        }
    }

    const dist = counts.map((c) => c / iterations);
    const swap = Math.max(
        maxSwapRegret(payoffA, dist, n, m, true),
        maxSwapRegret(payoffB, dist, n, m, false),
    );
    yield snap(
        `Converged after ${iterations} rounds; largest profitable swap is ${swap.toFixed(4)}.`,
        7,
        dist,
        iterations,
        regretA,
        regretB,
        true,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A coarse correlated equilibrium is stable even if players must choose a different fixed action before the mediator draws the outcome. Rather than solve a linear program, let both players learn. Regret matching favors actions that would have done better in the past, and the average of such no-regret play settles on exactly this kind of equilibrium.",
        invariants: [
            "Cumulative regret for an action is the past gain from having played it instead of the chosen action.",
            "An action is sampled in proportion to its positive regret, or uniformly when none is positive.",
            "The empirical joint frequencies always form a valid probability distribution.",
        ],
        correctness:
            "Under regret matching, each player's external regret grows sublinearly, so the average regret tends to zero. External regret is precisely the maximum gain from swapping to a fixed alternative action, which is the defining inequality of a coarse correlated equilibrium. The time-average joint distribution therefore satisfies every swapping constraint in the limit, and the reported swapping gains measure how close the finite run is.",
        complexityRationale:
            "Each round samples one action per player, updates at most na plus nb regret entries, and increments one counter, costing O(na nb) in the worst case for the payoff lookups. The counters and two regret vectors use O(na nb + na + nb) space, independent of the number of rounds.",
        uses: [
            "Predicting long-run behavior in repeated online auctions and routing games",
            "A tractable solution concept for large games where correlated equilibrium is costly to compute",
            "A teaching bridge between regret minimization and game-theoretic equilibrium",
        ],
        references: [
            "Hannan, Approximation to Bayes Risk in Repeated Plays, Contributions to the Theory of Games, 1957",
            "Cesa-Bianchi and Lugosi, Prediction, Learning, and Games, Cambridge University Press, 2006",
        ],
        workedExample:
            "In a matching-pennies game both players start choosing uniformly. Whenever heads would have paid more, regret for heads grows and it gets chosen more often. After many rounds the average joint distribution makes each player indifferent between their two fixed actions, so no swap improves the average payoff.",
    },
    id: "coarse-correlated-equilibrium",
    name: "Coarse Correlated Equilibrium (Regret Matching)",
    category: "game",
    complexity: { time: "O(T * (na * nb))", space: "O(na * nb + na + nb)" },
    defaultInput: {
        payoffA: [[3, 0], [0, 2]],
        payoffB: [[1, 0], [0, 3]],
        iterations: 30000,
        seed: 12345,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize both players' regrets and joint counters to zero",
        "for each round up to the iteration budget",
        "sample each player's action from positive regret, uniformly if all are zero",
        "add the payoff difference for every unchosen action to its regret",
        "increment the counter of the played action profile",
        "periodically display the empirical joint distribution",
        "divide the counters by the round count for the final distribution",
        "report the largest gain from swapping to a fixed action",
    ],
};

export default module;
