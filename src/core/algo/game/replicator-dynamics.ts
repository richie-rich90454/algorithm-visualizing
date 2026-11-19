/**
 * replicator-dynamics.ts - Replicator Dynamics
 *
 * The replicator equation is the workhorse of evolutionary game theory. A
 * strategy's share of the population grows in proportion to how much its
 * payoff exceeds the population average. Strategies that do better than
 * average increase; those that do worse shrink; the frequencies always sum
 * to one.
 *
 * Time:  O(T * n^2) for T generations and n strategies; Space: O(T * n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoffs?: number[][]; initial?: number[]; steps?: number } | null) ?? {};
    const payoffs: number[][] = task.payoffs ?? [
        [3, 0],
        [5, 1],
    ];
    const n = payoffs.length;
    let x: number[] = task.initial && task.initial.length === n ? task.initial.slice() : new Array<number>(n).fill(1 / n);
    const total = x.reduce((a, b) => a + b, 0);
    x = x.map((v) => v / total);
    const steps = typeof task.steps === "number" ? Math.max(0, Math.min(task.steps, 30)) : 8;

    let step = 0;
    const trajectory: number[][] = [x.slice()];

    const frame = (message: string, line: number, generation: number): VisualFrame => {
        const entities: VisualEntity[] = x.map((freq, i) => ({
            id: `strategy-${i}`,
            type: "bar" as const,
            label: `s${i}: ${freq.toFixed(3)}`,
            value: freq,
            state: (i === generation % n ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { strategy: i, generation },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                trajectory: trajectory.map((row) => JSON.stringify(row)),
                generation,
                sum: x.reduce((a, b) => a + b, 0),
                strategies: n,
            },
        };
    };

    yield frame(`Generation 0: ${n} strategies start at equal frequencies.`, 0, 0);
    step += 1;

    for (let g = 1; g <= steps; g += 1) {
        const fitness = x.map((_, i) => payoffs[i]!.reduce((sum, p, j) => sum + p * x[j]!, 0));
        const average = x.reduce((sum, freq, i) => sum + freq * fitness[i]!, 0);
        x = x.map((freq, i) => (average === 0 ? freq : (freq * fitness[i]!) / average));
        const norm = x.reduce((a, b) => a + b, 0);
        x = x.map((v) => v / norm);
        trajectory.push(x.slice());
        const leader = fitness.indexOf(Math.max(...fitness));
        yield frame(
            `Generation ${g}: strategy ${leader} has the highest payoff; frequencies updated.`,
            3,
            leader,
        );
        step += 1;
    }

    yield frame(`Done after ${steps} generations; frequencies sum to ${x.reduce((a, b) => a + b, 0).toFixed(3)}.`, 5, 0);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each strategy as a species sharing a fixed population. In every generation a strategy earns a payoff from playing against the current mix. If it earns more than the population average it attracts a larger share next generation; if it earns less its share contracts. Over time the population drifts toward the strategies that do best against themselves and each other.",
        invariants: [
            "Frequencies are nonnegative and always sum to one.",
            "A strategy above the average payoff increases its share.",
            "A strategy below the average payoff decreases its share.",
        ],
        correctness:
            "Each update multiplies a strategy's frequency by its payoff divided by the population average payoff. Because the average is the frequency-weighted sum of all payoffs, the new frequencies sum to one after normalization. The sign of the change is the sign of payoff minus average, so better-than-average strategies grow and worse-than-average ones shrink, which is exactly the replicator principle.",
        complexityRationale:
            "Computing each strategy's payoff multiplies an n-vector by the n by n payoff matrix, costing O(n^2) per generation, repeated T times. Recording the trajectory uses O(T * n) space, and the working state is O(n).",
        uses: [
            "Modeling extinction and coexistence in biology",
            "Evolutionary game theory and stable strategies",
            "Replicator equations in population genetics",
        ],
        references: [
            "Maynard Smith, Evolution and the Theory of Games, 1982",
            "Weibull, Evolutionary Game Theory, 1995",
        ],
        workedExample:
            "With payoffs [[3,0],[5,1]] and equal starting frequencies, strategy one earns 1.5 and strategy two earns 3.0 on average, so the population average is 2.25. The next frequencies are 0.5 times 1.5 over 2.25 and 0.5 times 3 over 2.25, about 0.33 and 0.67, showing the higher-payoff strategy growing.",
    },
    id: "replicator-dynamics",
    name: "Replicator Dynamics",
    category: "game",
    complexity: { time: "O(T n^2)", space: "O(T n)" },
    defaultInput: {
        payoffs: [[3, 0], [5, 1]],
        initial: [0.5, 0.5],
        steps: 8,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize strategy frequencies summing to one",
        "for each generation compute each strategy payoff",
        "compute the population average payoff",
        "multiply each frequency by payoff over average",
        "normalize the new frequencies to sum to one",
        "record the trajectory for replay",
        "done: report final stable frequencies",
    ],
};

export default module;
