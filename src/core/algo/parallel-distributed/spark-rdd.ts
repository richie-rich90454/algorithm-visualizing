/**
 * spark-rdd.ts - RDD Lineage Recovery
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A resilient distributed dataset is a partitioned collection whose
 * transformations are recorded as a lineage graph rather than materialized
 * everywhere. When a partition of the final dataset is lost, the engine does
 * not need a replica: it reads the corresponding partition of the parent and
 * replays the narrow transformations that produced the missing data. This
 * simulation applies a chain of map and filter operations to each partition,
 * drops one final partition, and recomputes it from the base through the same
 * chain, checking that the recovered values are identical.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * s) to compute a partition through s stages of m elements
 *   Space: O(p * s * m) for the materialized lineage table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are lineage stages: the base dataset followed by each transformation.
 *   - Columns are partitions; each cell summarizes the values it holds.
 *   - A lost cell is red, a replayed cell is yellow, and a recovered cell green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    partitions?: number[][];
    ops?: string[];
    lostPartition?: number;
}

const OPS = ["double", "plusOne", "filterEven", "square"];
const DEFAULT_PARTITIONS = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

function applyOp(values: number[], op: string): number[] {
    switch (op) {
        case "double":
            return values.map((v) => v * 2);
        case "plusOne":
            return values.map((v) => v + 1);
        case "filterEven":
            return values.filter((v) => v % 2 === 0);
        case "square":
            return values.map((v) => v * v);
        default:
            return values;
    }
}

function makeCells(stages: number[][][], lost: number, replayStage: number, recovered: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let s = 0; s < stages.length; s += 1) {
        for (let p = 0; p < (stages[s]?.length ?? 0); p += 1) {
            const values = stages[s]?.[p] ?? [];
            let state: EntityState = "idle";
            if (!recovered && s === stages.length - 1 && p === lost) {
                state = "error";
            } else if (recovered && s === stages.length - 1 && p === lost) {
                state = "sorted";
            } else if (!recovered && s === replayStage && p === lost) {
                state = "comparing";
            } else {
                state = "visited";
            }
            entities.push({
                id: `cell-${s}-${p}`,
                type: "cell",
                label: values.join(",") || "-",
                value: values.reduce((sum, v) => sum + v, 0),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: s, col: p, stage: s, partition: p, size: values.length },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const rawPartitions = Array.isArray(task.partitions) && task.partitions.length >= 1
        ? task.partitions
        : DEFAULT_PARTITIONS;
    const partitions = rawPartitions.slice(0, 6).map((part) =>
        (Array.isArray(part) ? part : []).filter((v) => typeof v === "number" && Number.isFinite(v)).map((v) => v as number),
    );
    const rawOps = Array.isArray(task.ops) ? task.ops.filter((op) => OPS.includes(op)).slice(0, 5) : ["double", "filterEven"];
    const ops = rawOps.length > 0 ? rawOps : ["double", "filterEven"];
    const lost = typeof task.lostPartition === "number" && Number.isFinite(task.lostPartition)
        ? Math.max(0, Math.min(partitions.length - 1, Math.floor(task.lostPartition)))
        : 0;
    const stages: number[][][] = [partitions.map((part) => [...part])];
    for (const op of ops) {
        stages.push((stages[stages.length - 1] ?? []).map((part) => applyOp(part, op)));
    }
    const finalStage = stages.length - 1;
    const original = [...(stages[finalStage]?.[lost] ?? [])];
    const extra = { ops: [...ops], partitions: partitions.length, stages: finalStage, lostPartition: lost };

    yield {
        stepNumber: 0,
        entities: makeCells(stages, lost, -1, true),
        edges: [],
        description: `RDD with ${partitions.length} partitions and ${ops.length} recorded transformation(s) in its lineage.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...extra, rows: stages.length, cols: partitions.length, original, recovered: [], ok: true, phase: "materialized" },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(stages, lost, -1, false),
        edges: [],
        description: `Partition ${lost} of the final dataset was lost; its lineage still points to the base partition.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...extra, rows: stages.length, cols: partitions.length, original, recovered: [], ok: false, phase: "lost" },
    };

    let replay = [...(partitions[lost] ?? [])];
    let step = 2;
    for (let s = 0; s < ops.length; s += 1) {
        replay = applyOp(replay, ops[s] ?? "");
        yield {
            stepNumber: step,
            entities: makeCells(stages, lost, s + 1, false),
            edges: [],
            description: `Replaying ${ops[s]} from the parent partition yields [${replay.join(", ")}] at stage ${s + 1}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { ...extra, rows: stages.length, cols: partitions.length, original, recovered: [...replay], ok: false, phase: `replay-${s + 1}` },
        };
        step += 1;
    }

    const ok = replay.length === original.length && replay.every((v, i) => v === original[i]);
    yield {
        stepNumber: step,
        entities: makeCells(stages, lost, -1, true),
        edges: [],
        description: ok
            ? `Recovered partition ${lost} as [${replay.join(", ")}], identical to the lost data.`
            : `Recovered partition ${lost} differs from the original; lineage replay failed.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...extra, rows: stages.length, cols: partitions.length, original, recovered: [...replay], ok, phase: "recovered" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of storing every intermediate result, keep a recipe: which transformations were applied to which partitions. If a result disappears, run the recipe again on its small parent partition. Because narrow transformations touch one partition independently, recovery reads only one parent and never recomputes the whole dataset.",
        invariants: [
            "Each stage is produced from the previous stage by the recorded narrow transformation.",
            "A missing final partition can be rebuilt from the base partition at the same index.",
            "Replaying a deterministic transformation yields exactly the lost values.",
        ],
        correctness:
            "The lineage table records stages S0 through Sk where S_{t+1} is the elementwise application of op t to every partition of S_t. A lost partition of Sk has a unique chain S0[p], S1[p], ..., Sk[p] because narrow transformations never combine partitions. Replaying those same operations on S0[p] reconstructs each later stage by induction, so the final recovered array equals the original array whenever the operations are deterministic, which they are here.",
        complexityRationale:
            "Rebuilding one partition applies s transformation steps to at most m elements, O(m times s) time. Materializing the whole lineage table for p partitions and s stages takes O(p times s times m) space; a real engine usually keeps only the lineage and recomputes on demand.",
        uses: [
            "Fault-tolerant data processing in Spark and similar engines",
            "Recomputing lost cache partitions without replication",
            "Reproducing a dataset exactly from a recorded transformation graph",
        ],
        references: [
            "Zaharia et al., Resilient Distributed Datasets, NSDI 2012",
            "Zaharia et al., Spark: Cluster Computing with Working Sets, 2010",
        ],
        workedExample:
            "Base partition [1, 2, 3] with lineage double then filterEven produces [2, 4, 6] then [2, 4, 6] again because all doubled values are even. If that final partition is lost, reading [1, 2, 3] and replaying the two operations rebuilds [2, 4, 6] exactly.",
    },
    id: "spark-rdd",
    name: "RDD Lineage Recovery",
    category: "parallel-distributed",
    complexity: { time: "O(m * s)", space: "O(p * s * m)" },
    defaultInput: { partitions: DEFAULT_PARTITIONS, ops: ["double", "filterEven"], lostPartition: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "materialize each stage of the transformation chain per partition",
        "record the lineage linking every stage to its parent",
        "mark the chosen final partition as lost",
        "read the base partition at the same index",
        "replay each recorded transformation on the recovered values",
        "compare the rebuilt values with the lost original",
        "done: report whether recovery succeeded",
    ],
};

export default module;
