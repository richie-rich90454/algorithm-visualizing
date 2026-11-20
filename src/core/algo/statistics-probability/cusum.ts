/**
 * cusum.ts - Cumulative Sum Control Chart
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A CUSUM chart detects small persistent shifts in a process mean by adding up
 * deviations from a target. Two one-sided accumulators track upward and
 * downward drift; each observation either adds its excess over an allowance k
 * or resets toward zero. When an accumulator crosses the decision interval h,
 * the chart signals that the process has moved.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observations
 *   Space: O(n) for the displayed bars and accumulator trail
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows its value.
 *   - A bar is highlighted when its update triggers a CUSUM signal.
 *   - The final frame green-lights the whole series and reports signals.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(series: number[], current: number, signals: number[], done: boolean): VisualEntity[] {
    const signalSet = new Set(signals);
    return series.map((value, index) => {
        let state: EntityState = "idle";
        if (signalSet.has(index)) state = "error";
        else if (done) state = "sorted";
        else if (index === current) state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `t=${index}: ${value.toFixed(2)}${signalSet.has(index) ? " signal" : ""}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { series?: number[]; target?: number; k?: number; h?: number } | null) ?? {};
    const series: number[] = Array.isArray(task.series) && task.series.length > 0
        ? task.series.map((v) => Number(v) || 0)
        : [0, 0, 0, 0, 0, 2.5, 2.5, 2.5, 2.5, 2.5];
    const target = typeof task.target === "number" ? task.target : 0;
    const k = typeof task.k === "number" && task.k >= 0 ? task.k : 0.5;
    const h = typeof task.h === "number" && task.h > 0 ? task.h : 2;
    let hi = 0;
    let lo = 0;
    const signals: number[] = [];
    const trail: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(series, -1, signals, false),
        edges: [],
        description: `Monitoring ${series.length} observations with a CUSUM chart at target ${target}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: series.length, target, k, h, signals: [], hi, lo, trail: [] },
    };
    for (let i = 0; i < series.length; i += 1) {
        const x = series[i]!;
        hi = Math.max(0, hi + (x - target - k));
        lo = Math.min(0, lo + (x - target + k));
        trail.push(Number(hi.toFixed(6)));
        const signal = hi > h || lo < -h;
        if (signal) {
            signals.push(i);
            hi = 0;
            lo = 0;
        }
        yield {
            stepNumber: i + 1,
            entities: makeBars(series, i, signals, false),
            edges: [],
            description: `Observation ${i}: value ${x.toFixed(2)}, upper CUSUM ${hi.toFixed(3)}${signal ? " - signal" : ""}.`,
            codeLineNumber: signal ? 5 : 2,
            layout: "array",
            meta: { n: series.length, target, k, h, signals: [...signals], hi, lo, trail: [...trail], current: i },
        };
    }
    yield {
        stepNumber: series.length + 1,
        entities: makeBars(series, -1, signals, true),
        edges: [],
        description: `CUSUM scan done: ${signals.length} signal(s) at ${signals.length ? signals.join(", ") : "no time"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n: series.length, target, k, h, signals, hi, lo, trail },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single unusual observation may be noise, but a run of slightly high values is a real shift. CUSUM accumulates each deviation from a target, subtracting a small allowance so ordinary wobble does not build up. Only a sustained drift pushes the accumulator past the decision interval and raises an alarm.",
        invariants: [
            "The upper accumulator never drops below zero and the lower never rises above zero.",
            "Each observation changes an accumulator by its deviation from target minus the allowance on the relevant side.",
            "After a signal both accumulators restart at zero.",
        ],
        correctness:
            "The two recursions are the one-sided sequential likelihood ratio statistics for detecting a mean shift of size 2k. Under the target mean, the expected increment of each active accumulator is negative, so it returns to zero and crossing the boundary h is rare. After a true shift of at least 2k the expected increment becomes positive, so the accumulator crosses h in finite expected time. Resetting after a signal restarts the test for the next shift.",
        complexityRationale:
            "Each observation needs a constant number of arithmetic operations, so time is O(n). The chart stores one bar and one accumulator trail value per observation, giving O(n) space.",
        uses: [
            "Detecting small drifts in industrial process quality",
            "Monitoring network latency or error rates for anomalies",
            "Sequential surveillance in epidemiology",
        ],
        references: [
            "Page, Continuous Inspection Schemes, 1954",
            "Montgomery, Introduction to Statistical Quality Control, CUSUM chapter",
        ],
        workedExample:
            "With target 0, allowance 0.5 and limit 2, five zeros keep both accumulators at zero. Five readings of 2.5 add 2 each step, so the upper accumulator reaches 2.5 on the second shifted reading and the chart signals.",
    },
    id: "cusum",
    name: "CUSUM Control Chart",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { series: [0, 0, 0, 0, 0, 2.5, 2.5, 2.5, 2.5, 2.5], target: 0, k: 0.5, h: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the observation series, target, allowance, and limit",
        "set upper and lower accumulators to zero",
        "for each observation update the upper accumulator",
        "update the lower accumulator in the same way",
        "if an accumulator passes the limit, record a signal and reset",
        "otherwise carry the accumulators forward",
        "done: report all signal times",
    ],
};

export default module;
