/**
 * jarque-bera-test.ts - Jarque-Bera Normality Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Jarque-Bera test checks whether a sample could come from a normal
 * distribution by measuring how far its skewness and excess kurtosis sit from
 * the normal values of zero. The statistic is nonnegative and, for large
 * samples, follows a chi-square distribution with two degrees of freedom.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n sample values
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sample value is drawn as a bar.
 *   - The bar contributing to the current moment is highlighted.
 *   - The final frame is green and reports skewness, excess kurtosis, the
 *     statistic, and its tail probability.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: done ? "sorted" : (index === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Number(v) || 0)
        : [-2, -1, 0, 1, 2, 8];
    const n = values.length;
    const mean = values.reduce((total, v) => total + v, 0) / n;
    let m2 = 0;
    let m3 = 0;
    let m4 = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Testing normality of ${n} value(s) around the sample mean ${mean.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, mean, m2: 0, m3: 0, m4: 0 },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const d = (values[i] ?? 0) - mean;
        const d2 = d * d;
        m2 += d2;
        m3 += d2 * d;
        m4 += d2 * d2;
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false),
            edges: [],
            description: `Value ${values[i]?.toFixed(3)} contributes deviation ${d.toFixed(4)} to the central moments.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, mean, current: i, m2, m3, m4 },
        };
        step += 1;
    }

    m2 /= n;
    m3 /= n;
    m4 /= n;
    const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
    const kurtosis = m2 > 0 ? m4 / (m2 * m2) : 0;
    const excess = m2 > 0 ? kurtosis - 3 : 0;
    const statistic = (n / 6) * (skewness * skewness + (excess * excess) / 4);
    const pValue = Math.exp(-statistic / 2);

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Skewness ${skewness.toFixed(4)}, excess kurtosis ${excess.toFixed(4)}; assembling the test statistic.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, mean, skewness, kurtosis, excess },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true),
        edges: [],
        description: `Jarque-Bera statistic ${statistic.toFixed(4)} with tail probability ${pValue.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, skewness, kurtosis, excess, statistic, pValue, rejectAtFivePercent: pValue < 0.05 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal distribution is symmetric and has a specific tail heaviness, so its skewness is zero and its kurtosis is three. The Jarque-Bera test measures how far a sample departs from those two targets and combines the gaps into one number. A large value means the sample looks non-normal.",
        invariants: [
            "The statistic is always nonnegative because it is a sum of two squares.",
            "A perfectly symmetric sample has zero sample skewness.",
            "For a normal sample the statistic approaches a chi-square law with two degrees of freedom as n grows.",
        ],
        correctness:
            "The central moments are computed about the sample mean, and dividing the third by m2 to the three-halves gives skewness while dividing the fourth by m2 squared gives kurtosis. Under normality these two summaries are asymptotically independent and each contributes one degree of freedom, so their squared weighted sum follows chi-square with two degrees of freedom. The survivor function of that law is exp(-statistic/2), which is the reported p-value.",
        complexityRationale:
            "Accumulating the second, third, and fourth central moments scans the n values once, so the time is O(n). Only the accumulators and the bars are stored, giving O(n) space.",
        uses: [
            "Checking the normality assumption before parametric tests",
            "Diagnostic checks on regression residuals",
            "Quick screening of financial returns for fat tails",
        ],
        references: [
            "Jarque and Bera, Efficient Tests for Normality, 1980",
            "Bera and Jarque, Model Specification Tests, 1982",
        ],
        workedExample:
            "For the perfectly symmetric sample -2, -1, 0, 1, 2 the skewness is zero and the kurtosis is 1.7, so the excess is -1.3 and the statistic is (5/6) times ((-1.3)^2 / 4), about 0.35. A sample with a single extreme value gives a much larger statistic.",
    },
    id: "jarque-bera-test",
    name: "Jarque-Bera Test",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-2, -1, 0, 1, 2, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "read n values and compute the sample mean",
        "accumulate the second, third, and fourth central moments",
        "divide each moment by n to get the moment estimates",
        "set skewness to m3 over m2 to the three-halves power",
        "set excess kurtosis to m4 over m2 squared minus three",
        "set the statistic to n over six times (skewness squared plus excess squared over four)",
        "report the statistic and its chi-square tail probability",
    ],
};

export default module;
