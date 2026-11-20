/**
 * hyperbolic-cache.ts - Hyperbolic Caching Admission Policy
 *
 * A frequency-based cache admission rule inspired by the hyperbolic (Zipf)
 * distribution of real object requests. Each object keeps a request count and
 * an estimated rank among all seen objects. Under a Zipf model the expected
 * request rate of rank r falls as r to the minus s, so a new object is admitted
 * only when its observed count exceeds the expected rate for its rank. Low-rate
 * scan objects are filtered out before they can evict popular objects. This is
 * a compact teaching model of the admission idea, not the full production
 * system with sampling and dynamic size control.
 *
 * Complexity:
 *   Time:  O(distinct objects * log distinct) per miss for rank and harmonic sum
 *   Space: O(distinct objects) for the frequency table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HyperbolicState {
    frequency: Map<string, number>;
    cached: string[];
    total: number;
    inserted: number;
}

function harmonic(distinct: number, exponent: number): number {
    let total = 0;
    for (let rank = 1; rank <= distinct; rank += 1) {
        total += 1 / Math.pow(rank, exponent);
    }
    return total;
}

function estimateRank(frequency: Map<string, number>, key: string): number {
    const target = frequency.get(key) ?? 0;
    let rank = 1;
    for (const value of frequency.values()) {
        if (value > target) {
            rank += 1;
        }
    }
    return rank;
}

function admissionThreshold(state: HyperbolicState, key: string, exponent: number): number {
    const distinct = Math.max(1, state.frequency.size);
    const rank = estimateRank(state.frequency, key);
    const probability = Math.pow(rank, -exponent) / harmonic(distinct, exponent);
    return state.total * probability;
}

function access(state: HyperbolicState, key: string, capacity: number, exponent: number): { hit: boolean; admitted: boolean; threshold: number } {
    state.total += 1;
    state.frequency.set(key, (state.frequency.get(key) ?? 0) + 1);
    if (state.cached.includes(key)) {
        return { hit: true, admitted: false, threshold: admissionThreshold(state, key, exponent) };
    }
    const threshold = admissionThreshold(state, key, exponent);
    const admitted = (state.frequency.get(key) ?? 0) > threshold;
    if (admitted) {
        if (state.cached.length >= capacity) {
            let victimIndex = 0;
            for (let i = 1; i < state.cached.length; i += 1) {
                const current = state.cached[i] ?? "";
                const best = state.cached[victimIndex] ?? "";
                if ((state.frequency.get(current) ?? 0) < (state.frequency.get(best) ?? 0)) {
                    victimIndex = i;
                }
            }
            state.cached.splice(victimIndex, 1);
        }
        state.cached.push(key);
        state.inserted += 1;
    }
    return { hit: false, admitted, threshold };
}

function makeCells(state: HyperbolicState, capacity: number, current: string | null): VisualEntity[] {
    return Array.from({ length: capacity }, (_, col) => {
        const key = state.cached[col];
        const stateName: EntityState = key === current ? "active" : key === undefined ? "idle" : "sorted";
        return {
            id: `cell-0-${col}`,
            type: "cell" as const,
            label: key === undefined ? "-" : `${key}:${state.frequency.get(key) ?? 0}`,
            value: key ?? "",
            state: stateName,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { trace?: string[]; capacity?: number; exponent?: number } | null) ?? {};
    const trace = Array.isArray(task.trace) ? task.trace.map(String) : ["a", "a", "b", "c", "a", "d", "b", "a", "e", "b"];
    const capacity = Math.max(1, typeof task.capacity === "number" ? task.capacity : 3);
    const exponent = typeof task.exponent === "number" && task.exponent > 0 ? task.exponent : 0.8;
    const state: HyperbolicState = { frequency: new Map(), cached: [], total: 0, inserted: 0 };
    let hits = 0;
    let admitted = 0;
    const base = { capacity, exponent, trace: trace.length };

    yield {
        stepNumber: 0,
        entities: makeCells(state, capacity, null),
        edges: [],
        description: "A Zipf model sets a rank-dependent admission threshold for every miss.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", hits, admitted, cached: state.cached },
    };
    for (let i = 0; i < trace.length; i += 1) {
        const key = trace[i] ?? "";
        const result = access(state, key, capacity, exponent);
        if (result.hit) {
            hits += 1;
        }
        if (result.admitted) {
            admitted += 1;
        }
        yield {
            stepNumber: i + 1,
            entities: makeCells(state, capacity, key),
            edges: [],
            description: `Access ${i}: ${key} ${result.hit ? "hits" : result.admitted ? "is admitted" : "is rejected"}; observed ${state.frequency.get(key)} vs threshold ${result.threshold.toFixed(2)}.`,
            codeLineNumber: result.hit ? 2 : result.admitted ? 5 : 6,
            layout: "grid",
            meta: {
                ...base,
                phase: result.hit ? "hit" : result.admitted ? "admit" : "reject",
                hits,
                admitted,
                threshold: Number(result.threshold.toFixed(4)),
                total: state.total,
                distinct: state.frequency.size,
                cached: state.cached,
                frequency: Object.fromEntries(state.frequency),
            },
        };
    }
    yield {
        stepNumber: trace.length + 1,
        entities: makeCells(state, capacity, null),
        edges: [],
        description: `${hits} hit(s), ${admitted} admission(s); ${state.cached.length} of ${capacity} slots occupied.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...base, phase: "done", hits, admitted, cached: state.cached, frequency: Object.fromEntries(state.frequency) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Real object requests are highly skewed: a few objects are very popular and most are rarely asked for again. A hyperbolic cache uses that shape as a filter. It compares how often an object has actually been requested with how often a Zipf model says an object of that rank should be requested. Only objects that beat their expected rate are worth caching, so a one-time scan cannot flush the popular set.",
        invariants: [
            "Every seen object has a nonnegative request count in the frequency table.",
            "The estimated Zipf probability decreases as the rank increases.",
            "An object is cached at the end of a miss only if its count exceeds the admission threshold.",
        ],
        correctness:
            "The threshold for a rank r is the total number of requests times r to the minus exponent divided by the harmonic sum over all seen ranks, which is exactly the expected request rate under the assumed Zipf model. Comparing the observed count to that expectation admits objects whose popularity is higher than their rank predicts. Replaying a trace applies the same deterministic comparisons, so the hit and admission counts and the final cached set are reproducible.",
        complexityRationale:
            "Estimating a rank scans the frequency table, and the harmonic sum runs over the number of distinct objects, so each miss costs O(distinct log distinct) time. Storing one count per object and the cached list uses O(distinct) space.",
        uses: [
            "Web cache admission that resists one-time scans",
            "Content delivery networks with skewed request streams",
            "Teaching frequency estimation and popularity modeling",
        ],
        references: [
            "Adams et al., Hyperbolic Caching: Flexible Caching for Web Applications, NSDI 2018",
            "Zipf, Human Behavior and the Principle of Least Effort, 1949",
        ],
        workedExample:
            "After a few requests to a, b, and c, object a has the highest count and rank one. A new object d with count one has a low rank and therefore a small expected rate, so its single request is likely rejected. A repeated request to b exceeds b's expected rate and is admitted.",
    },
    id: "hyperbolic-cache",
    name: "Hyperbolic Cache Admission",
    category: "production-systems",
    complexity: { time: "O(distinct log distinct)", space: "O(distinct)" },
    defaultInput: { trace: ["a", "a", "b", "c", "a", "d", "b", "a", "e", "b"], capacity: 3, exponent: 0.8 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the frequency table and empty cache slots",
        "for each requested object increment its count",
        "on a hit keep the object in the cache",
        "on a miss estimate the object rank and expected rate",
        "admit the object only when its count beats the expected rate",
        "if full evict the cached object with the smallest count",
        "record the hit or admission decision",
        "done: report hits, admissions, and the cached set",
    ],
};

export default module;
