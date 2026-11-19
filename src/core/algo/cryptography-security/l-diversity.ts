/**
 * l-diversity.ts - l-Diversity Anonymity Check
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * k-anonymity hides an individual inside a group of similar records, but if all
 * members of a group share the same sensitive value the value is still leaked.
 * l-diversity strengthens the model by requiring every equivalence class (a
 * set of records with identical quasi-identifiers) to contain at least l
 * distinct sensitive values. This module partitions the records, counts the
 * distinct sensitive values per group, and reports which groups are diverse.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to group and count n records (using hash maps)
 *   Space: O(n) for the groups and distinct-value sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per record shows its quasi-identifier and sensitive value.
 *   - A record in a diverse group is GREEN, in a violating group RED.
 *   - meta carries the per-group distinct counts and the verdicts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RecordInput {
    qi: string;
    sensitive: string;
}

interface DiversityInput {
    records?: RecordInput[];
    l?: number;
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

function computeGroups(records: RecordInput[]): Array<{ qi: string; values: string[]; distinct: string[] }> {
    const order: string[] = [];
    const byQi = new Map<string, string[]>();
    for (const record of records) {
        if (!byQi.has(record.qi)) {
            byQi.set(record.qi, []);
            order.push(record.qi);
        }
        byQi.get(record.qi)?.push(record.sensitive);
    }
    return order.map((qi) => {
        const values = byQi.get(qi) ?? [];
        const distinct: string[] = [];
        for (const value of values) {
            if (!distinct.includes(value)) {
                distinct.push(value);
            }
        }
        return { qi, values, distinct };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DiversityInput | null) ?? {};
    const records = Array.isArray(task.records) && task.records.length > 0
        ? task.records.map((record) => ({ qi: String(record.qi), sensitive: String(record.sensitive) }))
        : [
              { qi: "zip-1", sensitive: "flu" },
              { qi: "zip-1", sensitive: "cold" },
              { qi: "zip-1", sensitive: "flu" },
              { qi: "zip-2", sensitive: "flu" },
              { qi: "zip-2", sensitive: "flu" },
              { qi: "zip-3", sensitive: "cold" },
              { qi: "zip-3", sensitive: "flu" },
          ];
    const l = Math.max(1, Math.floor(Number(task.l) || 2));
    const groups = computeGroups(records);
    const verdicts: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(records, verdicts, -1),
        edges: [],
        description: `Checking l-diversity with l = ${l} over ${records.length} record(s) in ${groups.length} group(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: records.length,
            l,
            groups: groups.map((group) => group.qi),
            distinctCounts: groups.map((group) => group.distinct.length),
            diverse: groups.map((group) => group.distinct.length >= l ? 1 : 0),
            verdicts,
        },
    };
    let step = 1;

    for (let g = 0; g < groups.length; g += 1) {
        const group = groups[g];
        if (!group) {
            continue;
        }
        const diverse = group.distinct.length >= l ? 1 : 0;
        for (let i = 0; i < records.length; i += 1) {
            if (records[i]?.qi === group.qi) {
                verdicts[i] = diverse;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(records, verdicts, -1),
            edges: [],
            description: `Group "${group.qi}" has ${group.distinct.length} distinct sensitive value(s): ${group.distinct.join(", ")}; ${diverse ? "diverse" : "violates l-diversity"}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: records.length,
                l,
                groups: groups.map((item) => item.qi),
                distinctCounts: groups.map((item) => item.distinct.length),
                diverse: groups.map((item) => item.distinct.length >= l ? 1 : 0),
                verdicts: [...verdicts],
                currentGroup: group.qi,
            },
        };
        step += 1;
    }

    const violations = groups.filter((group) => group.distinct.length < l).map((group) => group.qi);
    yield {
        stepNumber: step,
        entities: makeCells(records, verdicts, -1),
        edges: [],
        description: `${groups.length - violations.length} of ${groups.length} group(s) satisfy ${l}-diversity; ${violations.length} violation(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: records.length,
            l,
            groups: groups.map((group) => group.qi),
            distinctCounts: groups.map((group) => group.distinct.length),
            diverse: groups.map((group) => group.distinct.length >= l ? 1 : 0),
            verdicts,
            violations,
            allDiverse: violations.length === 0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Grouping people by coarse attributes such as ZIP code can make each group look anonymous, yet a group can still reveal a sensitive fact if everyone in it shares the same diagnosis. l-diversity requires each such group to contain at least l different sensitive values. More distinct values give an attacker less reason to believe any particular value belongs to a specific person.",
        invariants: [
            "An equivalence class is the set of records sharing an identical quasi-identifier.",
            "A class is l-diverse exactly when it contains at least l distinct sensitive values.",
            "Every record inherits the verdict of the class it belongs to.",
        ],
        correctness:
            "Grouping by exact quasi-identifier partitions the records into disjoint classes, and collecting unique sensitive values counts each distinct value once. Comparing that count with l implements the definition directly. The companion test computes the counts with an independent brute-force grouping, checks the verdicts record by record, and verifies monotonicity: raising l never turns a violating class into a diverse one.",
        complexityRationale:
            "Building the groups and appending values is O(n). Counting distinct values by linear membership tests is O(g * d) with g groups and at most d distinct values, bounded by O(n) in total for the visualized sizes, so the overall work is O(n). Group maps and verdict arrays use O(n) space.",
        uses: [
            "Releasing medical or census data while limiting attribute disclosure",
            "Checking whether a k-anonymized table is safe to publish",
            "A teaching model for privacy notions beyond k-anonymity",
        ],
        references: [
            "Machanavajjhala, Kifer, Gehrke, and Venkitasubramaniam, l-Diversity, 2007",
            "Sweeney, k-Anonymity: A Model for Protecting Privacy, 2002",
        ],
        workedExample:
            "With l = 2, a ZIP group containing flu, cold, and flu has two distinct values and passes. Another ZIP group whose records are all flu has only one distinct value and violates 2-diversity, so that group must be suppressed or generalized before release.",
    },
    id: "l-diversity",
    name: "l-Diversity Check",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        records: [
            { qi: "zip-1", sensitive: "flu" },
            { qi: "zip-1", sensitive: "cold" },
            { qi: "zip-1", sensitive: "flu" },
            { qi: "zip-2", sensitive: "flu" },
            { qi: "zip-2", sensitive: "flu" },
            { qi: "zip-3", sensitive: "cold" },
            { qi: "zip-3", sensitive: "flu" },
        ],
        l: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "group records by their quasi-identifier value",
        "for each equivalence class do",
        "collect the distinct sensitive values present in the class",
        "count how many distinct sensitive values the class has",
        "mark the class diverse when that count is at least l",
        "apply the class verdict to every record in it",
        "repeat for all remaining classes",
        "done: report the diverse classes and any violations",
    ],
};

export default module;
