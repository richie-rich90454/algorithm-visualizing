/**
 * coupon-collector.ts - Coupon Collector Simulation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * There are n distinct coupons and each draw returns one uniformly at random.
 * The coupon collector problem asks how many draws are needed until every type
 * has appeared at least once. A seeded generator produces a reproducible
 * stream; the run records the draw that first reveals each new type and
 * compares the stopping time with the exact expectation n times the n-th
 * harmonic number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T) for T draws until completion
 *   Space: O(n) for the seen set and first-seen times
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coupon type shows how many copies have been drawn.
 *   - The bar for the current draw is highlighted.
 *   - meta carries the draw sequence and the first-seen time of each type.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function couponBars(counts: number[], current: number, firstSeen: number[]): VisualEntity[] {
    return counts.map((count, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `C${index + 1}:${count}${firstSeen[index] ? "*" : ""}`,
        value: count,
        state: (index === current ? "comparing" : firstSeen[index] ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, count, firstSeen: firstSeen[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coupons?: number; seed?: number } | null) ?? {};
    const n = typeof task.coupons === "number" && Number.isInteger(task.coupons)
        ? Math.max(1, Math.min(12, task.coupons))
        : 6;
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed) ? task.seed : 11;

    const rng = makeRng(seed);
    const counts = new Array<number>(n).fill(0);
    const firstSeen = new Array<number>(n).fill(0);
    const draws: number[] = [];
    let seen = 0;
    let drawsUsed = 0;
    const cap = 100000;

    const harmonic = (() => {
        let sum = 0;
        for (let k = 1; k <= n; k += 1) {
            sum += 1 / k;
        }
        return sum;
    })();
    const expected = n * harmonic;

    let step = 0;
    yield {
        stepNumber: step,
        entities: couponBars(counts, -1, firstSeen),
        edges: [],
        description: `Collecting all ${n} coupon types with a seeded uniform generator (seed ${seed}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, seed, phase: "setup", drawsUsed: 0, expected },
    };
    step += 1;

    while (seen < n && drawsUsed < cap) {
        const type = Math.floor(rng() * n) % n;
        draws.push(type);
        drawsUsed += 1;
        counts[type] = (counts[type] as number) + 1;
        const isNew = firstSeen[type] === 0;
        if (isNew) {
            firstSeen[type] = drawsUsed;
            seen += 1;
        }
        yield {
            stepNumber: step,
            entities: couponBars(counts, type, firstSeen),
            edges: [],
            description: `Draw ${drawsUsed} produced coupon C${type + 1}${isNew ? ", a new type" : ", a duplicate"}; ${seen} of ${n} types seen.`,
            codeLineNumber: isNew ? 2 : 1,
            layout: "array",
            meta: { n, seed, phase: "draw", drawsUsed, type, isNew, seen, expected },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: couponBars(counts, -1, firstSeen),
        edges: [],
        description: `All ${n} types collected after ${drawsUsed} draws; the exact expectation is ${expected.toFixed(2)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            n,
            seed,
            phase: "done",
            drawsUsed,
            draws,
            firstSeen,
            expected,
            complete: seen === n,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each draw is like pulling a random coupon from a fixed collection. Early draws mostly reveal new types, but the last few types are hard to find because most draws are duplicates. The expected stopping time is the sum of waiting times for each new type, which gives n times the harmonic number; the simulation shows a concrete run and the draw that first revealed every type.",
        invariants: [
            "Every draw returns a coupon type between zero and n minus one.",
            "firstSeen for a type is set exactly once, on its first appearance.",
            "The run stops only when all n types have first-seen times.",
        ],
        correctness:
            "After k distinct types have been seen, the chance the next draw is a new type is (n - k)/n, so the waiting time for the next new type is geometric with mean n/(n - k). Summing these means for k from zero to n-1 gives n times the sum of 1/j for j from one to n, which is the reported expectation. The generator's first-seen times mark the geometric waiting times of one concrete run, and the loop terminates precisely when the last type appears.",
        complexityRationale:
            "Each draw performs constant work and there are T draws until all types are seen, so the time is O(T). The counts, first-seen marks, and draw log are each bounded by n or T, giving O(n) working state for the collection itself.",
        uses: [
            "Estimating how long to wait until all variants of a feature are observed",
            "Analysis of randomized load balancing and hashing probes",
            "Birthday-style collision and coverage estimation",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 1, Section 1.2.10 (coupon collector)",
            "Mitzenmacher and Upfal, Probability and Computing, Chapter 2",
        ],
        workedExample:
            "For n = 6 coupon types the expected stopping time is 6 times the sixth harmonic number, about 14.7 draws. A seeded run might first see types at draws 1, 3, 4, 8, 11, and 14, finishing after 14 draws, close to the expectation.",
    },
    id: "coupon-collector",
    name: "Coupon Collector Simulation",
    category: "statistics-probability",
    complexity: { time: "O(T)", space: "O(n)" },
    defaultInput: { coupons: 6, seed: 11 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize zero counts and no first-seen times for every coupon type",
        "repeat until every type has been seen",
        "draw a type uniformly at random and increment its count",
        "if the type is new record its first-seen draw and advance the seen count",
        "report the total draws and the exact expected stopping time",
    ],
};

export default module;
