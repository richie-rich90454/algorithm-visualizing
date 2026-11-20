/**
 * fair-share-scheduling.ts - Fair-Share CPU Scheduling
 *
 * Fair-share scheduling divides processor time among groups according to
 * configured weights. At every tick the group with the smallest ratio of CPU
 * used to its share is chosen, which keeps each group close to its entitlement.
 * Over time the allocation converges to the configured proportions.
 *
 * Time: O(ticks * groups); Space: O(groups).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeEntities(shares: Record<string, number>, usage: Record<string, number>, active: string | null): VisualEntity[] {
    return Object.keys(shares).map((group, index) => ({
        id: `group-${index}`,
        type: "bar" as const,
        label: `${group}:${usage[group] ?? 0}`,
        value: usage[group] ?? 0,
        state: group === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { group, share: shares[group] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { shares?: Record<string, number>; ticks?: number } | null) ?? {};
    const shares: Record<string, number> = task.shares ?? { A: 2, B: 1, C: 1 };
    const ticks = Math.max(1, Math.min(2000, Math.floor(task.ticks ?? 60)));
    const usage: Record<string, number> = {};
    for (const group of Object.keys(shares)) { usage[group] = 0; }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(shares, usage, null),
        edges: [],
        description: `Scheduling ${ticks} CPU ticks among ${Object.keys(shares).length} groups by fair share.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { tick: 0, usage: { ...usage }, shares: { ...shares }, allocated: {} as Record<string, number> },
    };
    step += 1;

    for (let tick = 0; tick < ticks; tick += 1) {
        let chosen = "";
        let bestRatio = Infinity;
        for (const group of Object.keys(shares)) {
            const ratio = (usage[group] ?? 0) / (shares[group] || 1);
            if (ratio < bestRatio - 1e-12) {
                bestRatio = ratio;
                chosen = group;
            }
        }
        usage[chosen] = (usage[chosen] ?? 0) + 1;
        if (tick < 12 || tick === ticks - 1) {
            yield {
                stepNumber: step,
                entities: makeEntities(shares, usage, chosen),
                edges: [],
                description: `Tick ${tick + 1}: group ${chosen} had the lowest used-to-share ratio and receives the CPU.`,
                codeLineNumber: tick === ticks - 1 ? 5 : 3,
                layout: "array",
                meta: { tick: tick + 1, usage: { ...usage }, shares: { ...shares }, allocated: { [chosen]: 1 } },
            };
            step += 1;
        }
    }

    const total = Object.values(usage).reduce((a, b) => a + b, 0);
    const allocated: Record<string, number> = {};
    for (const group of Object.keys(shares)) {
        allocated[group] = total === 0 ? 0 : (usage[group] ?? 0) / total;
    }
    yield {
        stepNumber: step,
        entities: makeEntities(shares, usage, null),
        edges: [],
        description: `After ${ticks} ticks, CPU time was distributed close to the configured shares.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { tick: ticks, usage: { ...usage }, shares: { ...shares }, allocated },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fair-share scheduling gives each group a weight, then repeatedly hands the CPU to whoever is furthest behind its entitlement. Comparing used time divided by weight makes the rule scale to any mix of shares: a group with twice the share can fall twice as far behind before it stops being the neediest.",
        invariants: [
            "Every tick is allocated to exactly one group.",
            "A group's used-to-share ratio increases when it runs and is unchanged when it does not.",
            "The chosen group always has the smallest used-to-share ratio at that tick.",
        ],
        correctness:
            "The greedy rule keeps all used-to-share ratios within one tick's worth of each other, because once a group's ratio exceeds another's the other becomes the minimum. Therefore each group's used time differs from its proportional entitlement by at most one tick, so over many ticks the observed fractions approach the configured shares.",
        complexityRationale:
            "Each tick scans all groups once to find the minimum ratio, so the total time is O(ticks times groups) with O(groups) space.",
        uses: [
            "Dividing CPU or quota capacity among tenants in a cluster",
            "Fair queuing in operating system and hypervisor schedulers",
            "Allocation of shared resources by department or project",
        ],
        references: [
            "Kay and Larow, Fair Share Scheduler, 1988",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, chapter on CPU scheduling",
        ],
        workedExample:
            "With shares A two, B one, C one over one hundred ticks, the ratio rule gives A about fifty ticks and B and C about twenty-five each, matching the two-to-one-to-one entitlement.",
    },
    id: "fair-share-scheduling",
    name: "Fair-Share CPU Scheduling",
    category: "production-systems",
    complexity: { time: "O(ticks * groups)", space: "O(groups)" },
    defaultInput: { shares: { A: 2, B: 1, C: 1 }, ticks: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read the group shares and the number of ticks",
        "initialize each group's used time to zero",
        "for each tick compute used time divided by share for every group",
        "select the group with the smallest ratio and give it the tick",
        "increment that group's used time",
        "after all ticks compute each group's allocated fraction",
        "report the usage and final fractions",
    ],
};

export default module;
