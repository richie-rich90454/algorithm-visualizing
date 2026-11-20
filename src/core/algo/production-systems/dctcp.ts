/**
 * dctcp.ts - Data Center TCP Congestion Control (DCTCP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DCTCP reacts to congestion intensity instead of merely to its presence.
 * Switches mark packets with ECN when queue occupancy crosses a threshold;
 * the sender maintains an estimate alpha of the fraction of marked packets and
 * cuts its congestion window by up to half in proportion to alpha. When no
 * packets were marked it grows the window gently. The result is low latency
 * and high throughput on short-lived data-center flows.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(F) for F feedback samples
 *   Space: O(F) for the displayed window trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Array bars show the congestion window after each feedback sample.
 *   - The current sample is CYAN; applied samples are GREEN.
 *   - The final frame reports the ending window and alpha estimate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            initialCwnd?: number;
            increase?: number;
            g?: number;
            alpha?: number;
            feedback?: number[];
        } | null) ?? {};
    const feedback: number[] = Array.isArray(task.feedback)
        ? task.feedback.map((f) => Math.max(0, Math.min(1, Number(f) || 0)))
        : [0, 0, 0.25, 0.5, 0.125, 0, 0.0625];
    const g = Math.max(0, Math.min(1, Number(task.g ?? 0.0625) || 0.0625));
    const increase = Math.max(0, Number(task.increase ?? 1) || 1);

    let cwnd = Math.max(1, Number(task.initialCwnd ?? 10) || 10);
    let alpha = Math.max(0, Math.min(1, Number(task.alpha ?? 0) || 0));
    const trajectory: number[] = [];
    const alphas: number[] = [];

    const entities = (active: number): VisualEntity[] =>
        feedback.map((_, index) => ({
            id: `bar-${index}`,
            type: "bar" as const,
            label: (trajectory[index] ?? 0).toFixed(1),
            value: trajectory[index] ?? 0,
            state: index === active ? "active" : index < active ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, fraction: feedback[index] ?? 0 },
        }));

    const commonMeta = {
        sampleCount: feedback.length,
        g,
        increase,
        feedback,
    };

    yield {
        stepNumber: 0,
        entities: entities(-1),
        edges: [],
        description: `Starting DCTCP with window ${cwnd.toFixed(2)} and ${feedback.length} ECN feedback sample(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...commonMeta, phase: "init", cwnd, alpha, trajectory: [], alphas: [] },
    };
    let step = 1;
    for (let i = 0; i < feedback.length; i += 1) {
        const fraction = feedback[i] ?? 0;
        alpha = (1 - g) * alpha + g * fraction;
        cwnd = fraction > 0 ? Math.max(1, cwnd * (1 - alpha / 2)) : cwnd + increase / cwnd;
        trajectory.push(cwnd);
        alphas.push(alpha);
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: `Sample ${i}: marked fraction ${fraction}, alpha ${alpha.toFixed(3)}, window ${cwnd.toFixed(2)}.`,
            codeLineNumber: fraction > 0 ? 3 : 5,
            layout: "array",
            meta: {
                ...commonMeta,
                phase: "update",
                index: i,
                fraction,
                alpha,
                cwnd,
                trajectory: [...trajectory],
                alphas: [...alphas],
            },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `DCTCP run complete: final window ${cwnd.toFixed(2)} with alpha ${alpha.toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { ...commonMeta, phase: "final", cwnd, alpha, trajectory, alphas },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Regular TCP treats any packet loss as a full stop signal and halves its window. In a data center, queues fill long before packets drop, so switches mark packets instead. DCTCP counts how many were marked, and the more intense the congestion the harder it cuts. With little marking it keeps sending at nearly full rate, which keeps queues short and latency low.",
        invariants: [
            "Alpha is an exponentially weighted average of the marked fractions, so it stays between zero and one.",
            "A sample with a positive marked fraction never increases the window.",
            "A sample with no marking strictly increases the window.",
        ],
        correctness:
            "The update alpha equals (1-g) times the old alpha plus g times the new fraction, which by induction is a convex combination of all fractions seen and therefore stays in range. When the fraction is positive the multiplier (1 minus alpha over two) lies between one half and one, so the window can shrink by at most half, matching the DCTCP design. When the fraction is zero the additive increase term is positive, so the window grows. These two cases reproduce the specified controller exactly.",
        complexityRationale:
            "Each feedback sample needs a constant number of arithmetic operations, so the run is linear in the number of samples. Storing the displayed window and alpha trajectories uses linear space.",
        uses: [
            "Congestion control for data-center fabric traffic",
            "Low-latency remote direct memory access networks",
            "Simulation studies of ECN marking thresholds",
        ],
        references: [
            "Alizadeh et al., Data Center TCP (DCTCP), SIGCOMM 2010",
            "RFC 8311, Congestion Exposure and ECN behavior",
        ],
        workedExample:
            "Starting at window 10 with alpha zero, two clean samples raise it to 10.10 and 10.20. A marked fraction of 0.25 sets alpha to 0.0156 and reduces the window to about 10.12; heavier marking cuts it further, while later clean samples grow it again.",
    },
    id: "dctcp",
    name: "DCTCP Congestion Control",
    category: "production-systems",
    complexity: { time: "O(F)", space: "O(F)" },
    defaultInput: {
        initialCwnd: 10,
        increase: 1,
        g: 0.0625,
        alpha: 0,
        feedback: [0, 0, 0.25, 0.5, 0.125, 0, 0.0625],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize alpha to zero and the window to its start value",
        "for each ECN feedback sample with marked fraction f",
        "update alpha to (1-g)*alpha + g*f",
        "if f is positive reduce the window by alpha over two",
        "otherwise increase the window by one over the window",
        "clamp the window to at least one packet",
        "record the window and alpha for this sample",
        "done: report the final window and congestion estimate",
    ],
};

export default module;
