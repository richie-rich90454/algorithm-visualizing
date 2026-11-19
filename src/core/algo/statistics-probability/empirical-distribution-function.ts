/**
 * empirical-distribution-function.ts - Empirical Distribution Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The empirical distribution function, or ECDF, of a data set reports the
 * fraction of observations less than or equal to a query value. It is a step
 * function that climbs by one over the sample size at each observed value.
 * The module sorts the sample, then walks it once per query, highlighting each
 * observation as it is compared with the query threshold.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n + q * n) for n observations and q queries
 *   Space: O(n) for the displayed sorted bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The sorted observations are shown as bars.
 *   - Bars at or below the current query are GREEN, the compared bar YELLOW.
 *   - The final frame reports every query answer.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], query: number | null, active: number | null, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (active === index) {
            state = "comparing";
        } else if (!done && query !== null && value <= query) {
            state = "sorted";
        } else if (done) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; queries?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values)
        ? [...task.values].map((v) => Number(v) || 0).sort((a, b) => a - b)
        : [1, 2, 2, 4, 7, 9].sort((a, b) => a - b);
    const queries: number[] = Array.isArray(task.queries) ? task.queries.map((v) => Number(v) || 0) : [0, 2, 5, 9];
    const n = values.length;
    const results: number[] = [];
    let step = 0;

    const frame = (
        query: number | null,
        active: number | null,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, query, active, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { n, query: query ?? 0, count: 0, ecdf: 0, results: [...results], ...extra },
    });

    yield frame(null, null, false, `Sorted ${n} observation(s) to evaluate the empirical distribution function.`, 0);
    step += 1;

    for (const query of queries) {
        let count = 0;
        for (let i = 0; i < n; i += 1) {
            const value = values[i] ?? 0;
            if (value <= query) count += 1;
            yield frame(query, i, false, `Query ${query}: observation ${value} is ${value <= query ? "at or below" : "above"} the threshold; count ${count}.`, 3, { count });
            step += 1;
        }
        const ecdf = n === 0 ? 0 : count / n;
        results.push(ecdf);
        yield frame(query, null, false, `ECDF(${query}) = ${count} out of ${n} = ${ecdf}.`, 4, { count, ecdf });
        step += 1;
    }

    yield frame(null, null, true, `Evaluated all ${queries.length} query value(s) against the empirical distribution.`, 5, { results });
}

/** The empirical distribution function module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The empirical distribution function is the simplest estimate of a cumulative distribution from data. For any threshold, count how many observations fall at or below it and divide by the sample size. As the sample grows, this step function approaches the true cumulative distribution by the Glivenko-Cantelli theorem.",
        invariants: [
            "The observations are held in sorted order, so the count grows monotonically during a query.",
            "Every ECDF value lies between zero and one.",
            "The ECDF is a nondecreasing step function of the query threshold.",
        ],
        correctness:
            "Sorting does not change which observations are at or below a threshold, so walking the sorted array and incrementing when a value is at most the query counts exactly the observations needed by the definition. Dividing by the sample size gives the empirical probability. Because each new threshold can only include more observations, the function is monotone, and at the largest observation it equals one.",
        complexityRationale:
            "Sorting costs O(n log n) once. Each of the q queries scans the n observations, giving O(q * n); the bars are the only O(n) space beyond the result list.",
        uses: [
            "Checking whether a sample follows a reference distribution",
            "Computing empirical quantiles and percentile ranks",
            "Plotting nonparametric survival curves",
        ],
        references: [
            "Devore, Probability and Statistics for Engineering and the Sciences, Chapter 9",
            "Wasserman, All of Nonparametric Statistics, Chapter 2",
        ],
        workedExample:
            "For the sorted sample 1, 2, 2, 4, 7, 9, the query 2 counts three observations at or below it, so the ECDF is 3 over 6, or 0.5. The query 5 counts four observations, giving about 0.667, and the query 9 counts all six, giving 1.",
    },
    id: "empirical-distribution-function",
    name: "Empirical Distribution Function",
    category: "statistics-probability",
    complexity: { time: "O(n log n + q * n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 2, 4, 7, 9], queries: [0, 2, 5, 9] },
    visualType: "array",
    run,
    pseudocode: [
        "sort the observations in ascending order",
        "set the result list to empty",
        "for each query threshold set the count to zero",
        "walk the sorted observations and count those at or below the threshold",
        "append count divided by the sample size to the result list",
        "done: report the empirical distribution values",
    ],
};

export default module;
