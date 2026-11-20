/**
 * point-biserial-correlation.ts - Point-Biserial Correlation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The point-biserial correlation measures the strength of the linear
 * relationship between a binary variable and a continuous one. It equals the
 * ordinary Pearson correlation when the binary values are coded 0 and 1. A
 * compact closed form compares the continuous mean in the two groups, scaled
 * by the overall standard deviation and the group proportions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for the means and standard deviation
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation with height equal to the continuous value.
 *   - Bars in the ones group are active; bars in the zeros group are visited.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(binary: number[], continuous: number[], revealed: number): VisualEntity[] {
    return continuous.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value.toFixed(2)} (${binary[index]})`,
        value: index < revealed ? value : 0,
        state: binary[index] === 1 ? "active" : "visited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, binary: binary[index] as number },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { binary?: number[]; continuous?: number[] } | null) ?? {};
    const binary = Array.isArray(task.binary) && task.binary.length > 1 ? task.binary.map(Number) : [0, 0, 0, 0, 1, 1, 1, 1];
    const continuous = Array.isArray(task.continuous) && task.continuous.length === binary.length
        ? task.continuous.map(Number)
        : [4, 5, 6, 5, 9, 10, 11, 12];
    const n = binary.length;
    const ones = binary.filter((b) => b === 1).length;
    const zeros = n - ones;
    const p = ones / n;
    const q = zeros / n;
    const meanAll = continuous.reduce((sum, v) => sum + v, 0) / n;
    const m1Values = continuous.filter((_v, i) => binary[i] === 1);
    const m0Values = continuous.filter((_v, i) => binary[i] === 0);
    const m1 = m1Values.length > 0 ? m1Values.reduce((sum, v) => sum + v, 0) / m1Values.length : 0;
    const m0 = m0Values.length > 0 ? m0Values.reduce((sum, v) => sum + v, 0) / m0Values.length : 0;
    const sumSquares = continuous.reduce((sum, v) => sum + (v - meanAll) ** 2, 0);
    const sd = sumSquares > 0 && n > 1 ? Math.sqrt(sumSquares / (n - 1)) : 0;
    const r = sumSquares > 0 && ones > 0 && zeros > 0
        ? ((m1 - m0) * Math.sqrt(n * p * q)) / Math.sqrt(sumSquares)
        : 0;

    yield {
        stepNumber: 0,
        entities: makeBars(binary, continuous, 0),
        edges: [],
        description: `Correlate a binary indicator with a continuous score across ${n} observations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, p, q, m1: 0, m0: 0, sd, r: 0 },
    };
    let step = 1;
    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(binary, continuous, i + 1),
            edges: [],
            description: `Observation ${i + 1}: binary ${binary[i]}, score ${continuous[i]!.toFixed(2)}; group means are accumulating.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, p, q, m1: 0, m0: 0, sd, r: 0 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeBars(binary, continuous, n),
        edges: [],
        description: `Group means ${m0.toFixed(3)} vs ${m1.toFixed(3)} give point-biserial r = ${r.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, p, q, m1, m0, sd, r },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask whether a yes-or-no label lines up with a numerical score. Split the scores into the yes group and the no group and compare their averages. If the yes group scores much higher and the scores are not too noisy, the correlation is large and positive. The formula is just Pearson correlation written in a convenient shortcut form.",
        invariants: [
            "The binary variable takes only the values 0 and 1.",
            "p and q are the proportions of ones and zeros and sum to one.",
            "The result lies between minus one and one.",
        ],
        correctness:
            "Writing Pearson's correlation with the binary vector coded as zeros and ones, the product term is nonzero only for observations in the ones group, which reduces the numerator to n p q times the difference in group means. The binary sum of squares is n p q, so the coefficient equals the mean gap times the square root of n p q divided by the square root of the continuous sum of squares. This is algebraically identical to Pearson's correlation.",

        complexityRationale:
            "Computing the group means, overall mean, and standard deviation scans the data a constant number of times, so time is O(n). The bars require O(n) space.",
        uses: [
            "Relating a pass or fail indicator to a test score",
            "Item analysis in educational measurement",
            "Checking whether a treatment flag tracks a continuous outcome",
        ],
        references: [
            "Pearson, On the Theory of Contingency and Its Relation to Association and Normal Correlation, 1904",
            "Cohen and Lea, Applied Statistics for the Behavioral Sciences, Chapter 9",
        ],
        workedExample:
            "For binary (0,0,0,0,1,1,1,1) and scores (4,5,6,5,9,10,11,12), the zero-group mean is 5 and the one-group mean is 10.5. With p = q = 0.5 and a large overall spread, the point-biserial r is close to one, showing a strong positive association.",
    },
    id: "point-biserial-correlation",
    name: "Point-Biserial Correlation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { binary: [0, 0, 0, 0, 1, 1, 1, 1], continuous: [4, 5, 6, 5, 9, 10, 11, 12] },
    visualType: "array",
    run,
    pseudocode: [
        "split scores into the zero group and the one group",
        "compute the mean of each group",
        "compute the total squared deviation of the scores",
        "compute the proportions p and q of ones and zeros",
        "multiply the mean gap by the square root of n p q",
        "divide by the square root of the squared-deviation sum",
        "report the point-biserial correlation r",
    ],
};

export default module;
