/**
 * poisson-process.ts - Poisson Process via Exponential Interarrival Times
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A homogeneous Poisson process with rate lambda counts events that arrive
 * independently at a constant average rate. The gaps between consecutive
 * arrivals are independent exponential random variables with mean 1/lambda,
 * generated here by inverse transform sampling from a seeded generator. The
 * count N(t) is then the number of arrival times at or before t.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k + q) for k arrivals and q observation times
 *   Space: O(k) for the arrival times
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation time shows the running event count N(t).
 *   - Bars are highlighted as each arrival or observation is processed.
 *   - meta carries the exact arrival times and counts for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit pseudo random generator (mulberry32). */
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

function countEntities(times: number[], counts: number[], current: number): VisualEntity[] {
    return times.map((t, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `t=${t.toFixed(1)}:N=${counts[index] ?? 0}`,
        value: counts[index] ?? 0,
        state: (index === current ? "comparing" : index < current ? "visited" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, time: t, count: counts[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        lambda?: number;
        horizon?: number;
        seed?: number;
        observationTimes?: number[];
    } | null) ?? {};
    const lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 1;
    const horizon = typeof task.horizon === "number" && task.horizon > 0 ? task.horizon : 10;
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed) ? task.seed : 7;
    const times = Array.isArray(task.observationTimes) && task.observationTimes.length > 0
        ? task.observationTimes.map((t) => Number(t)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b)
        : [1, 2, 3, 5, 7, 10].filter((t) => t <= horizon);
    const observations = times.length > 0 ? times : [horizon];

    const rng = makeRng(seed);
    const arrivals: number[] = [];
    let clock = 0;
    const cap = 10000;
    while (clock <= horizon && arrivals.length < cap) {
        const u = Math.max(rng(), Number.MIN_VALUE);
        const gap = -Math.log(u) / lambda;
        clock += gap;
        if (clock <= horizon) {
            arrivals.push(clock);
        }
    }

    // Both lists are sorted, so a single merge pass counts every observation.
    const counts: number[] = [];
    let cursor = 0;
    for (const t of observations) {
        while (cursor < arrivals.length && (arrivals[cursor] as number) <= t) {
            cursor += 1;
        }
        counts.push(cursor);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: countEntities(observations, observations.map(() => 0), -1),
        edges: [],
        description: `Poisson process with rate ${lambda} on [0, ${horizon}]; generating exponential gaps from seed ${seed}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, horizon, seed, phase: "setup", arrivalCount: arrivals.length },
    };
    step += 1;

    for (let i = 0; i < arrivals.length; i += 1) {
        yield {
            stepNumber: step,
            entities: countEntities(observations, observations.map(() => 0), -1),
            edges: [],
            description: `Arrival ${i + 1} at time ${(arrivals[i] as number).toFixed(3)}; the next gap is exponential with mean ${(1 / lambda).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { lambda, horizon, seed, phase: "arrival", arrivalIndex: i, arrivalTime: arrivals[i], arrivalCount: arrivals.length },
        };
        step += 1;
    }

    for (let i = 0; i < observations.length; i += 1) {
        yield {
            stepNumber: step,
            entities: countEntities(observations, counts, i),
            edges: [],
            description: `At time ${(observations[i] as number).toFixed(2)} the count is N(t) = ${counts[i]}, the number of arrivals at or before t.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                lambda,
                horizon,
                seed,
                phase: "observe",
                observationTimes: observations,
                counts,
                arrivalTimes: arrivals,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: countEntities(observations, counts, -1),
        edges: [],
        description: `Generated ${arrivals.length} arrivals on [0, ${horizon}]; N(${horizon}) = ${counts[counts.length - 1] ?? 0}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            lambda,
            horizon,
            seed,
            phase: "done",
            arrivalTimes: arrivals,
            arrivalCount: arrivals.length,
            observationTimes: observations,
            counts,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Poisson process is a stream of arrivals that occur independently at a steady average rate. Instead of picking arrival instants directly, generate the waiting time between arrivals: an exponential gap with mean one over the rate. Adding these gaps produces the arrival times, and counting how many landed before a given time gives N(t). The same seeded generator makes the whole replay deterministic.",
        invariants: [
            "Every exponential gap is positive because the uniform draw lies in (0, 1].",
            "Arrival times are strictly increasing and never exceed the horizon.",
            "N(t) is nondecreasing in t and equals the number of arrival times at or before t.",
        ],
        correctness:
            "If U is uniform on (0, 1], then -ln(U)/lambda has an exponential distribution with rate lambda, because the probability it exceeds x equals the probability U is below exp(-lambda x), which is exp(-lambda x). Independent exponential gaps are exactly the interarrival law of a homogeneous Poisson process, so the cumulative sums are its arrival epochs. Counting arrivals at or before t therefore returns N(t) with the correct Poisson distribution for each t.",
        complexityRationale:
            "Each exponential gap needs one uniform draw and one logarithm, so generating k arrivals takes O(k). Counting each of q observation times by scanning arrivals is O(kq) in the direct implementation shown, and storing only the arrival list uses O(k) space.",
        uses: [
            "Modeling call center arrivals and network packet traffic",
            "Poisson noise in photon counting and imaging",
            "A building block for queueing and reliability models",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 5 (Poisson processes)",
            "Devroye, Non-Uniform Random Variate Generation, 1986 (inverse transform)",
        ],
        workedExample:
            "With rate lambda = 1, horizon 10, and seed 7, uniform draws are transformed by gap = -ln(U). Suppose the first gaps are 0.36, 1.14, 0.52, giving arrivals near 0.36, 1.50, and 2.02. Then N(1) = 1, N(2) = 2, and N(5) includes every arrival that fell below 5.",
    },
    id: "poisson-process",
    name: "Poisson Process Simulation",
    category: "statistics-probability",
    complexity: { time: "O(k + q)", space: "O(k)" },
    defaultInput: { lambda: 1, horizon: 10, seed: 7, observationTimes: [1, 2, 3, 5, 7, 10] },
    visualType: "array",
    run,
    pseudocode: [
        "set the clock to zero and the arrival list to empty",
        "while the clock is below the horizon draw uniform U and add the exponential gap minus ln(U) over lambda to the clock",
        "record an arrival whenever the clock stays within the horizon",
        "for each observation time count arrivals at or before it to get N(t)",
        "report the arrival list and the event counts",
    ],
};

export default module;
