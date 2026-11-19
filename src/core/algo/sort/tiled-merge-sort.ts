/**
 * tiled-merge-sort.ts - Tiled Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tiled merge sort is a cache-aware bottom-up merge sort. Adjacent runs are
 * doubled in width each pass, and every merge first copies the two runs into a
 * small auxiliary buffer one fixed-size tile at a time, then merges back. The
 * tile-wise copy keeps both the reads and the writes local, which is the point
 * of the technique on machines where main-memory access dominates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n) auxiliary buffer plus the tile-sized working set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tile currently being copied is PINK (highlight).
 *   - The two runs being combined are YELLOW (comparing).
 *   - The final frame is entirely GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

interface TileEvent {
    snapshot: number[];
    kind: "copy" | "merge";
    lo: number;
    hi: number;
    mid: number;
    tileSize: number;
}

/** Bottom-up merge sort that stages each merge through fixed-size tiles. */
function tiledMergeSort(values: number[], tileSize: number): { sorted: number[]; events: TileEvent[] } {
    const a = [...values];
    const buffer = new Array<number>(a.length);
    const events: TileEvent[] = [];
    const tile = Math.max(1, Math.floor(tileSize));

    for (let width = 1; width < a.length; width *= 2) {
        for (let left = 0; left < a.length; left += 2 * width) {
            const mid = Math.min(left + width, a.length);
            const right = Math.min(left + 2 * width, a.length);
            if (mid >= right) continue;

            // Stage the two runs into the buffer one tile at a time.
            for (let base = left; base < right; base += tile) {
                const end = Math.min(base + tile, right);
                for (let i = base; i < end; i += 1) buffer[i] = a[i] as number;
                events.push({
                    snapshot: [...a],
                    kind: "copy",
                    lo: base,
                    hi: end,
                    mid,
                    tileSize: tile,
                });
            }

            // Merge the buffered runs back into the array.
            let i = left;
            let j = mid;
            let k = left;
            while (i < mid && j < right) {
                a[k] = (buffer[i] as number) <= (buffer[j] as number) ? (buffer[i++] as number) : (buffer[j++] as number);
                k += 1;
            }
            while (i < mid) {
                a[k] = buffer[i++] as number;
                k += 1;
            }
            while (j < right) {
                a[k] = buffer[j++] as number;
                k += 1;
            }
            events.push({ snapshot: [...a], kind: "merge", lo: left, hi: right, mid, tileSize: tile });
        }
    }
    return { sorted: a, events };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; tileSize?: number } | null) ?? {};
    const values: number[] = Array.isArray(input)
        ? [...(input as number[])]
        : Array.isArray(task.values)
          ? [...(task.values as number[])]
          : [8, 3, 5, 1, 9, 2, 7, 4, 6];
    const tile = typeof task.tileSize === "number" ? Math.max(1, task.tileSize) : 2;

    const result = tiledMergeSort(values, tile);
    let step = 0;
    let merges = 0;
    let tilesCopied = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Tiled merge sort: runs are staged through a buffer in tiles of ${tile}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { tileSize: tile, merges, tilesCopied, size: values.length },
    };
    step += 1;

    for (const event of result.events) {
        const states = new Map<number, EntityState>();
        if (event.kind === "copy") {
            for (let i = event.lo; i < event.hi; i += 1) states.set(i, "highlight");
            tilesCopied += 1;
        } else {
            merges += 1;
            for (let i = event.lo; i < event.hi; i += 1) states.set(i, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(event.snapshot, states),
            edges: [],
            description:
                event.kind === "copy"
                    ? `Copied tile [${event.lo},${event.hi}) of length ${event.tileSize} into the buffer.`
                    : `Merged buffered runs [${event.lo},${event.mid}) and [${event.mid},${event.hi}) back into the array.`,
            codeLineNumber: event.kind === "copy" ? 2 : 4,
            layout: "array",
            meta: { tileSize: tile, merges, tilesCopied, lo: event.lo, mid: event.mid, hi: event.hi },
        };
        step += 1;
        if (step > 70) break;
    }

    const sortedStates = new Map<number, EntityState>(
        result.sorted.map((_, index) => [index, "sorted"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeBars(result.sorted, sortedStates),
        edges: [],
        description: `Sorted with ${merges} tile-buffer merge(s) and ${tilesCopied} tile copy step(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { tileSize: tile, merges, tilesCopied, sorted: [...result.sorted] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Merging two sorted runs means reading and writing every element once, so on modern machines the cost is often memory traffic rather than comparisons. Tiled merge sort copies each run into a small buffer in fixed-size chunks, then merges from that buffer back into place. Working in chunks keeps each step local to a cache line instead of jumping across the array.",
        invariants: [
            "Each pass merges adjacent runs of equal width, doubling the sorted width.",
            "The buffer holds an exact copy of the run being merged, in order.",
            "Merging two buffered sorted runs emits a single longer sorted run.",
        ],
        correctness:
            "Every run starts sorted (width one). The two-finger merge takes the smaller buffered head each time, so it produces a sorted union of the two runs and preserves all values. After log n doubling passes a single sorted run of the whole array remains.",
        complexityRationale:
            "Each of the O(log n) passes copies and merges every element once, so time is O(n log n). The auxiliary buffer holds the current merge region, which is at most n elements, giving O(n) extra space.",
        uses: [
            "Cache-aware sorting in database and language runtimes",
            "External-memory merge when data arrives in blocks",
            "Teaching the memory-hierarchy view of merge sort",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 2 (merge sort)",
            "LaMarca and Ladner, The Influence of Caches on the Performance of Sorting, 1997",
        ],
        workedExample:
            "For [8, 3, 5, 1] with tile size 2, the first pass copies [8, 3] and [5, 1] through the buffer in one tile each, merging them into [3, 8] and [1, 5]. The next pass stages those two runs and merges them into [1, 3, 5, 8].",
    },
    id: "tiled-merge-sort",
    name: "Tiled Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [8, 3, 5, 1, 9, 2, 7, 4, 6], tileSize: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "set the run width to one and choose a tile size",
        "for each pair of adjacent runs in the current width",
        "copy both runs into the buffer one tile at a time",
        "merge the buffered runs back into the array with two fingers",
        "double the run width and repeat until one run remains",
        "done: the array holds a single sorted run",
    ],
};

export default module;
