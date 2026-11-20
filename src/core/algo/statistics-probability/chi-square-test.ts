/**
 * chi-square-test.ts - Pearson Chi-Square Goodness-of-Fit Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The chi-square goodness-of-fit test measures how far observed category counts
 * deviate from the counts expected under a hypothesized distribution. The
 * statistic is the sum over categories of (observed - expected)^2 / expected.
 * Under the null it follows a chi-square distribution with k - 1 degrees of
 * freedom, from which a p-value is computed with the regularized upper
 * incomplete gamma function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for the statistic plus O(k * iterations) for the gamma tail
 *   Space: O(k) for the per-category contributions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one row of observed counts, one of expected counts, and one
 *     of the chi-square contribution from each category.
 *   - The category being accumulated is yellow; finished ones are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Log-gamma via the Lanczos approximation. */
function gammaln(x: number): number {
    const cof = [
        76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
        0.001208650973866179, -0.000005395239384953,
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j += 1) {
        y += 1;
        ser += (cof[j] as number) / y;
    }
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularized lower incomplete gamma P(a, x) by series. */
function gser(a: number, x: number): number {
    const eps = 1e-12;
    let ap = a;
    let sum = 1 / a;
    let delta = sum;
    for (let n = 1; n <= 1000; n += 1) {
        ap += 1;
        delta *= x / ap;
        sum += delta;
        if (Math.abs(delta) < Math.abs(sum) * eps) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
}

/** Regularized upper incomplete gamma Q(a, x) by continued fraction. */
function gcf(a: number, x: number): number {
    const eps = 1e-12;
    const fpmin = 1e-300;
    let b = x + 1 - a;
    let c = 1 / fpmin;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 1000; i += 1) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < fpmin) d = fpmin;
        c = b + an / c;
        if (Math.abs(c) < fpmin) c = fpmin;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < eps) break;
    }
    return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

/** Upper tail probability of the chi-square distribution. */
function chiSquareSurvival(chi2: number, df: number): number {
    if (chi2 <= 0) return 1;
    const a = df / 2;
    const x = chi2 / 2;
    return x < a + 1 ? 1 - gser(a, x) : gcf(a, x);
}

/** Build the observed, expected, and contribution rows. */
function makeCells(
    observed: number[],
    expected: number[],
    contributions: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const cols = observed.length;
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            let state: EntityState = "idle";
            if (row === 2 && (done || col < current)) state = "sorted";
            if (row === 2 && col === current && !done) state = "comparing";
            let label: string;
            let value: number;
            if (row === 0) {
                label = `O ${observed[col]}`;
                value = observed[col] as number;
            } else if (row === 1) {
                label = `E ${(expected[col] as number).toFixed(1)}`;
                value = expected[col] as number;
            } else {
                const c = contributions[col];
                label = c === null || c === undefined ? "-" : c.toFixed(2);
                value = c ?? 0;
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The chi-square goodness-of-fit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { observed?: number[]; expected?: number[]; alpha?: number } | null) ?? {};
    const observed = Array.isArray(task.observed) && task.observed.length >= 2
        ? task.observed.map(Number)
        : [25, 20, 15, 10, 30];
    const total = observed.reduce((a, b) => a + b, 0);
    let expected = Array.isArray(task.expected) && task.expected.length === observed.length
        ? task.expected.map(Number)
        : observed.map(() => total / observed.length);
    const expectedTotal = expected.reduce((a, b) => a + b, 0);
    if (expectedTotal > 0 && Math.abs(expectedTotal - total) > 1e-9) {
        expected = expected.map((e) => (e * total) / expectedTotal);
    }
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.05;
    const df = observed.length - 1;
    const contributions: Array<number | null> = observed.map(() => null);

    yield {
        stepNumber: 0,
        entities: makeCells(observed, expected, contributions, -1, false),
        edges: [],
        description: `Chi-square goodness-of-fit over ${observed.length} categories with ${df} degree(s) of freedom.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: observed.length, chi2: 0, df, pValue: 1, alpha, significant: false },
    };
    let step = 1;
    let chi2 = 0;

    for (let i = 0; i < observed.length; i += 1) {
        const contribution = ((observed[i] as number) - (expected[i] as number)) ** 2 /
            Math.max(1e-12, expected[i] as number);
        contributions[i] = contribution;
        chi2 += contribution;
        yield {
            stepNumber: step,
            entities: makeCells(observed, expected, contributions, i, false),
            edges: [],
            description: `Category ${i}: (${observed[i]} - ${(expected[i] as number).toFixed(1)})^2 / ${(expected[i] as number).toFixed(1)} = ${contribution.toFixed(4)}; running chi-square ${chi2.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 3,
                cols: observed.length,
                chi2,
                df,
                pValue: chiSquareSurvival(chi2, df),
                alpha,
                significant: false,
            },
        };
        step += 1;
    }

    const pValue = chiSquareSurvival(chi2, df);
    yield {
        stepNumber: step,
        entities: makeCells(observed, expected, contributions, observed.length, true),
        edges: [],
        description: `Chi-square ${chi2.toFixed(4)} with ${df} degree(s) of freedom; p-value ${pValue.toFixed(5)}${pValue < alpha ? ", reject the null" : ", fail to reject the null"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 3, cols: observed.length, chi2, df, pValue, alpha, significant: pValue < alpha },
    };
}

/** The chi-square test module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Compare what you counted with what the hypothesis predicts. For each category, square the gap between observed and expected and divide by the expected count, then add the results. A large total means the data fit the hypothesis poorly. The degrees of freedom count how many categories could vary freely after fixing the total.",
        invariants: [
            "The expected counts are rescaled to sum to the observed total.",
            "Each contribution is nonnegative.",
            "The degrees of freedom equal the number of categories minus one.",
        ],
        correctness:
            "Each standardized squared deviation has an approximately standard normal distribution, and the sum of k minus one independent squared standard normals follows a chi-square distribution with k minus one degrees of freedom. The p-value is the upper tail of that distribution, computed as the regularized upper incomplete gamma function Q(df/2, chi-square/2). A small p-value means a statistic this large would be rare under the null.",
        complexityRationale:
            "Forming the statistic scans the k categories once, O(k). The gamma tail uses a series or continued fraction with a bounded number of iterations, so the overall cost is O(k) up to that fixed constant, and O(k) space holds the contribution row.",
        uses: [
            "Testing whether observed frequencies match a predicted distribution",
            "Testing independence in contingency tables",
            "Checking goodness of fit in genetics and survey analysis",
        ],
        references: [
            "Pearson, On the Criterion for a Good Criterion of Goodness of Fit, 1900",
            "Press et al., Numerical Recipes, Section on Incomplete Gamma Functions",
        ],
        workedExample:
            "With observed counts 25, 20, 15, 10, 30 and equal expected counts of 20, the contributions are 1.25, 0, 1.25, 5, and 5, giving chi-square 12.5 with four degrees of freedom and a p-value near 0.014, so the null is rejected at the 0.05 level.",
    },
    id: "chi-square-test",
    name: "Chi-Square Goodness-of-Fit Test",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { observed: [25, 20, 15, 10, 30], expected: [20, 20, 20, 20, 20], alpha: 0.05 },
    visualType: "grid",
    run,
    pseudocode: [
        "compute expected counts and degrees of freedom",
        "for each category",
        "add observed minus expected squared, divided by expected",
        "form the chi-square statistic from the contributions",
        "evaluate the upper gamma tail to get the p-value",
        "compare the p-value with the significance level",
        "done: report the statistic, degrees of freedom, and verdict",
    ],
};

export default module;
