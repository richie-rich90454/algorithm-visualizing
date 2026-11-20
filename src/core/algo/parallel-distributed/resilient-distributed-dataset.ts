/**
 * resilient-distributed-dataset.ts - RDD Lineage Fault Recovery
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A resilient distributed dataset (RDD) is split into partitions and remembers
 * the lineage of transformations that produced each partition instead of
 * replicating the data. If a partition is lost, it is rebuilt by replaying the
 * same transformations on its ancestor partitions. This module applies a chain
 * of map and filter transformations, drops one partition from the final result,
 * and recomputes it from the base partition through the recorded lineage. The
 * recomputed values must equal the values that were lost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * |P|) to replay m transformations over a lost partition
 *   Space: O(n + m) for the base data and the lineage description
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are partitions; columns are the base plus each transform stage.
 *   - GREEN marks a recomputed partition, RED a lost one, gray a normal one.
 *   - meta carries stage values, the lost partition, and the recovery verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Transform =
    | { kind: "map"; add: number }
    | { kind: "filter"; mode: "even" | "odd" | "gt" | "lt"; threshold?: number };

interface Input {
    values?: number[];
    partitions?: number;
    transforms?: Transform[];
    losePartition?: number;
}

const defaultValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const defaultTransforms: Transform[] = [
    { kind: "map", add: 10 },
    { kind: "filter", mode: "even" },
    { kind: "map", add: 1 },
];

function applyTransform(values: number[], t: Transform): number[] {
    if (t.kind === "map") return values.map((v) => v + t.add);
    const threshold = t.threshold ?? 0;
    if (t.mode === "even") return values.filter((v) => v % 2 === 0);
    if (t.mode === "odd") return values.filter((v) => v % 2 !== 0);
    if (t.mode === "gt") return values.filter((v) => v > threshold);
    return values.filter((v) => v < threshold);
}

function transformName(t: Transform): string {
    if (t.kind === "map") return `map +${t.add}`;
    const th = t.threshold ?? 0;
    if (t.mode === "even") return "filter even";
    if (t.mode === "odd") return "filter odd";
    if (t.mode === "gt") return `filter >${th}`;
    return `filter <${th}`;
}

function makeCells(stages: number[][][], lostRow: number, recomputedRow: number): VisualEntity[] {
    const p = stages[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let r = 0; r < p; r += 1) {
        for (let c = 0; c < stages.length; c += 1) {
            const vals = stages[c]![r] ?? [];
            const state: EntityState = r === recomputedRow && c === stages.length - 1 ? "sorted" : r === lostRow && c === stages.length - 1 ? "error" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: vals.length === 0 ? "empty" : `${vals.length}v`,
                value: vals[0] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, count: vals.length, values: vals.join(",") },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0 ? [...task.values] : [...defaultValues];
    const p = Math.max(2, Math.min(5, Math.floor(task.partitions ?? 3)));
    const transforms: Transform[] = Array.isArray(task.transforms) ? task.transforms : defaultTransforms;
    const lost = Math.max(0, Math.min(p - 1, Math.floor(task.losePartition ?? 0)));

    const base: number[][] = Array.from({ length: p }, () => []);
    for (let i = 0; i < values.length; i += 1) base[Math.floor((i * p) / values.length)]!.push(values[i]!);
    const stages: number[][][] = [base];
    for (const t of transforms) stages.push(stages[stages.length - 1]!.map((part) => applyTransform(part, t)));

    let recomputed: number[] = [...(base[lost] ?? [])];
    for (const t of transforms) recomputed = applyTransform(recomputed, t);
    const original = stages[stages.length - 1]![lost] ?? [];
    const verified = recomputed.length === original.length && recomputed.every((v, i) => v === original[i]);
    let recomputedRow = -1;
    let step = 0;

    const meta = (last: string, stage: number) => ({
        partitions: p,
        stages: stages.length,
        stageValues: stages.map((s) => s.map((part) => part.join(",")).join("|")),
        transforms: transforms.map(transformName),
        lostPartition: lost,
        lostValues: [...original],
        recomputed: [...recomputed],
        recomputedRow,
        verified,
        stage,
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeCells(stages, -1, -1),
        edges: [],
        description: `RDD with ${p} partitions and ${transforms.length} recorded transform(s); base data has ${values.length} values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("initialized", 0),
    };

    for (let s = 1; s < stages.length; s += 1) {
        const desc = `Stage ${s}: apply ${transformName(transforms[s - 1]!)} to every partition (lineage recorded).`;
        yield {
            stepNumber: step++,
            entities: makeCells(stages, -1, -1),
            edges: [],
            description: desc,
            codeLineNumber: 1,
            layout: "grid",
            meta: meta(desc, s),
        };
    }

    const loss = `Partition ${lost} of the final stage is lost; its ${original.length} value(s) must be rebuilt from lineage.`;
    yield {
        stepNumber: step++,
        entities: makeCells(stages, lost, -1),
        edges: [],
        description: loss,
        codeLineNumber: 3,
        layout: "grid",
        meta: meta(loss, stages.length - 1),
    };

    recomputedRow = lost;
    const rebuild = `Replay ${transforms.length} transform(s) on base partition ${lost} to recompute [${recomputed.join(", ")}].`;
    yield {
        stepNumber: step++,
        entities: makeCells(stages, lost, recomputedRow),
        edges: [],
        description: rebuild,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta(rebuild, stages.length - 1),
    };

    const done = verified
        ? `Recovery verified: recomputed partition equals the lost values [${original.join(", ")}].`
        : `Recovery mismatch: recomputed [${recomputed.join(", ")}] differs from lost [${original.join(", ")}].`;
    yield {
        stepNumber: step,
        entities: makeCells(stages, -1, recomputedRow),
        edges: [],
        description: done,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(done, stages.length - 1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of copying data to survive failures, remember the recipe that produced it. An RDD records the transformations from a base dataset to each partition. If a partition disappears, replay the recipe on its ancestors to rebuild exactly the same values. This trades replication storage for cheap recomputation and is why lineage is the key idea behind fault-tolerant parallel data processing.",
        invariants: [
            "Each stage is obtained from the previous stage by one recorded transform.",
            "A lost partition's ancestors are the same-index partitions in earlier stages.",
            "Replaying the lineage on an ancestor reproduces the lost partition exactly.",
        ],
        correctness:
            "Every transform is a deterministic function of its input partition, so applying the same transform chain to the base partition reproduces the same output partition independent of any other partition. The stored lineage lists exactly those transforms in order, so replay on the lost partition's base ancestor yields a vector equal to the original final partition component by component. The verification step checks length and per-index equality, confirming the reconstruction matches the lost data.",
        complexityRationale:
            "Replaying m transformations over a partition of size k costs O(m * k), independent of the rest of the dataset. The lineage is a list of m transform descriptions, O(m) space, plus the base data O(n), which is far less than replicating every partition.",
        uses: [
            "Fault-tolerant distributed data processing frameworks",
            "Recomputing lost cache blocks in analytics clusters",
            "Reproducible pipelines where transformations are deterministic",
        ],
        references: [
            "Zaharia et al., Resilient Distributed Datasets, 2012",
            "Zaharia et al., Spark: Cluster Computing with Working Sets, 2010",
        ],
        workedExample:
            "Base partition [1, 2, 3, 4] goes through map +10 to [11, 12, 13, 14], filter even to [12, 14], and map +1 to [13, 15]. If the final partition is lost, replaying the same three steps on [1, 2, 3, 4] rebuilds [13, 15], matching the lost values exactly.",
    },
    id: "resilient-distributed-dataset",
    name: "RDD Lineage Fault Recovery",
    category: "parallel-distributed",
    complexity: { time: "O(m * k) to replay", space: "O(n + m)" },
    defaultInput: { values: defaultValues, partitions: 3, transforms: defaultTransforms, losePartition: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "split the base data into partitions",
        "apply each transform and record it in the lineage",
        "select a partition lost from the final stage",
        "take the same-index partition from the base stage",
        "replay every recorded transform on that partition",
        "compare the rebuilt values with the lost values",
        "report whether recovery was exact",
        "done: confirm the partition is restored",
    ],
};

export default module;
