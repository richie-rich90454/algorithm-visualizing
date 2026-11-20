/**
 * t-closeness.ts - t-Closeness Anonymity Check
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * t-closeness strengthens l-diversity by requiring not merely that a group
 * contain several sensitive values, but that the distribution of those values
 * inside each group be close to the distribution for the whole data set. The
 * distance is the earth mover distance between the two distributions on the
 * ordered sensitive-value domain, which for one dimension is the sum of the
 * absolute differences of their cumulative distribution functions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + g * m) for n records, g groups, and m distinct sensitive values
 *   Space: O(n + m) for the groups, distributions, and verdicts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per record shows its quasi-identifier and sensitive value.
 *   - A record in a close group is GREEN, in a violating group RED.
 *   - meta carries the domain, each group's distance, and the verdicts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RecordInput {
    qi: string;
    sensitive: number;
}

interface ClosenessInput {
    records?: RecordInput[];
    t?: number;
}

function makeCells(records: RecordInput[], verdicts: number[], current: number): VisualEntity[] {
    return records.map((record, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = "active";
        } else if (verdicts[index] === 1) {
            state = "sorted";
        } else if (verdicts[index] === 0) {
            state = "error";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${record.qi} / ${record.sensitive}`,
            value: record.sensitive,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, qi: record.qi, sensitive: record.sensitive },
        };
    });
}

/** Earth mover distance between two equal-mass distributions on a shared domain. */
function earthMover(p: number[], q: number[]): number {
    let cp = 0;
    let cq = 0;
    let distance = 0;
    for (let i = 0; i < p.length; i += 1) {
        cp += p[i] ?? 0;
        cq += q[i] ?? 0;
        distance += Math.abs(cp - cq);
    }
    return distance;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ClosenessInput | null) ?? {};
    const records = Array.isArray(task.records) && task.records.length > 0
        ? task.records.map((record) => ({ qi: String(record.qi), sensitive: Number(record.sensitive) || 0 }))
        : [
              { qi: "zip-1", sensitive: 1 },
              { qi: "zip-1", sensitive: 2 },
              { qi: "zip-1", sensitive: 3 },
              { qi: "zip-2", sensitive: 1 },
              { qi: "zip-2", sensitive: 1 },
              { qi: "zip-2", sensitive: 2 },
              { qi: "zip-3", sensitive: 3 },
              { qi: "zip-3", sensitive: 3 },
          ];
    const t = Math.max(0, Number(task.t) || 0.2);
    const domain = Array.from(new Set(records.map((record) => record.sensitive))).sort((a, b) => a - b);
    const indexOf = new Map(domain.map((value, index) => [value, index]));
    const global = domain.map(() => 0);
    for (const record of records) {
        const index = indexOf.get(record.sensitive);
        if (index !== undefined) {
            global[index] = (global[index] ?? 0) + 1 / records.length;
        }
    }

    const groupOrder: string[] = [];
    const groupSensitive = new Map<string, number[]>();
    for (const record of records) {
        if (!groupSensitive.has(record.qi)) {
            groupSensitive.set(record.qi, []);
            groupOrder.push(record.qi);
        }
        groupSensitive.get(record.qi)?.push(record.sensitive);
    }
    const verdicts: number[] = [];
    const distances: number[] = [];
    const titles: string[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(records, verdicts, -1),
        edges: [],
        description: `Checking t-closeness with t = ${t} over ${records.length} record(s) and ${domain.length} sensitive value(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: records.length,
            t,
            domain,
            groups: groupOrder,
            distances,
            verdicts,
        },
    };
    let step = 1;

    for (let g = 0; g < groupOrder.length; g += 1) {
        const qi = groupOrder[g];
        if (qi === undefined) {
            continue;
        }
        const values = groupSensitive.get(qi) ?? [];
        const local = domain.map(() => 0);
        for (const value of values) {
            const index = indexOf.get(value);
            if (index !== undefined) {
                local[index] = (local[index] ?? 0) + 1 / values.length;
            }
        }
        const distance = earthMover(global, local);
        const close = distance <= t + 1e-12 ? 1 : 0;
        distances.push(distance);
        titles.push(qi);
        for (let i = 0; i < records.length; i += 1) {
            if (records[i]?.qi === qi) {
                verdicts[i] = close;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(records, verdicts, -1),
            edges: [],
            description: `Group "${qi}" has earth mover distance ${distance.toFixed(3)} from the global distribution; ${close ? "t-close" : "violates t-closeness"}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: records.length,
                t,
                domain,
                groups: titles,
                distances: [...distances],
                verdicts: [...verdicts],
                currentGroup: qi,
            },
        };
        step += 1;
    }

    const violations = groupOrder.filter((_qi, index) => (distances[index] ?? 0) > t + 1e-12);
    yield {
        stepNumber: step,
        entities: makeCells(records, verdicts, -1),
        edges: [],
        description: `${groupOrder.length - violations.length} of ${groupOrder.length} group(s) satisfy ${t}-closeness; ${violations.length} violation(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: records.length,
            t,
            domain,
            groups: groupOrder,
            distances,
            verdicts,
            violations,
            allClose: violations.length === 0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A group can contain many different sensitive values and still be revealing if those values are distributed very differently from the population. t-closeness compares each group's sensitive-value distribution to the overall distribution and allows only a small earth mover distance. Intuitively, the distance is how much probability mass must be slid along the ordered values to turn one distribution into the other.",
        invariants: [
            "Every group distribution and the global distribution place total mass one on the shared ordered domain.",
            "The earth mover distance is the sum of absolute differences between cumulative distributions.",
            "A group is t-close exactly when its distance is at most t.",
        ],
        correctness:
            "The global and group distributions each assign one unit of mass across the domain, so their cumulative arrays end at the same value and the summed absolute differences are a valid one-dimensional earth mover distance. That distance is zero only for identical distributions and grows with the separation of the distributions. The companion test recomputes the distance by brute force from the definitions, checks that comparing a distribution with itself gives zero, checks symmetry, and verifies the verdicts and monotonicity in t.",
        complexityRationale:
            "Counting the global distribution and grouping records takes O(n). Each of the g groups builds an m-entry distribution and a cumulative scan, costing O(g * m); with m no larger than n this is O(n + g * m). Storing groups and verdicts uses O(n + m) space.",
        uses: [
            "Publishing health or salary data with strong privacy guarantees",
            "Validating that a k-anonymized or l-diverse table is safe to release",
            "A teaching model for distribution-aware privacy measures",
        ],
        references: [
            "Li, Li, and Venkatasubramanian, t-Closeness: Privacy Beyond k-Anonymity and l-Diversity, 2007",
            "Rubner, Tomasi, and Guibas, The Earth Mover's Distance as a Metric for Image Retrieval, 2000",
        ],
        workedExample:
            "If the global sensitive values are one, two, or three each with probability one third, a group containing only threes has cumulative mass that jumps late, giving an earth mover distance of about two thirds. For t = 0.2 that group violates t-closeness, while a group with a balanced mix of one, two, and three has distance zero and passes.",
    },
    id: "t-closeness",
    name: "t-Closeness Check",
    category: "cryptography-security",
    complexity: { time: "O(n + g * m)", space: "O(n + m)" },
    defaultInput: {
        records: [
            { qi: "zip-1", sensitive: 1 },
            { qi: "zip-1", sensitive: 2 },
            { qi: "zip-1", sensitive: 3 },
            { qi: "zip-2", sensitive: 1 },
            { qi: "zip-2", sensitive: 1 },
            { qi: "zip-2", sensitive: 2 },
            { qi: "zip-3", sensitive: 3 },
            { qi: "zip-3", sensitive: 3 },
        ],
        t: 0.2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the global distribution of the sensitive attribute over its ordered domain",
        "group records by their quasi-identifier value",
        "for each group compute its local sensitive distribution",
        "build cumulative distributions over the ordered domain",
        "sum the absolute differences of the cumulative distributions",
        "mark the group t-close when that distance is at most t",
        "apply the verdict to every record in the group",
        "done: report each group's distance and any violations",
    ],
};

export default module;
