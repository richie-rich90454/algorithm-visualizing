/**
 * ko-aluru-small-large.ts - Ko-Aluru Small-Large Sorting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Ko-Aluru "small-large" technique sorts integer keys in linear time by
 * repeatedly separating keys below a base threshold (small) from keys at or
 * above it (large). Small keys are placed directly into their final bucket.
 * Large keys are written as quotient times base plus remainder; the quotients
 * and remainders are sorted recursively, then reassembled in order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per level with O(log_base(maxValue)) levels
 *   Space: O(n + base) for buckets and groups
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the keys of the current subproblem.
 *   - Small keys are VISITED (placed by direct bucketing).
 *   - Large keys are ACTIVE (still need recursive sorting).
 *   - The final frame marks every bar SORTED.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Snapshot {
    values: number[];
    smallCount: number;
    sorted: boolean;
    description: string;
    line: number;
    depth: number;
}

/** Build bar entities for a snapshot of the current keys. */
function makeBars(values: number[], smallCount: number, sorted: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (sorted) {
            state = "sorted";
        } else if (index < smallCount) {
            state = "visited";
        } else if (smallCount < values.length) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, small: index < smallCount },
        };
    });
}

/** Recursively sort keys with the small-large decomposition. */
function smallLargeSort(values: number[], base: number, trace: Snapshot[], depth: number): number[] {
    if (values.length <= 1) {
        return [...values];
    }

    const small: number[] = [];
    const large: number[] = [];
    for (const value of values) {
        if (value < base) {
            small.push(value);
        } else {
            large.push(value);
        }
    }
    trace.push({
        values: [...values],
        smallCount: small.length,
        sorted: false,
        description: `Level ${depth}: split ${values.length} keys into ${small.length} small (< ${base}) and ${large.length} large (>= ${base}).`,
        line: 2,
        depth,
    });

    const buckets: number[][] = Array.from({ length: base }, () => []);
    for (const value of small) {
        (buckets[value] as number[]).push(value);
    }
    const smallSorted: number[] = ([] as number[]).concat(...buckets);
    if (smallSorted.length > 0) {
        trace.push({
            values: smallSorted,
            smallCount: smallSorted.length,
            sorted: false,
            description: `Level ${depth}: direct-address the small keys into ${base} buckets -> [${smallSorted.join(", ")}].`,
            line: 3,
            depth,
        });
    }

    if (large.length === 0) {
        return smallSorted;
    }

    const groups = new Map<number, number[]>();
    for (const value of large) {
        const quotient = Math.floor(value / base);
        const remainder = value - quotient * base;
        const group = groups.get(quotient);
        if (group) {
            group.push(remainder);
        } else {
            groups.set(quotient, [remainder]);
        }
    }
    const quotients = [...groups.keys()];
    const sortedQuotients = smallLargeSort(quotients, base, trace, depth + 1);

    const largeSorted: number[] = [];
    for (const quotient of sortedQuotients) {
        const remainders = groups.get(quotient) as number[];
        const sortedRemainders = smallLargeSort(remainders, base, trace, depth + 1);
        for (const remainder of sortedRemainders) {
            largeSorted.push(quotient * base + remainder);
        }
    }

    const result = [...smallSorted, ...largeSorted];
    trace.push({
        values: result,
        smallCount: smallSorted.length,
        sorted: false,
        description: `Level ${depth}: reassemble quotients and remainders -> [${result.join(", ")}].`,
        line: 7,
        depth,
    });
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const raw = Array.isArray(task.values) ? task.values : [52, 17, 38, 4, 65, 21, 9, 47, 33, 12];
    const values = raw
        .slice(0, 24)
        .map((v) => Math.max(0, Math.floor(Number(v) || 0)));
    const base = Math.max(2, values.length);
    const lines = 9;
    const trace: Snapshot[] = [];
    const sorted = smallLargeSort(values, base, trace, 0);
    let step = 0;

    const frame = (snap: Snapshot): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(snap.values, snap.smallCount, snap.sorted),
        edges: [],
        description: snap.description,
        codeLineNumber: Math.min(snap.line, lines - 1),
        layout: "array",
        meta: {
            sorted: sorted.join(","),
            depth: snap.depth,
            base,
            smallCount: snap.smallCount,
            keys: snap.values.join(","),
        },
    });

    yield {
        stepNumber: step,
        entities: makeBars(values, 0, false),
        edges: [],
        description: `Sort ${values.length} keys with the Ko-Aluru small-large decomposition (base ${base}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sorted: sorted.join(","), base, depth: 0, smallCount: 0, keys: values.join(",") },
    };
    step += 1;

    for (const snap of trace) {
        yield frame(snap);
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(sorted, 0, true),
        edges: [],
        description: `Sorted keys: [${sorted.join(", ")}].`,
        codeLineNumber: lines - 1,
        layout: "array",
        meta: { sorted: sorted.join(","), base, depth: 0, smallCount: values.length, keys: sorted.join(",") },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split the keys into small ones that fit below a threshold and large ones that do not. Small keys drop straight into their final bucket because their value already names the bucket. Large keys are factored into a quotient and a remainder; sorting those smaller pieces recursively and gluing them back together puts the large keys in order too.",
        invariants: [
            "Every small key lands in the bucket indexed by its own value, already in final position.",
            "A large key equals quotient times base plus remainder, with remainder strictly below base.",
            "Quotients and remainders are strictly smaller than the original large key, so recursion terminates.",
        ],
        correctness:
            "Small keys are placed by direct addressing, so they are trivially sorted and precede every large key. For large keys, factoring by base gives a quotient group and an in-bucket remainder. Recursive sorting orders the quotient groups; sorting the remainders inside each group orders keys within that group. Concatenating groups in quotient order therefore yields all keys in nondecreasing order, which an induction on the maximum key value establishes.",
        complexityRationale:
            "At one level, partitioning, bucketing, and grouping each scan the n keys once, and the bucket array costs base cells. The recursion descends on values divided by base, so there are O(log_base(maxValue)) levels, giving O(n log_base(maxValue)) time and O(n + base) working space.",
        uses: [
            "Linear-time integer sorting when keys come from a bounded range",
            "Radix-style sorting inside high-throughput database operators",
            "A teaching bridge between counting sort and radix sort",
        ],
        references: [
            "Ko and Aluru, An Array-Based Algorithm for Sorting, 1994",
            "Knuth, The Art of Computer Programming, Volume 3, Section 5.2",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 8",
        ],
        workedExample:
            "With base 4 and keys 9, 1, 6, 3, the small keys 1 and 3 bucket to [1, 3]. The large keys 9 and 6 become quotients 2 and 1 with remainders 1 and 2. Sorting quotients gives 1 then 2, so reassembly yields 6 then 9, and the final order is [1, 3, 6, 9].",
    },
    id: "ko-aluru-small-large",
    name: "Ko-Aluru Small-Large Sort",
    category: "string",
    complexity: { time: "O(n log_base(maxValue))", space: "O(n + base)" },
    defaultInput: { values: [52, 17, 38, 4, 65, 21, 9, 47, 33, 12] },
    visualType: "array",
    run,
    pseudocode: [
        "choose a base near the number of keys",
        "partition keys into small (< base) and large (>= base)",
        "direct-address the small keys into buckets",
        "group large keys by floor(key / base)",
        "recursively sort the quotient group keys",
        "recursively sort remainders in each group",
        "reassemble quotient times base plus remainder",
        "concatenate sorted small keys then large keys",
        "report the fully sorted key list",
    ],
};

export default module;
