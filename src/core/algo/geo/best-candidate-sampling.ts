/**
 * best-candidate-sampling.ts - Mitchell's best-candidate blue-noise sampling.
 *
 * For every new sample the algorithm generates k random candidates in the
 * domain and keeps the one whose nearest previously placed sample is farthest.
 * This produces a well-spaced point set with far less work than a full Poisson
 * disk construction. A fixed LCG keeps every frame reproducible.
 *
 * Time: O(n * k * n) for n samples and k candidates. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function nearestDistance(p: Pt, placed: Pt[]): number {
    let best = Infinity;
    for (const q of placed) {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < best) best = d;
    }
    return placed.length === 0 ? 0 : best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        width?: number;
        height?: number;
        count?: number;
        candidates?: number;
        seed?: number;
    } | null) ?? {};
    const width = typeof task.width === "number" && task.width > 0 ? task.width : 10;
    const height = typeof task.height === "number" && task.height > 0 ? task.height : 10;
    const count = typeof task.count === "number" ? Math.max(1, Math.floor(task.count)) : 20;
    const k = typeof task.candidates === "number" ? Math.max(1, Math.floor(task.candidates)) : 10;
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 1;
    const rand = lcg(seed);

    const placed: Pt[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Placing ${count} blue-noise samples with ${k} candidates each.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { count: 0, samples: [] },
    };
    step += 1;

    placed.push([rand() * width, rand() * height]);
    yield {
        stepNumber: step,
        entities: [node("p-0", placed[0] as Pt, "sorted", "0")],
        edges: [],
        description: "Seeded the first sample uniformly at random.",
        codeLineNumber: 1,
        layout: "point",
        meta: { count: 1, samples: [placed[0][0], placed[0][1]] },
    };
    step += 1;

    for (let i = 1; i < count; i += 1) {
        const candidates: Pt[] = [];
        let best: Pt = [0, 0];
        let bestDistance = -1;
        let bestIndex = 0;
        for (let c = 0; c < k; c += 1) {
            const candidate: Pt = [rand() * width, rand() * height];
            candidates.push(candidate);
            const d = nearestDistance(candidate, placed);
            if (d > bestDistance) {
                bestDistance = d;
                best = candidate;
                bestIndex = c;
            }
        }
        placed.push(best);
        const entities: VisualEntity[] = placed.map((p, index) =>
            node(`p-${index}`, p, index === i ? "active" : "sorted", String(index)),
        );
        candidates.forEach((p, index) => {
            entities.push(
                node(
                    `cand-${i}-${index}`,
                    p,
                    index === bestIndex ? "highlight" : "unvisited",
                    "",
                ),
            );
        });
        yield {
            stepNumber: step,
            entities,
            edges: [],
            description: `Sample ${i}: picked candidate ${bestIndex} with nearest-neighbor spacing ${bestDistance.toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                count: placed.length,
                bestCandidate: bestIndex,
                bestDistance,
                samples: placed.flatMap((p) => [p[0], p[1]]),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: placed.map((p, index) => node(`p-${index}`, p, "sorted", String(index))),
        edges: [],
        description: `Done: ${count} samples placed by Mitchell's best-candidate rule.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            count: placed.length,
            samples: placed.flatMap((p) => [p[0], p[1]]),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To add a new point, throw down a handful of random candidates and keep the one farthest from everything already placed. A few tries per point give a distribution close to a blue-noise Poisson disk pattern without needing a spatial grid or an active list.",
        invariants: [
            "Every placed sample lies inside the domain rectangle.",
            "Each new sample is one of the k candidates generated for that step.",
            "The chosen candidate maximizes the distance to the nearest already placed sample.",
        ],
        correctness:
            "The nearest-neighbor distance of a candidate is exactly the radius of the largest empty circle around it that is still free of placed samples. Choosing the candidate with the largest such radius greedily keeps new samples as far as possible from previous ones, so after each step no rejected candidate would have improved the spacing. The construction never moves or removes a placed sample, so spacing only ever changes by adding a point whose nearest neighbor is the best available among the sampled candidates.",
        complexityRationale:
            "Each of the n samples generates k candidates, and scoring a candidate scans all i previously placed points, giving O(k * n^2) distance evaluations overall. Only the point list and the current candidate batch are retained, so space is O(n).",
        uses: [
            "Stippling and hatching for non-photorealistic rendering",
            "Placing sample locations for Monte Carlo integration",
            "Generating evenly spaced seeds for texture synthesis",
        ],
        references: [
            "Mitchell, Generating Antialiased Images at Low Sampling Densities, SIGGRAPH 1987",
            "Cook, Sampling and Reconstruction with Spatial Statistics, SIGGRAPH 1986",
        ],
        workedExample:
            "On a 10 by 10 domain with seed 1, the first point is placed at random. For the second point, ten candidates are drawn and the one farthest from that first point wins. Repeating this twenty times yields twenty points that visibly avoid clustering.",
    },
    id: "best-candidate-sampling",
    name: "Best Candidate Sampling",
    category: "geometry",
    complexity: { time: "O(k * n^2)", space: "O(n)" },
    defaultInput: { width: 10, height: 10, count: 20, candidates: 10, seed: 1 },
    visualType: "point",
    run,
    pseudocode: [
        "place the first sample uniformly at random",
        "for each remaining sample",
        "generate k random candidates in the domain",
        "measure each candidate's distance to its nearest placed sample",
        "accept the candidate with the greatest such distance",
        "repeat until the requested count is reached",
        "done: return the evenly spaced sample set",
    ],
};

export default module;
