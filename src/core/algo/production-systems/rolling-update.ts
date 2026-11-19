/**
 * rolling-update.ts - Rolling Update with Availability Guarantee
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A rolling update replaces instances of a service in small batches so the
 * application never dips below a required number of healthy replicas. Each
 * batch is drained, restarted on the new version, and checked for health. The
 * next batch starts only if the remaining available instances still meet the
 * minimum. If a restarted instance is unhealthy or the availability floor
 * would be breached, the rollout pauses and the batch is rolled back.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n instances
 *   Space: O(n) for the instance state array and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per instance shows old, updating, or new state.
 *   - The active batch is highlighted while it restarts.
 *   - The final frame reports how many instances were updated.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RollingInput {
    total?: number;
    batchSize?: number;
    maxUnavailable?: number;
    healthy?: boolean[];
}

type InstanceState = "old" | "updating" | "new";

/** Build one bar per instance showing its rollout state. */
function makeBars(states: InstanceState[], batch: number[]): VisualEntity[] {
    return states.map((state, index) => {
        let visual: EntityState;
        if (state === "new") {
            visual = "sorted";
        } else if (state === "updating") {
            visual = batch.includes(index) ? "comparing" : "active";
        } else {
            visual = "unvisited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `instance ${index}: ${state}`,
            value: state === "new" ? 1 : state === "updating" ? 0 : -1,
            state: visual,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, state },
        };
    });
}

/** Simulate a rolling update, keeping availability above the floor. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RollingInput | null) ?? {};
    const total = Math.max(0, Math.min(30, Math.floor(task.total ?? 8)));
    const batchSize = Math.max(1, Math.floor(task.batchSize ?? 2));
    const maxUnavailable = Math.max(0, Math.floor(task.maxUnavailable ?? 2));
    const healthy: boolean[] = task.healthy ?? new Array<boolean>(total).fill(true);
    const minAvailable = Math.max(0, total - maxUnavailable);
    const states: InstanceState[] = new Array<InstanceState>(total).fill("old");
    let updated = 0;
    let aborted = false;

    yield {
        stepNumber: 0,
        entities: makeBars(states, []),
        edges: [],
        description: `Updating ${total} instances in batches of ${batchSize}, requiring ${minAvailable} available.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { total, batchSize, maxUnavailable, minAvailable, updated: 0, aborted: false, states: [...states] },
    };
    let step = 1;

    while (updated < total && !aborted) {
        const batch: number[] = [];
        for (let i = updated; i < Math.min(updated + batchSize, total); i += 1) {
            batch.push(i);
        }
        for (const i of batch) {
            states[i] = "updating";
        }
        const available = states.filter((s) => s !== "updating").length;
        const capacityOk = available >= minAvailable;
        yield {
            stepNumber: step,
            entities: makeBars(states, batch),
            edges: [],
            description: `Restarting instances ${batch.join(", ")}; ${available} available, minimum ${minAvailable}.`,
            codeLineNumber: capacityOk ? 3 : 4,
            layout: "array",
            meta: { total, batchSize, maxUnavailable, minAvailable, updated, aborted: false, states: [...states] },
        };
        step += 1;

        const batchHealthy = batch.every((i) => healthy[i] !== false);
        if (!capacityOk || !batchHealthy) {
            for (const i of batch) {
                states[i] = "old";
            }
            aborted = true;
            yield {
                stepNumber: step,
                entities: makeBars(states, []),
                edges: [],
                description: capacityOk
                    ? `An instance in the batch failed its health check; the batch is rolled back.`
                    : `Availability would fall to ${available}, below the minimum ${minAvailable}; the batch is rolled back.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { total, batchSize, maxUnavailable, minAvailable, updated, aborted: true, states: [...states] },
            };
            step += 1;
            break;
        }

        for (const i of batch) {
            states[i] = "new";
        }
        updated += batch.length;
        yield {
            stepNumber: step,
            entities: makeBars(states, []),
            edges: [],
            description: `Batch healthy; ${updated} of ${total} instances now run the new version.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { total, batchSize, maxUnavailable, minAvailable, updated, aborted: false, states: [...states] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(states, []),
        edges: [],
        description: aborted
            ? `Rollout paused after ${updated} instances; the batch was rolled back.`
            : `Rollout complete: all ${updated} instances run the new version.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { total, batchSize, maxUnavailable, minAvailable, updated, aborted, states: [...states] },
    };
}

/** The rolling update module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Restarting every server at once causes an outage, so a rolling update replaces a few at a time. New instances join only after the previous batch is healthy, and the size of each batch is chosen so enough old instances remain to serve traffic. If the new version fails a health check, the batch is put back and the rollout stops instead of taking down the whole service.",
        invariants: [
            "The number of updating instances never exceeds the batch size.",
            "A batch is committed only when remaining availability meets the floor.",
            "A rolled-back batch leaves its instances on the old version.",
        ],
        correctness:
            "Before each batch the availability count excludes the updating instances, so the check available at least minAvailable guarantees the service keeps enough replicas whenever a batch is committed. By induction, after each committed batch all earlier instances are new and the rest are old, with no partially updated batch. A failed health check or capacity check rolls the batch back and aborts, so the system is never left with unhealthy instances serving traffic.",
        complexityRationale:
            "Each instance joins a batch exactly once and the state scans are bounded by a small batch size, so the simulation is O(n). The per-instance state array and bars use O(n) space.",
        uses: [
            "Kubernetes Deployment rolling updates",
            "Zero-downtime application server replacements",
            "Fleet-wide configuration and binary upgrades",
        ],
        references: [
            "Kubernetes documentation, Performing a Rolling Update",
            "Google SRE Book, Chapter 22 on releasing changes",
        ],
        workedExample:
            "Eight instances with batch size two and one unavailable allowed require at least seven available. Draining two leaves six, which is below the floor, so the rollout would abort before touching them. With two unavailable allowed the floor is six, the first batch restarts safely, and the process repeats until all eight are new.",
    },
    id: "rolling-update",
    name: "Rolling Update",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { total: 8, batchSize: 2, maxUnavailable: 2, healthy: [true, true, true, true, true, true, true, true] },
    visualType: "array",
    run,
    pseudocode: [
        "read the instance count, batch size, and availability floor",
        "mark every instance as old",
        "drain the next batch and mark it updating",
        "if available instances fall below the floor then roll back",
        "otherwise check each restarted instance for health",
        "if any health check fails then roll back the batch",
        "commit healthy instances and advance to the next batch",
        "done: report the updated count and any abort",
    ],
};

export default module;
