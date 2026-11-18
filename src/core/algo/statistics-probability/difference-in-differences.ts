/**
 * difference-in-differences.ts - Two-Period Difference-in-Differences Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Difference-in-differences compares the change in an outcome over time for a
 * treated group with the change for an untreated control group. Subtracting the
 * control change removes common time trends that would bias a simple before
 * and after comparison. This module computes the four group-time means, the
 * two changes, the estimator, and a standard error based on the variation of
 * unit-level changes within each group.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) over all units
 *   Space: O(1) beyond the input arrays and display cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A 2x2 grid shows pre and post means for treated and control groups.
 *   - Frames reveal the treated change, control change, and final estimator.
 *   - The final frame reports the standard error and t statistic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface DifferenceInDifferencesResult {
    treatedMeanPre: number;
    treatedMeanPost: number;
    controlMeanPre: number;
    controlMeanPost: number;
    treatedChange: number;
    controlChange: number;
    did: number;
    standardError: number;
    tStatistic: number;
    nTreated: number;
    nControl: number;
}

/** Mean of a finite number array. */
function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Unbiased sample variance of unit-level changes. */
function sampleVariance(values: number[]): number {
    if (values.length < 2) {
        return 0;
    }
    const m = mean(values);
    return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
}

/** Compute the classic two-period DiD estimator and its standard error. */
export function differenceInDifferences(
    treatedPre: number[],
    treatedPost: number[],
    controlPre: number[],
    controlPost: number[],
): DifferenceInDifferencesResult {
    const treatedChanges = treatedPre.map((v, i) => (treatedPost[i] ?? 0) - v);
    const controlChanges = controlPre.map((v, i) => (controlPost[i] ?? 0) - v);
    const treatedChange = mean(treatedChanges);
    const controlChange = mean(controlChanges);
    const did = treatedChange - controlChange;
    const variance =
        sampleVariance(treatedChanges) / Math.max(1, treatedChanges.length) +
        sampleVariance(controlChanges) / Math.max(1, controlChanges.length);
    const standardError = Math.sqrt(Math.max(0, variance));
    return {
        treatedMeanPre: mean(treatedPre),
        treatedMeanPost: mean(treatedPost),
        controlMeanPre: mean(controlPre),
        controlMeanPost: mean(controlPost),
        treatedChange,
        controlChange,
        did,
        standardError,
        tStatistic: standardError === 0 ? 0 : did / standardError,
        nTreated: treatedPre.length,
        nControl: controlPre.length,
    };
}

