/**
 * kaplan-meier-estimator.ts - Kaplan-Meier Product-Limit Survival Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kaplan-Meier estimator estimates the survival function from right-censored
 * lifetimes. At each observed event time it multiplies the current survival
 * probability by (1 - d / n), where d is the number of events at that time and n
 * is the number of subjects still at risk. Censored subjects stay in the risk set
 * up to their censoring time but do not themselves cause a drop in the curve.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for sorting plus O(n) for the risk-set scan
 *   Space: O(n) for the sorted records and the survival table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A four-row grid: distinct time, number at risk, events, survival.
 *   - The column being processed is yellow; finished columns are green.
 *   - The final frame reports the curve and the median survival time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Observed {
    time: number;
    event: number;
}

/** Build the four-row survival table. */
function makeCells(
    times: number[],
    riskSets: number[],
    eventCounts: number[],
    survival: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows = [times, riskSets, eventCounts, survival];
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < times.length; col += 1) {
            let state: EntityState = "idle";
            if (done || col < current) state = "sorted";
            else if (col === current) state = "comparing";
            const labels = [
                `t ${(times[col] as number).toFixed(2)}`,
                `n ${riskSets[col]}`,
                `d ${eventCounts[col]}`,
                `S ${(survival[col] as number).toFixed(3)}`,
            ];
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: labels[row] as string,
                value: (rows[row] as number[])[col] ?? 0,
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

/** The Kaplan-Meier generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { times?: number[]; events?: number[] } | null) ?? {};
    const times = Array.isArray(task.times) ? task.times.map(Number) : [1, 2, 2, 3, 4, 5, 5, 8, 9, 12];
    const eventsInput = Array.isArray(task.events) ? task.events.map(Number) : [1, 1, 0, 1, 0, 1, 1, 0, 1, 1];
    const n = Math.min(times.length, eventsInput.length);
    const records: Observed[] = [];
    for (let i = 0; i < n; i += 1) {
        records.push({ time: times[i] as number, event: eventsInput[i] === 1 ? 1 : 0 });
    }
    records.sort((a, b) => a.time - b.time);

    const tableTimes: number[] = [];
    const riskSets: number[] = [];
    const eventCounts: number[] = [];
    const survival: number[] = [];
    const eventTotal = records.reduce((sum, r) => sum + r.event, 0);

    yield {
        stepNumber: 0,
        entities: makeCells(tableTimes, riskSets, eventCounts, survival, -1, false),
        edges: [],
        description: `Kaplan-Meier estimate of ${n} subjects with ${eventTotal} observed event(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: 0, n, eventTotal, survival: [], times: [], medianSurvival: "none" },
    };
    let step = 1;
    let currentSurvival = 1;
    let medianSurvival = "none";
    let i = 0;

    while (i < n) {
        const t = records[i]?.time as number;
        let eventHere = 0;
        while (i < n && records[i]?.time === t) {
            eventHere += records[i]?.event ?? 0;
            i += 1;
        }
        let atRisk = 0;
        for (const record of records) {
            if (record.time >= t) atRisk += 1;
        }
        if (eventHere > 0 && atRisk > 0) {
            currentSurvival = Math.min(1, Math.max(0, currentSurvival * (1 - eventHere / atRisk)));
        }
        tableTimes.push(t);
        riskSets.push(atRisk);
        eventCounts.push(eventHere);
        survival.push(currentSurvival);
        if (medianSurvival === "none" && currentSurvival <= 0.5) medianSurvival = String(t);

        yield {
            stepNumber: step,
            entities: makeCells(tableTimes, riskSets, eventCounts, survival, tableTimes.length - 1, false),
            edges: [],
            description: `Time ${t.toFixed(2)}: ${atRisk} at risk, ${eventHere} event(s), survival S = ${currentSurvival.toFixed(4)}.`,
            codeLineNumber: eventHere > 0 ? 3 : 2,
            layout: "grid",
            meta: {
                rows: 4,
                cols: tableTimes.length,
                n,
                eventTotal,
                survival: [...survival],
                times: [...tableTimes],
                medianSurvival,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(tableTimes, riskSets, eventCounts, survival, tableTimes.length, true),
        edges: [],
        description: `Survival curve over ${tableTimes.length} distinct time(s); median survival ${medianSurvival}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 4,
            cols: tableTimes.length,
            n,
            eventTotal,
            times: [...tableTimes],
            riskSets: [...riskSets],
            eventCounts: [...eventCounts],
            survival: [...survival],
            medianSurvival,
        },
    };
}

/** The Kaplan-Meier module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a cohort of patients followed over time. Some have the event of interest, others leave the study early, and those censored subjects still contribute information up to the day they were last seen. The survival curve only steps down when an event actually occurs, and the size of each step depends on how many people were still being followed at that moment.",
        invariants: [
            "The survival estimate starts at one and never increases.",
            "Censored observations reduce the risk set but do not lower the curve.",
            "The number at risk at time t is the count of subjects with observed time at least t.",
        ],
        correctness:
            "Conditional on surviving to just before time t, the estimated probability of surviving past t is one minus the event fraction d over n, which is the maximum-likelihood estimate of that conditional probability. Multiplying the conditional probabilities across event times gives the product-limit estimate of the survival function, the Kaplan-Meier estimator, which is a consistent and unbiased step estimator under independent censoring.",
        complexityRationale:
            "Sorting the n records dominates at O(n log n). Each distinct time scans the records to count the risk set, and the sum of those scans is O(n squared) in the worst case with all times distinct, using O(n) space for the sorted records and table.",
        uses: [
            "Estimating patient survival in clinical trials",
            "Modeling time to failure in reliability engineering",
            "Analyzing time to churn or conversion with censored users",
        ],
        references: [
            "Kaplan and Meier, Nonparametric Estimation from Incomplete Observations, 1958",
            "Klein and Moeschberger, Survival Analysis: Techniques for Censored and Truncated Data, Chapter 3",
        ],
        workedExample:
            "With ten subjects followed to times 1 through 12 and two censored before their event, the first event at time 1 drops survival from 1 to 0.9 when all ten are at risk. A later time with one event among six at risk multiplies by five sixths, and the curve continues stepping down until the median is reached.",
    },
    id: "kaplan-meier-estimator",
    name: "Kaplan-Meier Estimator",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { times: [1, 2, 2, 3, 4, 5, 5, 8, 9, 12], events: [1, 1, 0, 1, 0, 1, 1, 0, 1, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the observed times and event indicators",
        "sort the records by ascending time",
        "for each distinct time compute the risk set",
        "count the events occurring at that time",
        "multiply survival by one minus events over risk set",
        "record a censored time without changing survival",
        "locate the first time survival falls to one half",
        "done: report the survival curve and median",
    ],
};

export default module;
