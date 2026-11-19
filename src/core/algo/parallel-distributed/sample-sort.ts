/**
 * sample-sort.ts - Parallel Sample Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sample sort is a scalable parallel comparison sort. The n input values are
 * split into p contiguous blocks, one per processor. Each processor sends a
 * few evenly spaced samples from its block to a collector. The samples are
 * sorted globally and p-1 splitters are chosen at regular ranks. Every
 * processor then partitions its own block into p buckets using those splitters
 * and sends bucket j to processor j. Each processor sorts the bucket it
 * receives; concatenating the p sorted buckets in order gives the globally
 * sorted sequence, because every value in bucket j is smaller than every value
 * in bucket j+1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((n/p) log(n/p) + p log p) per processor after sampling
 *   Space: O(n/p + p) per processor for its block and buckets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are source blocks; columns are destination buckets.
 *   - Each cell shows how many values that block sent to that bucket.
 *   - GREEN marks the active block; meta.final is the assembled sorted array.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    values?: number[];
    processors?: number;
    samplesPerBlock?: number;
}

const defaultValues = [34, 8, 64, 51, 32, 21, 73, 4, 55, 41, 17, 88, 60, 29, 2, 47];

function makeCells(counts: number[][], activeRow: number, phase: string): VisualEntity[] {
    const p = counts.length;
    const entities: VisualEntity[] = [];
    for (let r = 0; r < p; r += 1) {
        for (let c = 0; c < p; c += 1) {
            const count = counts[r]![c] ?? 0;
            const state: EntityState = phase === "final" ? "sorted" : r === activeRow ? "active" : count > 0 ? "comparing" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `${count}`,
                value: count,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, count, source: r, bucket: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0 ? [...task.values] : [...defaultValues];
    const p = Math.max(2, Math.min(6, Math.floor(task.processors ?? 4)));
    const s = Math.max(1, Math.floor(task.samplesPerBlock ?? 2));

    const blocks: number[][] = Array.from({ length: p }, () => []);
    for (let i = 0; i < values.length; i += 1) blocks[i % p]!.push(values[i]!);

    const samples: number[] = [];
    for (const block of blocks) {
        for (let k = 0; k < s; k += 1) {
            const idx = Math.floor(((k + 1) * (block.length - 1)) / (s + 1));
            const v = block[Math.max(0, idx)] ?? 0;
            samples.push(v);
        }
    }
    samples.sort((a, b) => a - b);
    const splitters: number[] = [];
    for (let j = 1; j < p; j += 1) splitters.push(samples[Math.min(samples.length - 1, j * s)] ?? 0);

    const bucketOf = (v: number): number => {
        let b = 0;
        for (const sp of splitters) if (v >= sp) b += 1;
        return b;
    };

    const counts: number[][] = Array.from({ length: p }, () => Array.from({ length: p }, () => 0));
    const buckets: number[][] = Array.from({ length: p }, () => []);
    for (let r = 0; r < p; r += 1) {
        for (const v of blocks[r]!) {
            const b = bucketOf(v);
            counts[r]![b] = (counts[r]![b] ?? 0) + 1;
            buckets[b]!.push(v);
        }
    }

    let step = 0;
    const meta = (phase: string, activeRow: number, last: string) => ({
        processors: p,
        rows: p,
        cols: p,
        samplesPerBlock: s,
        samples: [...samples],
        splitters: [...splitters],
        phase,
        activeRow,
        total: values.length,
        sorted: phase === "final",
        final: phase === "final" ? buckets.flatMap((b) => [...b].sort((x, y) => x - y)) : [],
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeCells(counts, -1, "start"),
        edges: [],
        description: `Sample sort of ${values.length} values on ${p} processors with ${s} sample(s) per block.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("start", -1, "initialized"),
    };

    const sampleDesc = `Collected ${samples.length} sorted samples: [${samples.join(", ")}].`;
    yield {
        stepNumber: step++,
        entities: makeCells(counts, -1, "samples"),
        edges: [],
        description: sampleDesc,
        codeLineNumber: 1,
        layout: "grid",
        meta: meta("samples", -1, sampleDesc),
    };

    const splitDesc = `Choose ${splitters.length} splitters from the samples: [${splitters.join(", ")}].`;
    yield {
        stepNumber: step++,
        entities: makeCells(counts, -1, "splitters"),
        edges: [],
        description: splitDesc,
        codeLineNumber: 2,
        layout: "grid",
        meta: meta("splitters", -1, splitDesc),
    };

    for (let r = 0; r < p; r += 1) {
        const rowCounts = counts[r]!.map((c, j) => `${j}:${c}`).join(", ");
        const desc = `Block ${r} partitions its ${blocks[r]!.length} values into buckets (${rowCounts}).`;
        yield {
            stepNumber: step++,
            entities: makeCells(counts, r, "partition"),
            edges: [],
            description: desc,
            codeLineNumber: 3,
            layout: "grid",
            meta: meta("partition", r, desc),
        };
    }

    for (let b = 0; b < p; b += 1) {
        const desc = `Processor ${b} receives bucket ${b} with ${buckets[b]!.length} value(s) and sorts it locally.`;
        yield {
            stepNumber: step++,
            entities: makeCells(counts, b, "sort"),
            edges: [],
            description: desc,
            codeLineNumber: 4,
            layout: "grid",
            meta: meta("sort", b, desc),
        };
    }

    const final = buckets.flatMap((b) => [...b].sort((x, y) => x - y));
    const done = `Concatenated buckets give the sorted output [${final.join(", ")}].`;
    yield {
        stepNumber: step,
        entities: makeCells(counts, -1, "final"),
        edges: [],
        description: done,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...meta("final", -1, done), final },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To sort in parallel, first learn roughly where the data sits. Take a handful of samples from each processor's chunk, sort them together, and use regular ranks as boundaries. Now each processor knows exactly which slice of the value range belongs to each destination, so it can ship values to the right processor in one round. Every processor sorts only its own slice; because the slices are ordered by value, simply concatenating them finishes the job.",
        invariants: [
            "The splitters are in nondecreasing order.",
            "A value goes to bucket j when it is at least splitter j-1 and below splitter j.",
            "Every value from every block is placed in exactly one bucket.",
        ],
        correctness:
            "Partitioning puts a value v in bucket j exactly when j splitters are at most v, so all values in bucket j are less than all values in bucket j+1. Sorting each bucket locally makes each bucket internally ordered. Concatenating buckets 0 through p-1 therefore yields a globally nondecreasing sequence. The partition step moves each original value once and never duplicates or drops it, so the output is a permutation of the input. Hence the result is a correct sort on any input, and sampling only affects load balance, not correctness.",
        complexityRationale:
            "Collecting p*s samples and sorting them costs O(p*s log(p*s)), small compared with the data. Partitioning scans n values, and each processor sorts about n/p values, O((n/p) log(n/p)); sending p buckets takes O(p) messages. Space per processor is its block plus buckets, O(n/p + p).",
        uses: [
            "Sorting large datasets in distributed data processing frameworks",
            "The shuffle phase of parallel database joins and aggregations",
            "A scalable alternative to merge sort when data is evenly distributed",
        ],
        references: [
            "Blelloch, Dehne, Ferreira et al., A Comparison of Sorting Algorithms for the Connection Machine CM-2, 1991",
            "Solomonik et al., Optimal-Width Sample Sort, 2016",
        ],
        workedExample:
            "With values [34, 8, 64, 51, 32, 21, 73, 4] on two processors, each contributes two samples. Sorting the samples and taking the middle one gives a splitter near 33. Values below it go to bucket 0 and the rest to bucket 1. Sorting each bucket and concatenating produces an increasing sequence containing every original value exactly once.",
    },
    id: "sample-sort",
    name: "Parallel Sample Sort",
    category: "parallel-distributed",
    complexity: { time: "O((n/p) log(n/p) + p log p)", space: "O(n/p + p)" },
    defaultInput: { values: defaultValues, processors: 4, samplesPerBlock: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "split the input into p contiguous blocks",
        "collect s evenly spaced samples from each block",
        "sort all samples and pick p-1 regular splitters",
        "for each value find the bucket given by the splitters",
        "send each bucket to its destination processor",
        "sort the received bucket locally",
        "concatenate buckets in increasing order",
        "done: report the globally sorted sequence",
    ],
};

export default module;
