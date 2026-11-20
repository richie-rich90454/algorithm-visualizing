/**
 * power-of-two-choices.ts - Power of Two Choices Load Balancing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each incoming ball (request) probes two bins chosen uniformly at random and
 * is placed into the less loaded of the two. Compared with a single random
 * choice, this tiny bit of feedback dramatically lowers the maximum load: with
 * n balls and n bins the heaviest bin stays near log(log(n)) instead of log(n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(balls) - two random probes and a comparison per ball
 *   Space: O(bins) for the per-bin load counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per bin; the bar height is the number of balls assigned.
 *   - The two probed bins turn yellow, the chosen bin turns green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic linear congruential generator so a seed reproduces a run. */
export function lcgStep(seed: number): number {
    return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

/** Build one bar per bin with the current load. */
function makeBars(
    loads: number[],
    probes: [number, number] | null,
    chosen: number,
): VisualEntity[] {
    return loads.map((load, index) => {
        let state: EntityState = "idle";
        if (probes && (probes[0] === index || probes[1] === index)) {
            state = "comparing";
        }
        if (chosen === index) {
            state = "sorted";
        }
        return {
            id: `bin-${index}`,
            type: "bar" as const,
            label: `bin ${index}: ${load}`,
            value: load,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { bin: index, load, probed: probes ? (probes[0] === index || probes[1] === index) : false },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { balls?: number; bins?: number; seed?: number } | null) ?? {};
    const balls = typeof task.balls === "number" ? Math.max(0, Math.floor(task.balls)) : 12;
    const bins = typeof task.bins === "number" ? Math.max(1, Math.floor(task.bins)) : 4;
    let seed = (typeof task.seed === "number" ? Math.trunc(task.seed) : 12345) >>> 0;

    const loads = new Array<number>(bins).fill(0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(loads, null, -1),
        edges: [],
        description: `Starting with ${bins} empty bin(s) and ${balls} ball(s) to place.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { balls, bins, placed: 0, loads: [...loads], maxLoad: 0 },
    };
    step += 1;

    for (let ball = 0; ball < balls; ball += 1) {
        seed = lcgStep(seed);
        const first = seed % bins;
        seed = lcgStep(seed);
        const second = seed % bins;
        const chosen = loads[first]! <= loads[second]! ? first : second;
        loads[chosen] = loads[chosen]! + 1;
        const maxLoad = Math.max(...loads);

        yield {
            stepNumber: step,
            entities: makeBars(loads, [first, second], chosen),
            edges: [],
            description: `Ball ${ball + 1}: probed bins ${first} and ${second}, placed in bin ${chosen} (load ${loads[chosen]}).`,
            codeLineNumber: first === second ? 1 : 3,
            layout: "array",
            meta: {
                balls,
                bins,
                placed: ball + 1,
                probes: [first, second],
                chosen,
                loads: [...loads],
                maxLoad,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(loads, null, -1),
        edges: [],
        description: `Placed ${balls} ball(s); final loads ${loads.join(", ")} with maximum ${Math.max(0, ...loads)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { balls, bins, placed: balls, loads: [...loads], maxLoad: Math.max(0, ...loads) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of throwing each request at a single random server, ask two servers how busy they are and use the less busy one. That one extra probe is cheap, but it stops most bins from running far ahead of the others. The result is a much flatter load distribution with almost no coordination.",
        invariants: [
            "Every ball is placed into one of the two bins it probed.",
            "When the two probed loads differ, the chosen bin is the smaller one.",
            "Ties are broken toward the lower bin index, so the run is deterministic.",
        ],
        correctness:
            "At each placement the algorithm reads the two probe loads and picks a minimum, which is exactly the greedy choice for that pair of bins. Because the random probes come from a seeded generator, replaying the same seed yields the identical placement sequence, so the visualization faithfully reproduces the algorithm rather than approximating it.",
        complexityRationale:
            "Each of the b balls performs two random probes, one comparison, and one increment, all constant time, giving O(b) total. Only the bin load counters and the generator state are stored, which is O(n) space.",
        uses: [
            "Distributing requests across a pool of web servers",
            "Placing shards or virtual machines onto hosts",
            "Choosing the shorter of two candidate queues (the power of two choices heuristic)",
        ],
        references: [
            "Mitzenmacher, The Power of Two Choices in Randomized Load Balancing, 1996",
            "Berenbrink, Czumaj, Steger, and Vocking, Balanced Allocations, 2006",
        ],
        workedExample:
            "With four bins and seed 12345 the first probes might be bins 3 and 0, both empty, so the tie goes to bin 0, which reaches load one. The next probes compare that load with an empty bin and choose the empty one. Over twelve balls the loads stay within a small band instead of piling onto a single bin.",
    },
    id: "power-of-two-choices",
    name: "Power of Two Choices Load Balancing",
    category: "production-systems",
    complexity: { time: "O(b)", space: "O(n)" },
    defaultInput: { balls: 12, bins: 4, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize n empty bins with load zero",
        "for each incoming ball",
        "pick two bin indices uniformly at random",
        "if the two indices are the same, use that bin",
        "otherwise choose the bin with the smaller load (ties to lower index)",
        "increment the chosen bin's load",
        "done: report the final loads and the maximum load",
    ],
};

export default module;
