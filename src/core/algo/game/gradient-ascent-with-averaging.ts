/**
 * gradient-ascent-with-averaging.ts - Gradient Ascent With Averaging
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a repeated normal-form game, this rule keeps a cumulative regret for each
 * action. On every round it plays the action with the highest regret and then
 * increases each action's regret by the payoff it would have earned minus the
 * payoff actually received. The time-averaged mixed strategy converges to a
 * strategy with small regret in zero-sum games, even when the stage-game best
 * response cycles forever.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * A) for T rounds and A actions
 *   Space: O(A) for regrets and the average strategy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show cumulative regrets and two show the average strategy.
 *   - The currently chosen action is HIGHLIGHT.
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualFrame } from "@/types";

interface Task {
    payoff?: number[][];
    iterations?: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const payoff = task.payoff ?? [
        [1, -1],
        [-1, 1],
    ];
    const matrix = payoff.length === 2 && payoff.every((row) => row.length === 2) ? payoff : [
        [1, -1],
        [-1, 1],
    ];
    const iterations = Math.max(4, Math.min(400, Math.floor(task.iterations ?? 120)));
    const regret = [0, 0];
    const played = [0, 0];
    let total = 0;
    let chosen = 0;

    let step = 0;
    const snap = (description: string, codeLineNumber: number, meta: Record<string, MetaValue> = {}): VisualFrame => {
        const values = [regret[0] as number, regret[1] as number, played[0] as number / iterations, played[1] as number / iterations];
        const labels = ["regret A", "regret B", "avg A", "avg B"];
        const entities = values.map((value, index) => ({
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${labels[index]}: ${value.toFixed(3)}`,
            value,
            state: (index === chosen ? "highlight" : index < 2 ? "active" : "path") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber,
            layout: "array",
            meta,
        };
    };

    yield snap(
        `Repeated two-action game for ${iterations} rounds; regrets and average strategy start at zero.`,
        0,
        { iterations, round: 0, chosen: 0, averagePayoff: 0 },
    );
    step += 1;

    for (let round = 1; round <= iterations; round += 1) {
        const opponent = (round - 1) % 2;
        chosen = (regret[0] as number) >= (regret[1] as number) ? 0 : 1;
        const earned = (matrix[chosen] as number[])[opponent] as number;
        for (let action = 0; action < 2; action += 1) {
            const wouldEarn = (matrix[action] as number[])[opponent] as number;
            regret[action] = (regret[action] as number) + wouldEarn - earned;
        }
        played[chosen] = (played[chosen] as number) + 1;
        total += earned;
        if (round <= 12 || round % 20 === 0) {
            yield snap(
                `Round ${round}: opponent played ${opponent}, action ${chosen} earned ${earned}; regrets are ${(regret[0] as number).toFixed(2)} and ${(regret[1] as number).toFixed(2)}.`,
                4,
                {
                    round,
                    chosen,
                    opponent,
                    earned,
                    averagePayoff: Math.round((total / round) * 1e6) / 1e6,
                    regrets: [...regret],
                },
            );
            step += 1;
        }
    }

    const averageStrategy = [(played[0] as number) / iterations, (played[1] as number) / iterations];
    const averagePayoff = total / iterations;
    const maxRegret = Math.max(regret[0] as number, regret[1] as number) / iterations;
    yield {
        stepNumber: step,
        entities: snap("", 7).entities.map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `Average strategy ${averageStrategy.map((x) => x.toFixed(3)).join(", ")} earned ${averagePayoff.toFixed(4)} per round with average regret ${maxRegret.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            iterations,
            regrets: regret.map((x) => Math.round(x * 1e6) / 1e6),
            averageStrategy: averageStrategy.map((x) => Math.round(x * 1e6) / 1e6),
            averagePayoff: Math.round(averagePayoff * 1e6) / 1e6,
            averageRegret: Math.round(maxRegret * 1e6) / 1e6,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Regret measures how much better a different action would have been in hindsight. Gradient ascent with averaging always plays the action with the largest accumulated regret. Because that rule can cycle, the useful output is the average of all actions played rather than the last action, and the average strategy approaches equilibrium in zero-sum games.",
        invariants: [
            "The chosen action is one with maximal cumulative regret at that round.",
            "The chosen action's own regret does not increase after the update.",
            "The averages of the played actions always sum to one.",
        ],
        correctness:
            "For the selected action the regret update adds earned minus earned, which is zero, while every alternative adds its payoff advantage over the realized payoff. In a finite zero-sum game the regret of any fixed action grows at most like the square root of the number of rounds, so dividing by the number of rounds makes average regret vanish. A strategy profile with vanishing regret forms an approximate equilibrium.",
        complexityRationale:
            "Each round compares two regrets and updates two values, so T rounds cost O(T * A) time for A actions. Only the regret vector and play counts are stored, giving O(A) space.",
        uses: [
            " repeated zero-sum games and poker abstractions",
            " online decision making under adversarial payoffs",
            " no-regret learning in multi-agent systems",
        ],
        references: [
            "Zinkevich, Online Convex Programming and Generalized Infinitesimal Gradient Ascent (2003)",
            "Cesa-Bianchi and Lugosi, Prediction, Learning, and Games",
        ],
        workedExample:
            "In matching pennies against an opponent who alternates, the highest-regret action can stay fixed at heads because its regret never grows. The average payoff is still near zero and average regret stays near zero, which are the guarantees the rule provides; the average strategy need not be uniform against this deterministic opponent.",
    },
    id: "gradient-ascent-with-averaging",
    name: "Gradient Ascent With Averaging",
    category: "game",
    complexity: { time: "O(T * A)", space: "O(A)" },
    defaultInput: { payoff: [[1, -1], [-1, 1]], iterations: 120 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize all action regrets and play counts to zero",
        "for each round observe the opponent's action",
        "choose an action with maximum cumulative regret",
        "receive the payoff for that action pair",
        "add each action's payoff gain over the chosen one to its regret",
        "increment the chosen action's play count",
        "divide play counts by rounds to get the average strategy",
        "done: report the average strategy and its average regret",
    ],
};

export default module;
