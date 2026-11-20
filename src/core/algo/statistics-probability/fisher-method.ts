/**
 * fisher-method.ts - Fisher's Combined Probability Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fisher's method combines independent p values from several studies into one
 * statistic. Under the null each p value is uniform, so minus two times its
 * natural log has a chi-square distribution with two degrees of freedom.
 * Adding those terms gives a chi-square statistic with twice as many degrees
 * of freedom as there are studies.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k p values
 *   Space: O(k) for the displayed contribution bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each study contributes one bar of height minus two log of its p value.
 *   - The study currently being added is highlighted.
 *   - The final frame reports the combined statistic and degrees of freedom.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function clampP(value: number): number {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.min(1, Math.max(1e-12, value));
}

function makeBars(pValues: number[], active: number, done: boolean): VisualEntity[] {
    return pValues.map((raw, index) => {
        const contribution = -2 * Math.log(clampP(raw));
        let state: EntityState = done ? "sorted" : "idle";
        if (!done && index === active) {
            state = "active";
        }
        return {
            id: `study-${index}`,
            type: "bar" as const,
            label: contribution.toFixed(3),
            value: contribution,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, pValue: raw, contribution },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pValues?: number[] } | null) ?? {};
    const pValues: number[] = Array.isArray(task.pValues)
        ? task.pValues.slice()
        : [0.041, 0.013, 0.36, 0.006];
    const k = pValues.length;

    yield {
        stepNumber: 0,
        entities: makeBars(pValues, -1, false),
        edges: [],
        description: `Combining ${k} independent p value(s) with Fisher's method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, statistic: 0, df: 2 * k },
    };
    let step = 1;
    let statistic = 0;

    for (let i = 0; i < k; i += 1) {
        const contribution = -2 * Math.log(clampP(pValues[i] ?? 1));
        statistic += contribution;
        yield {
            stepNumber: step,
            entities: makeBars(pValues, i, false),
            edges: [],
            description: `Study ${i + 1} has p = ${(pValues[i] ?? 1).toFixed(4)}, adding ${contribution.toFixed(4)} to the statistic.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { k, statistic, df: 2 * k },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pValues, -1, true),
        edges: [],
        description: `Fisher's combined statistic is ${statistic.toFixed(4)} on ${2 * k} degrees of freedom.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { k, statistic, df: 2 * k },
    };
}

/** The Fisher method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Several modest signals can add up to strong evidence. Fisher's method turns each p value into a chi-square contribution that grows as the p value shrinks, then adds the contributions, so a collection of small p values yields a large combined statistic.",
        invariants: [
            "A p value of one contributes exactly zero to the statistic.",
            "Each contribution minus two log of p is nonnegative.",
            "The combined statistic has two times k degrees of freedom.",
        ],
        correctness:
            "Under the null hypothesis each p value is uniform on zero to one, so negative two times its log is exponential with mean two, equivalently chi-square with two degrees of freedom. Independent studies sum to a chi-square with two times k degrees of freedom, which is why the total statistic is a valid combined test.",
        complexityRationale:
            "One logarithm is taken per p value and the contributions are accumulated in a single pass, so time is linear in k; the contribution bars use linear space.",
        uses: [
            "Meta-analysis of independent clinical trials",
            "Combining results across genome-wide association studies",
            "Aggregating signals from repeated experiments",
        ],
        references: [
            "Fisher, Statistical Methods for Research Workers, 1925",
            "Hedges and Olkin, Statistical Methods for Meta-Analysis, 1985",
        ],
        workedExample:
            "For p values 0.041, 0.013, 0.36 and 0.006 the contributions are about 6.39, 8.68, 2.04 and 10.19. They sum to about 27.3 on eight degrees of freedom, which is strong evidence against the global null.",
    },
    id: "fisher-method",
    name: "Fisher's Combined Probability Test",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { pValues: [0.041, 0.013, 0.36, 0.006] },
    visualType: "array",
    run,
    pseudocode: [
        "read the list of independent p values",
        "initialize the combined statistic to zero",
        "for each study take the natural logarithm of its p value",
        "add negative two times that logarithm to the statistic",
        "note the statistic has two times k degrees of freedom",
        "smaller p values give larger combined statistics",
        "done: report Fisher's combined statistic",
    ],
};

export default module;
