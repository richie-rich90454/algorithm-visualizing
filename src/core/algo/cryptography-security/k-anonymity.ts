/**
 * k-anonymity.ts - k-Anonymity by Generalization and Suppression
 *
 * A released table satisfies k-anonymity when every combination of quasi-
 * identifier values is shared by at least k records. This module generalizes
 * each numeric attribute into a bucket, groups records by their generalized
 * tuple, and suppresses any equivalence class smaller than k. The released
 * rows are therefore indistinguishable from at least k minus one other rows.
 *
 * Time:  O(n * d) for n records with d attributes
 * Space: O(n * d) for the grouped table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface AnonymizationResult {
    generalized: number[][];
    groups: Map<string, number[]>;
    kept: number[];
    suppressed: number[];
    satisfies: boolean;
}

/** Generalize, group, and suppress until every class has at least k members. */
export function kanonymize(records: number[][], k: number, bucketWidth: number): AnonymizationResult {
    const threshold = Math.max(1, Math.trunc(k));
    const width = Math.max(1, Math.trunc(bucketWidth));
    const generalized = records.map((row) => row.map((value) => Math.floor(value / width) * width));
    const groups = new Map<string, number[]>();
    generalized.forEach((row, index) => {
        const key = row.join(",");
        const members = groups.get(key) ?? [];
        members.push(index);
        groups.set(key, members);
    });
    const kept: number[] = [];
    const suppressed: number[] = [];
    for (const members of groups.values()) {
        if (members.length >= threshold) {
            kept.push(...members);
        } else {
            suppressed.push(...members);
        }
    }
    kept.sort((a, b) => a - b);
    suppressed.sort((a, b) => a - b);
    const satisfies = [...groups.values()].every(
        (members) => members.length >= threshold || members.every((index) => suppressed.includes(index)),
    );
    return { generalized, groups, kept, suppressed, satisfies };
}

function makeCells(
    records: number[][],
    generalized: number[][],
    kept: Set<number>,
    revealed: number,
    phase: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < records.length; row += 1) {
        const values = records[row] ?? [];
        for (let col = 0; col < values.length; col += 1) {
            const shown = phase === 0 ? (values[col] ?? 0) : (generalized[row]?.[col] ?? 0);
            let state: EntityState = "idle";
            if (phase >= 2) {
                state = kept.has(row) ? "sorted" : "error";
            } else if (row < revealed) {
                state = "visited";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(shown),
                value: shown,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, generalized: phase >= 1 ? 1 : 0, kept: kept.has(row) ? 1 : 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { records?: number[][]; k?: number; bucketWidth?: number } | null
    ) ?? {};
    const records = Array.isArray(task.records) && task.records.length > 0
        ? task.records.map((row) => (Array.isArray(row) ? row.map((value) => Math.trunc(value)) : []))
        : [
              [23, 94105],
              [25, 94105],
              [27, 94105],
              [40, 10001],
              [42, 10001],
              [61, 30301],
          ];
    const k = typeof task.k === "number" ? Math.max(1, Math.trunc(task.k)) : 2;
    const bucketWidth = typeof task.bucketWidth === "number" ? Math.max(1, Math.trunc(task.bucketWidth)) : 10;
    const result = kanonymize(records, k, bucketWidth);
    const cols = Math.max(1, ...records.map((row) => row.length));
    const rows = records.length;
    const kept = new Set(result.kept);
    const classSizes = [...result.groups.values()].map((members) => members.length);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(records, result.generalized, kept, 0, 0),
        edges: [],
        description: `Raw table of ${rows} record(s); require every group to have at least ${k} members.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, k, bucketWidth, phase: "raw", classSizes: [] as number[], kept: 0, suppressed: 0 },
    };
    step += 1;

    for (let i = 0; i < rows; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(records, result.generalized, kept, i + 1, 1),
            edges: [],
            description: `Record ${i} generalized to ${result.generalized[i]?.join(", ")} with bucket width ${bucketWidth}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows,
                cols,
                k,
                bucketWidth,
                phase: "generalize",
                index: i,
                classSizes: [] as number[],
                kept: 0,
                suppressed: 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(records, result.generalized, kept, rows, 2),
        edges: [],
        description: `Equivalence class sizes are ${classSizes.join(", ")}; classes below ${k} are suppressed.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows,
            cols,
            k,
            bucketWidth,
            phase: "decide",
            classSizes,
            kept: result.kept.length,
            suppressed: result.suppressed.length,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(records, result.generalized, kept, rows, 2),
        edges: [],
        description: `Released ${result.kept.length} row(s), suppressed ${result.suppressed.length}; k-anonymity holds: ${result.satisfies}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows,
            cols,
            k,
            bucketWidth,
            phase: "done",
            classSizes,
            kept: result.kept.length,
            suppressed: result.suppressed.length,
            satisfies: result.satisfies,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A table leaks identity when a small set of visible attributes singles out one person. Generalization replaces exact values with coarse buckets, such as an age range instead of an exact age. After bucketing, records that share a bucket tuple form an equivalence class; if every class has at least k people, no released row can be tied to fewer than k individuals.",
        invariants: [
            "A generalized value is the largest multiple of the bucket width not exceeding the original value.",
            "Every record belongs to exactly one equivalence class determined by its generalized tuple.",
            "A class is released only when its size is at least k, otherwise every row in it is suppressed.",
        ],
        correctness:
            "Grouping by the generalized tuple partitions the records, so each record is considered exactly once. Suppressing all classes smaller than k leaves only classes of size at least k, which is precisely the definition of k-anonymity on the released attributes. Because generalization and suppression never restore a more specific value, no released row can identify a unique individual among the released set.",
        complexityRationale:
            "Generalizing touches each of the n records across d attributes once, and grouping inserts each record into a hash map, so time is O(n d). The generalized table and the class lists hold one entry per record, giving O(n d) space.",
        uses: [
            "Releasing medical or census tables with privacy guarantees",
            "Preprocessing data sets before sharing with third parties",
            "Teaching the limits of simple anonymization against background knowledge",
        ],
        references: [
            "Sweeney, k-Anonymity: A Model for Protecting Privacy, 2002",
            "Samarati and Sweeney, Protecting Privacy when Disclosing Information, 1998",
        ],
        workedExample:
            "With bucket width ten and k two, ages twenty three, twenty five, and twenty seven all generalize to twenty and share a ZIP bucket, so that class of three is released. The single record at age sixty one forms a class of one and is suppressed, leaving every released row hidden among at least two others.",
    },
    id: "k-anonymity",
    name: "k-Anonymity (Generalization and Suppression)",
    category: "cryptography-security",
    complexity: { time: "O(n * d)", space: "O(n * d)" },
    defaultInput: {
        records: [
            [23, 94105],
            [25, 94105],
            [27, 94105],
            [40, 10001],
            [42, 10001],
            [61, 30301],
        ],
        k: 2,
        bucketWidth: 10,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a bucket width for each numeric attribute",
        "replace each value by its bucket lower bound",
        "group records by their generalized tuple",
        "count the members of every equivalence class",
        "suppress every class with fewer than k members",
        "release the remaining generalized records",
        "verify that each released class has at least k members",
    ],
};

export default module;
