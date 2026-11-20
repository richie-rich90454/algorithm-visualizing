/**
 * bagging.ts - Bootstrap Aggregating (Bagging)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bagging reduces a model's variance by fitting the same base estimator on many
 * bootstrap samples drawn with replacement, then averaging their predictions.
 * This demo uses the sample mean as the base estimator, so the mechanism of
 * resampling and averaging is exact and easy to verify. Bootstrap index sets
 * are supplied explicitly to keep the replay deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(B * m) for B replicates of mean sample size m
 *   Space: O(B) for the replicate predictions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars first show the training values, then one bar per bootstrap
 *     replicate's prediction, and finally the bagged average.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    values?: number[];
    samples?: number[][];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: labels?.[i] ?? v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value: v },
    }));
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, v) => a + v, 0) / values.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const values = (task.values ?? [1, 2, 3, 4, 5]).slice();
    const samples: number[][] = task.samples ?? [
        [0, 1, 2, 3, 4],
        [1, 2, 3],
        [0, 0, 4, 4],
        [2, 2, 2],
    ];
    const predictions = samples.map((sample) =>
        mean(sample.map((idx) => values[idx] ?? 0)),
    );
    const aggregate = mean(predictions);
    const state = (s: EntityState, n: number): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(values, state("idle", values.length), values.map((v) => v.toFixed(2))),
        edges: [],
        description: `Bagging with ${samples.length} bootstrap replicates over ${values.length} training values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: values.length, bootstraps: samples.length, values },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(values, state("comparing", values.length), values.map((v) => v.toFixed(2))),
        edges: [],
        description: "Each replicate draws its rows with replacement from the training set.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n: values.length, bootstraps: samples.length, sampleSizes: samples.map((s) => s.length) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(predictions, state("active", predictions.length), predictions.map((v) => v.toFixed(3))),
        edges: [],
        description: "Fit the base estimator on each sample and collect one prediction per replicate.",
        codeLineNumber: 3,
        layout: "array",
        meta: { n: values.length, bootstraps: samples.length, predictions },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(predictions, state("sorted", predictions.length), predictions.map((v) => v.toFixed(3))),
        edges: [],
        description: `Average the replicate predictions into the bagged estimate ${aggregate.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n: values.length, bootstraps: samples.length, predictions, aggregate, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single model fitted on one data set can be unstable: a small change in the training rows shifts its prediction. Bagging fits many copies of the model on random resamples of the data and averages them. Because the resampling errors are roughly independent, averaging cancels much of the variance while keeping the bias about the same.",
        invariants: [
            "Every bootstrap sample is drawn with replacement, so rows can repeat.",
            "Each replicate uses the same base estimator and the same settings.",
            "The final prediction is the plain average of all replicate predictions.",
        ],
        correctness:
            "Averaging B identically distributed estimators preserves the expectation because the mean of expectations equals the expectation of the mean. If the replicate errors have variance sigma squared and pairwise correlation rho, the averaged variance is sigma squared times rho plus one minus rho over B, which is no larger than a single model's variance and shrinks toward rho sigma squared as B grows. Thus bagging reduces variance without adding bias.",
        complexityRationale:
            "Fitting each of the B base estimators on a sample of average size m costs O(m) work here, so total time is O(B times m). Storing the B replicate predictions uses O(B) space in addition to the data.",
        uses: [
            "Random forests, which bag decision trees with random feature selection",
            "Stabilizing high-variance estimators such as unpruned trees",
            "Out-of-bag error estimation using the unused rows of each replicate",
        ],
        references: [
            "Breiman, Bagging Predictors, Machine Learning, 1996",
            "Efron and Tibshirani, An Introduction to the Bootstrap, 1993",
        ],
        workedExample:
            "Training values 1 through 5 are resampled into four replicates whose means are 3, 2, 3, and 3. Bagging averages these to 2.75. Each replicate saw a slightly different data set, and the average is more stable than relying on any one of them alone.",
    },
    id: "bagging",
    name: "Bagging",
    category: "ml-ai",
    complexity: { time: "O(B m)", space: "O(B)" },
    defaultInput: {
        values: [1, 2, 3, 4, 5],
        samples: [
            [0, 1, 2, 3, 4],
            [1, 2, 3],
            [0, 0, 4, 4],
            [2, 2, 2],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the training values and the bootstrap index sets",
        "for each replicate draw rows with replacement from the data",
        "fit the base estimator, here the mean of the sampled rows",
        "collect one prediction from every bootstrap replicate",
        "average all replicate predictions into the bagged estimate",
        "done: emit replicate predictions and the aggregate",
    ],
};

export default module;
