/**
 * zipf-distribution.ts - Zipf Distribution Over Ranks
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Zipf's law says that the frequency of an item is inversely proportional to
 * its rank: the most common item occurs about twice as often as the second,
 * three times as often as the third, and so on. With exponent s and N ranks the
 * probability of rank k is k to the minus s divided by the generalized harmonic
 * number H(N, s). The module builds the probability mass function, its cumulative
 * distribution, and the mean rank.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N ranks
 *   Space: O(N) for the displayed mass and cumulative arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per rank shows its probability mass.
 *   - The rank being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the normalizer and the mean rank.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ZipfInput {
    N?: number;
    s?: number;
}

function makeBars(mass: number[], current: number, done: boolean): VisualEntity[] {
    return mass.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `rank ${index + 1}: ${value.toFixed(5)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, rank: index + 1, mass: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ZipfInput | null) ?? {};
    const N = typeof task.N === "number" ? Math.max(1, Math.floor(task.N)) : 10;
    const s = typeof task.s === "number" ? task.s : 1;
    let harmonic = 0;
    for (let k = 1; k <= N; k += 1) {
        harmonic += Math.pow(k, -s);
    }
    const pmf: number[] = [];
    const cdf: number[] = [];
    let cumulative = 0;
    let mean = 0;
    let step = 0;

    const frame = (current: number, done: boolean, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(
            pmf.length === 0
                ? new Array<number>(N).fill(0)
                : [...pmf, ...new Array<number>(N - pmf.length).fill(0)],
            current,
            done,
        ),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            N,
            s,
            harmonic,
            pmf: [...pmf],
            cdf: [...cdf],
            massSum: pmf.reduce((a, b) => a + b, 0),
            mean,
        },
    });

    yield frame(-1, false, `Building a Zipf mass function over ${N} ranks with exponent ${s}.`, 0);
    step += 1;

    for (let k = 1; k <= N; k += 1) {
        const mass = Math.pow(k, -s) / harmonic;
        cumulative += mass;
        mean += k * mass;
        pmf.push(mass);
        cdf.push(cumulative);
        yield frame(k - 1, false, `Rank ${k}: weight ${Math.pow(k, -s).toFixed(5)}, mass ${mass.toFixed(5)}, cumulative ${cumulative.toFixed(5)}.`, 3);
        step += 1;
    }

    yield frame(-1, true, `Zipf law complete: mass sums to ${cumulative.toFixed(5)} using H(N,s) = ${harmonic.toFixed(5)}; mean rank ${mean.toFixed(4)}.`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In many ranked systems the top entry is roughly twice as popular as the second, which is twice as popular as the fourth. Zipf's law captures that pattern with a simple power of the rank. Dividing each power by the sum of all powers makes the ranks a proper probability distribution, and a larger exponent makes the drop-off steeper so the top ranks dominate even more.",
        invariants: [
            "Probability mass decreases with rank when the exponent is positive.",
            "All N masses are nonnegative and sum to one.",
            "The cumulative distribution ends at one and never decreases.",
        ],
        correctness:
            "Rank k receives unnormalized weight k to the minus s, so dividing by the generalized harmonic number H(N, s) makes the weights sum to one by construction. The cumulative array is the running sum of those masses and therefore ends at one. The mean rank is the sum of k times its mass, which is the expectation of a discrete random variable with this mass function. For s equal to one the normalizer is the ordinary harmonic number, reproducing the classic inverse-rank law.",
        complexityRationale:
            "The harmonic sum and the mass sweep each touch the N ranks once with constant work, so time is O(N); storing one bar and two arrays per rank uses O(N) space.",
        uses: [
            "Modeling word frequencies in natural language corpora",
            "Describing city populations and rank-size relationships",
            "Approximating request popularity in web caching studies",
        ],
        references: [
            "Zipf, Human Behavior and the Principle of Least Effort, 1949",
            "Newman, Power laws, Pareto distributions and Zipf's law, Contemporary Physics, 2005",
        ],
        workedExample:
            "For N = 4 and s = 1 the harmonic normalizer is 1 + 1/2 + 1/3 + 1/4 = 2.0833. The masses are about 0.480, 0.240, 0.160, and 0.120, summing to one, and the mean rank is about 1.68.",
    },
    id: "zipf-distribution",
    name: "Zipf Distribution",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: { N: 10, s: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number of ranks N and the exponent s",
        "compute the normalizer as the sum of k to the minus s for k from 1 to N",
        "set the cumulative sum and mean rank to zero",
        "for each rank k set mass to k to the minus s divided by the normalizer",
        "add the mass to the cumulative sum and k times mass to the mean",
        "record the cumulative probability at rank k",
        "done: report the mass function, cumulative function, and mean rank",
    ],
};

export default module;
