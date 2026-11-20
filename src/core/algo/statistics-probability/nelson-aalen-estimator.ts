/**
 * nelson-aalen-estimator.ts - Nelson-Aalen Cumulative Hazard Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Nelson-Aalen estimator records the cumulative hazard of a right-censored
 * sample. At each distinct event time t it divides the number of events d by
 * the number of subjects still at risk n and adds d/n to a running total. The
 * resulting step function only jumps when an event occurs; censored observations
 * shrink the risk set but never add hazard. Exponentiating the negative hazard
 * gives the corresponding survival curve.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) with a direct risk-set scan, n being the sample size
 *   Space: O(n) for the sorted records and output arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per distinct event time shows the cumulative hazard so far.
 *   - The bar just added is yellow; the accumulated curve is green.
 *   - The final frame reports the total hazard and survival probability.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, hazard: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { times?: number[]; events?: number[] } | null) ?? {};
    const rawTimes: number[] = Array.isArray(task.times) ? task.times.filter((t) => Number.isFinite(t)) : [1, 2, 2, 3, 4, 5, 5, 8];
    const rawEvents: number[] = Array.isArray(task.events) ? task.events : [1, 1, 0, 1, 0, 1, 1, 0];
    const records = rawTimes
        .map((time, index) => ({ time, event: rawEvents[index] === 1 ? 1 : 0 }))
        .sort((left, right) => left.time - right.time);
    const distinctTimes = [...new Set(records.map((record) => record.time))].sort((left, right) => left - right);

    const atRisk: number[] = [];
    const eventsAt: number[] = [];
    const cumulativeHazard: number[] = [];
    const survival: number[] = [];
    let hazard = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(distinctTimes.length).fill(0), -1, false),
        edges: [],
        description: `Estimating cumulative hazard from ${records.length} observation(s) at ${distinctTimes.length} distinct time(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { distinctTimes, atRisk: [], eventsAt: [], cumulativeHazard: [], survival: [], finalHazard: 0, finalSurvival: 1, complete: false },
    };
    let step = 1;

    for (const time of distinctTimes) {
        const n = records.filter((record) => record.time >= time).length;
        const d = records.filter((record) => record.time === time && record.event === 1).length;
        if (n > 0 && d > 0) hazard += d / n;
        atRisk.push(n);
        eventsAt.push(d);
        cumulativeHazard.push(hazard);
        survival.push(Math.exp(-hazard));
        yield {
            stepNumber: step,
            entities: makeBars([...cumulativeHazard, ...new Array<number>(distinctTimes.length - cumulativeHazard.length).fill(0)], cumulativeHazard.length - 1, false),
            edges: [],
            description: `At t = ${time}: ${d} event(s) among ${n} at risk, cumulative hazard ${hazard.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { distinctTimes, atRisk: [...atRisk], eventsAt: [...eventsAt], cumulativeHazard: [...cumulativeHazard], survival: [...survival], finalHazard: hazard, finalSurvival: Math.exp(-hazard), complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(cumulativeHazard, distinctTimes.length, true),
        edges: [],
        description: `Nelson-Aalen estimate complete: final hazard ${hazard.toFixed(4)}, survival ${Math.exp(-hazard).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { distinctTimes, atRisk, eventsAt, cumulativeHazard, survival, finalHazard: hazard, finalSurvival: Math.exp(-hazard), complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of estimating a survival probability directly, count how much hazard has accumulated. At each failure time, divide the number of failures by the number of people still under observation and add that fraction to a running total. Censoring reduces the risk set but does not itself add hazard, so the curve is a staircase that only climbs when an event occurs.",
        invariants: [
            "The cumulative hazard is nondecreasing and starts at zero.",
            "The risk set at a time counts every observation with time at least that value.",
            "The survival curve equals the exponential of the negative cumulative hazard.",
        ],
        correctness:
            "The hazard increment at time t estimates the conditional probability of failing at t given survival up to t, which is d divided by n. Summing these conditional hazards gives the Nelson-Aalen cumulative hazard estimator, a consistent estimator of the integrated hazard under independent censoring. Because survival equals the exponential of minus the integrated hazard, exponentiating the estimate gives the Nelson-Aalen survival curve.",
        complexityRationale:
            "For each of the m distinct times the code scans all n records to count those at risk and those failing, so the direct implementation costs O(m n) time and O(m) space for the output arrays.",
        uses: [
            "Estimating hazard in clinical survival trials",
            "Reliability analysis with censored failure times",
            "A baseline for semiparametric Cox model diagnostics",
        ],
        references: [
            "Nelson, Hazard Estimation from Censored Data, 1969",
            "Aalen, Nonparametric Inference for a Family of Counting Processes, 1978",
            "Klein and Moeschberger, Survival Analysis, Chapter 4",
        ],
        workedExample:
            "For times 1, 2, 2, 3 with events 1, 1, 0, 1: at t = 1 one of four fails so hazard is 0.25; at t = 2 one of three fails so hazard rises to about 0.583; at t = 3 one of two fails so the final hazard is about 1.083 and survival about 0.338.",
    },
    id: "nelson-aalen-estimator",
    name: "Nelson-Aalen Estimator",
    category: "statistics-probability",
    complexity: { time: "O(m * n)", space: "O(m)" },
    defaultInput: { times: [1, 2, 2, 3, 4, 5, 5, 8], events: [1, 1, 0, 1, 0, 1, 1, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "read observation times and event indicators",
        "sort the records and list the distinct event times",
        "for each distinct time count subjects still at risk",
        "count events occurring exactly at that time",
        "add events over at risk to the running cumulative hazard",
        "set survival to the exponential of the negative hazard",
        "done: report hazard and survival at every distinct time",
    ],
};

export default module;