/** Four group-time mean cells; the revealed cells depend on the phase. */
function makeCells(result: DifferenceInDifferencesResult, phase: string): VisualEntity[] {
    const values = [
        [result.treatedMeanPre, result.treatedMeanPost],
        [result.controlMeanPre, result.controlMeanPost],
    ];
    const revealed: Record<string, boolean[]> = {
        setup: [false, false, false, false],
        treated: [true, true, false, false],
        control: [true, true, true, true],
        did: [true, true, true, true],
        done: [true, true, true, true],
    };
    const flags = revealed[phase] ?? revealed["setup"]!;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 2; col += 1) {
            const index = row * 2 + col;
            const value = values[row]?.[col] ?? 0;
            let state: EntityState = "idle";
            if (flags[index]) {
                state = phase === "done" ? "sorted" : "comparing";
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: `${row === 0 ? "treated" : "control"} ${col === 0 ? "pre" : "post"}: ${value.toFixed(2)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, group: row === 0 ? "treated" : "control", period: col === 0 ? "pre" : "post" },
            });
        }
    }
    return cells;
}

/** The difference-in-differences generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            treatedPre?: number[];
            treatedPost?: number[];
            controlPre?: number[];
            controlPost?: number[];
        } | null) ?? {};
    const treatedPre = Array.isArray(task.treatedPre) ? task.treatedPre.map((v) => Number(v) || 0) : [10, 12, 11, 13];
    const treatedPost = Array.isArray(task.treatedPost) ? task.treatedPost.map((v) => Number(v) || 0) : [20, 23, 21, 25];
    const controlPre = Array.isArray(task.controlPre) ? task.controlPre.map((v) => Number(v) || 0) : [10, 11, 12, 11];
    const controlPost = Array.isArray(task.controlPost) ? task.controlPost.map((v) => Number(v) || 0) : [14, 16, 15, 16];
    const result = differenceInDifferences(treatedPre, treatedPost, controlPre, controlPost);

    const base = {
        nTreated: result.nTreated,
        nControl: result.nControl,
        treatedMeanPre: result.treatedMeanPre,
        treatedMeanPost: result.treatedMeanPost,
        controlMeanPre: result.controlMeanPre,
        controlMeanPost: result.controlMeanPost,
        treatedChange: result.treatedChange,
        controlChange: result.controlChange,
        did: result.did,
        standardError: result.standardError,
        tStatistic: result.tStatistic,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(result, "setup"),
        edges: [],
        description: `Setting up difference-in-differences with ${result.nTreated} treated and ${result.nControl} control units.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, rows: 2, cols: 2, phase: "setup" },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(result, "treated"),
        edges: [],
        description: `Treated group changed from ${result.treatedMeanPre.toFixed(3)} to ${result.treatedMeanPost.toFixed(3)}, a change of ${result.treatedChange.toFixed(3)}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, rows: 2, cols: 2, phase: "treated" },
    };

    yield {
        stepNumber: 2,
        entities: makeCells(result, "control"),
        edges: [],
        description: `Control group changed from ${result.controlMeanPre.toFixed(3)} to ${result.controlMeanPost.toFixed(3)}, a change of ${result.controlChange.toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, rows: 2, cols: 2, phase: "control" },
    };

    yield {
        stepNumber: 3,
        entities: makeCells(result, "did"),
        edges: [],
        description: `Difference in differences: ${result.treatedChange.toFixed(3)} minus ${result.controlChange.toFixed(3)} equals ${result.did.toFixed(3)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...base, rows: 2, cols: 2, phase: "did" },
    };

    yield {
        stepNumber: 4,
        entities: makeCells(result, "done"),
        edges: [],
        description: `Standard error ${result.standardError.toFixed(4)} gives t statistic ${result.tStatistic.toFixed(4)} for the DiD estimate ${result.did.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, rows: 2, cols: 2, phase: "done", done: true },
    };
}

/** The difference-in-differences module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A before and after comparison can be fooled by anything else that changed over the same period. Difference-in-differences fixes this by subtracting the control group's change from the treated group's change. Any trend shared by both groups cancels, leaving the change attributable to the treatment under the parallel trends assumption.",
        invariants: [
            "The estimator is the treated change minus the control change.",
            "Adding the same constant to every observation leaves the estimator unchanged.",
            "The standard error combines the within-group variances of unit-level changes.",
        ],
        correctness:
            "Write each outcome as a group effect plus a time effect plus the treatment effect for treated units after the intervention. Differencing over time removes the group effect; differencing across groups removes the common time effect, leaving the treatment effect. If the two groups would have followed parallel trends absent treatment, the control change is an unbiased estimate of the counterfactual treated change, so their difference identifies the causal effect. The variance of a difference of independent group means is the sum of each mean's variance, giving the stated standard error.",
        complexityRationale:
            "Computing four means and two sample variances scans each unit a constant number of times, so the estimator runs in O(n) time with O(1) working space beyond the input arrays.",
        uses: [
            "Evaluating policy changes with untreated comparison groups",
            "Measuring the effect of marketing or pricing interventions",
            "Quasi-experimental causal inference in economics and public health",
        ],
        references: [
            "Card and Krueger, Minimum Wages and Employment: A Case Study, 1994",
            "Angrist and Pischke, Mostly Harmless Econometrics, differences-in-differences chapter",
        ],
        workedExample:
            "Treated outcomes average 11.5 before and 22.25 after, a change of 10.75. Control outcomes average 11 before and 15.25 after, a change of 4.25. The difference-in-differences estimate is 10.75 minus 4.25, or 6.5, which is the effect net of the common upward trend.",
    },
    id: "difference-in-differences",
    name: "Difference in Differences",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: {
        treatedPre: [10, 12, 11, 13],
        treatedPost: [20, 23, 21, 25],
        controlPre: [10, 11, 12, 11],
        controlPost: [14, 16, 15, 16],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the treated group's mean before and after",
        "compute the control group's mean before and after",
        "subtract the before mean from the after mean for each group",
        "subtract the control change from the treated change to get DiD",
        "compute each group's variance of unit-level changes",
        "combine those variances into the standard error and t statistic",
        "done: report the DiD estimate with its uncertainty",
    ],
};

export default module;
