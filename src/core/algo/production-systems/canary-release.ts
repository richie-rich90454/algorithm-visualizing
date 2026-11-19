/**
 * canary-release.ts - Canary Release Promotion and Rollback
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A canary release shifts traffic to a new version in small stages. After each
 * stage the observed error rate is compared with a threshold: if the canary is
 * healthy, more traffic is routed to it; if the error rate breaches the
 * threshold, traffic is pulled back to the stable version and the release is
 * rolled back. This limits the number of users exposed to a bad deploy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k rollout stages
 *   Space: O(k) for the stage arrays and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per stage shows the canary traffic percentage.
 *   - A breaching stage turns red and stops the rollout.
 *   - The final frame reports whether promotion or rollback occurred.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CanaryInput {
    stages?: number[];
    errorRates?: number[];
    threshold?: number;
}

/** Build one bar per stage showing canary traffic and outcome. */
function makeBars(stages: number[], rates: number[], threshold: number, current: number, outcome: string): VisualEntity[] {
    return stages.map((traffic, index) => {
        const breached = (rates[index] ?? 0) > threshold;
        let state: EntityState = "idle";
        if (outcome === "rolled-back" && breached) {
            state = "error";
        } else if (outcome === "complete" || (!breached && index <= current)) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `stage ${index}: ${traffic}% traffic, errors ${(rates[index] ?? 0).toFixed(3)}`,
            value: traffic,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, traffic, errorRate: rates[index] ?? 0, breached },
        };
    });
}

/** Simulate a staged canary rollout with error-rate gating. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CanaryInput | null) ?? {};
    const stages: number[] = (task.stages ?? [5, 25, 50, 100]).filter(
        (s) => typeof s === "number" && s >= 0 && s <= 100,
    );
    const errorRates: number[] = (task.errorRates ?? [0.01, 0.01, 0.01, 0.01]).filter(
        (r) => typeof r === "number",
    );
    const threshold = typeof task.threshold === "number" ? task.threshold : 0.05;
    const k = stages.length;

    if (k === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No rollout stages were supplied; there is nothing to release.",
            codeLineNumber: 0,
            layout: "array",
            meta: { outcome: "none", finalStage: -1, canaryTraffic: 0, stableVersion: "v1" },
        };
        return;
    }

    let outcome = "complete";
    let finalStage = -1;
    for (let i = 0; i < k; i += 1) {
        finalStage = i;
        if ((errorRates[i] ?? 0) > threshold) {
            outcome = "rolled-back";
            break;
        }
    }
    const canaryTraffic = outcome === "rolled-back" ? 0 : (stages[k - 1] ?? 0);
    const stableVersion = outcome === "complete" && canaryTraffic >= 100 ? "v2" : "v1";

    yield {
        stepNumber: 0,
        entities: makeBars(stages, errorRates, threshold, -1, "in-progress"),
        edges: [],
        description: `Rolling a canary through ${k} stages with an error threshold of ${threshold.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stages, errorRates, threshold, outcome: "in-progress", finalStage: -1, canaryTraffic: 0, stableVersion: "v1" },
    };
    let step = 1;

    for (let i = 0; i <= finalStage; i += 1) {
        const breached = (errorRates[i] ?? 0) > threshold;
        const snapshot = breached ? "rolled-back" : i === finalStage && outcome === "complete" ? "complete" : "in-progress";
        yield {
            stepNumber: step,
            entities: makeBars(stages, errorRates, threshold, i, snapshot),
            edges: [],
            description: `Stage ${i}: ${stages[i]}% traffic, error rate ${(errorRates[i] ?? 0).toFixed(3)}${breached ? " breaches the threshold - rolling back" : " is healthy - promote"}.`,
            codeLineNumber: breached ? 5 : 4,
            layout: "array",
            meta: { stages, errorRates, threshold, outcome: snapshot, finalStage: i, canaryTraffic: breached ? 0 : stages[i], stableVersion: "v1" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(stages, errorRates, threshold, finalStage, outcome),
        edges: [],
        description: outcome === "rolled-back"
            ? `Error rate breached the threshold at stage ${finalStage}; all traffic returned to the stable version.`
            : `All ${k} stages healthy; the canary now serves ${canaryTraffic}% of traffic.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { stages, errorRates, threshold, outcome, finalStage, canaryTraffic, stableVersion },
    };
}

/** The canary release module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A bad deploy is safest when few users see it. A canary release sends a small slice of traffic to the new version, watches its error rate, and only widens the slice if the canary looks healthy. A single bad metric pulls all traffic back to the last known good version, turning a potentially global outage into a small incident.",
        invariants: [
            "Canary traffic increases only after a stage passes the health gate.",
            "A breached error threshold always returns all traffic to the stable version.",
            "The stable version is promoted only when the canary reaches full traffic.",
        ],
        correctness:
            "The loop visits stages in ascending traffic order and checks each measured error rate against the threshold. By induction, every stage that was passed had an error rate within the limit, so reaching the last stage means the canary was healthy throughout. If a stage breaches, the recorded canary traffic is reset to zero and no later stage is executed, which models an immediate rollback. Because promotion requires full traffic, the stable version cannot advance on a partial rollout.",
        complexityRationale:
            "Each stage is examined once with a constant-time comparison, so the rollout is O(k). The stage, rate, and bar arrays are linear in k, giving O(k) space.",
        uses: [
            "Progressive web and API deployments",
            "Feature rollouts behind load balancers or service meshes",
            "Guarded mobile app and configuration releases",
        ],
        references: [
            "Allspaw, The Art of Capacity Planning, chapter on staged rollouts",
            "Google SRE Book, Chapter 22 on releasing changes",
        ],
        workedExample:
            "Stages of 5, 25 and 100 percent with error rates 0.01, 0.02 and 0.20 against a threshold of 0.05 pass the first two gates, then breach at full traffic. The rollout stops at stage two, canary traffic returns to zero, and the stable version keeps serving everyone.",
    },
    id: "canary-release",
    name: "Canary Release",
    category: "production-systems",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: {
        stages: [5, 25, 50, 100],
        errorRates: [0.01, 0.01, 0.02, 0.01],
        threshold: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the traffic stages, error rates, and threshold",
        "start all traffic on the stable version",
        "for each stage route its share to the canary",
        "measure the canary error rate at that stage",
        "if the rate exceeds the threshold then roll back",
        "otherwise promote to the next stage",
        "done: report the final version and traffic split",
    ],
};

export default module;
