/**
 * horizontal-pod-autoscaler.ts - Horizontal Pod Autoscaler Decision
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A horizontal pod autoscaler watches a utilization metric across the current
 * pods and decides how many replicas the deployment should run. The raw
 * proposal is the total observed utilization divided by the per-pod target,
 * rounded up. A tolerance band ignores tiny changes, replica bounds clamp the
 * result, and a stabilization window delays reactions by taking the most
 * conservative proposal from recent history in the direction of change.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(pods + window)
 *   Space: O(pods + window) for the displayed metrics and recent proposals
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per pod shows its current metric value.
 *   - The pod being summed is highlighted while the total accumulates.
 *   - The final frame reports the replica decision and its direction.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AutoscalerInput {
    values?: number[];
    target?: number;
    current?: number;
    minReplicas?: number;
    maxReplicas?: number;
    tolerance?: number;
    recent?: number[];
    window?: number;
}

/** Build one metric cell per pod. */
function makeCells(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `pod ${index + 1}: ${value.toFixed(1)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, metric: value },
        };
    });
}

/** The horizontal pod autoscaler generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AutoscalerInput | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? task.values.map((v) => Number(v)) : [80, 90, 70, 95];
    const target = typeof task.target === "number" && task.target > 0 ? task.target : 70;
    const current = Math.max(0, Math.floor(task.current ?? 4));
    const minReplicas = Math.max(1, Math.floor(task.minReplicas ?? 2));
    const maxReplicas = Math.max(minReplicas, Math.floor(task.maxReplicas ?? 10));
    const tolerance = Math.max(0, typeof task.tolerance === "number" ? task.tolerance : 0.1);
    const recent: number[] = Array.isArray(task.recent) ? task.recent.map((v) => Math.floor(v)) : [5, 5, 5];
    const window = Math.max(0, Math.floor(task.window ?? 3));
    const clamp = (value: number): number => Math.max(minReplicas, Math.min(maxReplicas, value));
    const baseMeta = {
        pods: values.length,
        target,
        current,
        minReplicas,
        maxReplicas,
        tolerance,
        window,
        recent: [...recent],
        total: 0,
        rawDesired: 0,
        afterTolerance: 0,
        afterClamp: 0,
        finalReplicas: current,
        action: "none",
    };

    yield {
        stepNumber: 0,
        entities: makeCells(values, -1, false),
        edges: [],
        description: `Reconciling ${values.length} pod metric(s) against target ${target} with ${current} current replica(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, rows: 1, cols: values.length },
    };
    let step = 1;
    let total = 0;

    for (let i = 0; i < values.length; i += 1) {
        total += values[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(values, i, false),
            edges: [],
            description: `Adding pod ${i + 1} metric ${(values[i] ?? 0).toFixed(1)}; total utilization ${total.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...baseMeta, total, rows: 1, cols: values.length, currentPod: i },
        };
        step += 1;
    }

    const rawDesired = Math.ceil(total / target);
    yield {
        stepNumber: step,
        entities: makeCells(values, -1, false),
        edges: [],
        description: `Raw proposal ceil(${total.toFixed(2)} / ${target}) = ${rawDesired} replica(s).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...baseMeta, total, rawDesired, rows: 1, cols: values.length },
    };
    step += 1;

    const afterTolerance = Math.abs(rawDesired - current) <= tolerance * current ? current : rawDesired;
    yield {
        stepNumber: step,
        entities: makeCells(values, -1, false),
        edges: [],
        description: afterTolerance === current
            ? `Proposal ${rawDesired} is inside the tolerance band around ${current}; holding steady.`
            : `Proposal ${rawDesired} leaves the tolerance band around ${current}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...baseMeta, total, rawDesired, afterTolerance, rows: 1, cols: values.length },
    };
    step += 1;

    const afterClamp = clamp(afterTolerance);
    yield {
        stepNumber: step,
        entities: makeCells(values, -1, false),
        edges: [],
        description: `Clamping ${afterTolerance} to the allowed range gives ${afterClamp} replica(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...baseMeta, total, rawDesired, afterTolerance, afterClamp, rows: 1, cols: values.length },
    };
    step += 1;

    const recentCandidates = recent.slice(-window).map(clamp);
    const candidates = [...recentCandidates, afterClamp];
    const finalReplicas = afterClamp > current
        ? Math.min(...candidates)
        : afterClamp < current
            ? Math.max(...candidates)
            : afterClamp;
    const action = finalReplicas > current ? "scale-up" : finalReplicas < current ? "scale-down" : "none";
    yield {
        stepNumber: step,
        entities: makeCells(values, -1, true),
        edges: [],
        description: `Stabilized decision: ${finalReplicas} replica(s), ${action} from ${current} using ${candidates.length} candidate(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...baseMeta, total, rawDesired, afterTolerance, afterClamp, finalReplicas, action, candidates, rows: 1, cols: values.length },
    };
}

/** The horizontal pod autoscaler module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An autoscaler treats the metric total as work to spread over pods. If pods are above target, the work needs more pods; if they are below, pods can be removed. Real controllers add a tolerance band so they do not thrash on small fluctuations, and a stabilization window so a single spike cannot immediately change the replica count.",
        invariants: [
            "The replica decision always lies between the configured minimum and maximum.",
            "A proposal within the tolerance band leaves the replica count unchanged before clamping.",
            "The stabilization step never chooses a more aggressive change than the most conservative recent proposal.",
        ],
        correctness:
            "The raw proposal divides total utilization by the target per pod and rounds up so no pod is left above target on average. The tolerance test compares the change with a fraction of the current count, so minor noise is ignored. Clamping enforces the deployment bounds. Taking the minimum of recent candidates when scaling up and the maximum when scaling down implements the standard stabilization rule: every recent observation must agree before a change is applied, which bounds the rate of scaling and prevents oscillation.",
        complexityRationale:
            "Summing the pod metrics takes time proportional to the number of pods, and the stabilization step scans at most the window size. Space holds the displayed metrics and the recent proposals, giving O(pods plus window).",
        uses: [
            "Elastic scaling of Kubernetes deployments",
            "Autoscaling batch workers on queue depth",
            "Capacity control in managed container platforms",
        ],
        references: [
            "Kubernetes documentation, Horizontal Pod Autoscaling, 2026",
            "Kubernetes Autoscaling Special Interest Group, HPA algorithm specification",
        ],
        workedExample:
            "Four pods report 80, 90, 70, and 95 against a target of 70, totaling 335. The raw proposal is ceil(335/70) which is 5. That is outside the ten percent band around 4, and it lies within the replica bounds. With recent proposals of 5, 5, and 5, stabilization keeps the decision at 5, so the controller scales up by one pod.",
    },
    id: "horizontal-pod-autoscaler",
    name: "Horizontal Pod Autoscaler",
    category: "production-systems",
    complexity: { time: "O(pods + window)", space: "O(pods + window)" },
    defaultInput: {
        values: [80, 90, 70, 95],
        target: 70,
        current: 4,
        minReplicas: 2,
        maxReplicas: 10,
        tolerance: 0.1,
        recent: [5, 5, 5],
        window: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read pod metrics, target, current replicas, bounds, tolerance, and history",
        "sum the utilization reported by every pod",
        "set the raw proposal to total divided by target, rounded up",
        "keep the current count when the proposal is within the tolerance band",
        "clamp the proposal between the minimum and maximum replicas",
        "gather recent proposals from the stabilization window",
        "choose the most conservative candidate in the direction of change",
        "done: report the replica count and the scaling action",
    ],
};

export default module;
