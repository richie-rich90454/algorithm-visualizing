/**
 * ziggurat-algorithm.ts - Ziggurat Normal Sampler
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The ziggurat method covers the bell curve with a stack of horizontal
 * rectangles whose widths shrink toward the tail. A layer is chosen at random
 * and a point is sampled uniformly inside its rectangle; most points fall
 * under the curve and are accepted immediately, while a rare boundary check
 * handles the rest. The single infinite tail layer uses an exponential
 * proposal with rejection. The result is a fast normal generator with almost
 * no transcendental calls per sample.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) expected, with a very high acceptance rate
 *   Space: O(samples + layers) for the emitted points and layer table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each accepted variate is plotted at its magnitude against sample index.
 *   - A point from the tail layer is highlighted differently.
 *   - The final frame reports the mean, variance, and layer acceptance rate.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Unnormalized standard normal density. */
function pdf(x: number): number {
    return Math.exp(-0.5 * x * x);
}

interface Layer {
    width: number;
    low: number;
    high: number;
    cdf: number;
}

/** Build the rectangle layers plus the infinite tail of the ziggurat. */
function buildLayers(count: number): { layers: Layer[]; tailStart: number; totalArea: number } {
    const tailStart = 3.5;
    const xs = new Array<number>(count + 1).fill(0);
    for (let i = 1; i <= count; i += 1) xs[i] = (tailStart * i) / count;
    const heights = xs.map(pdf);
    const layers: Layer[] = [];
    let cumulative = 0;
    // Bottom rectangle: width xs[count], height from zero to heights[count].
    cumulative += xs[count]! * heights[count]!;
    layers.push({ width: xs[count]!, low: 0, high: heights[count]!, cdf: cumulative });
    // Stacked rectangles, each spanning from zero to its right edge.
    for (let i = 1; i <= count; i += 1) {
        cumulative += xs[i]! * (heights[i - 1]! - heights[i]!);
        layers.push({ width: xs[i]!, low: heights[i]!, high: heights[i - 1]!, cdf: cumulative });
    }
    // Tail area beyond tailStart under the unnormalized density.
    let tailArea = 0;
    const steps = 10000;
    const h = 12 / steps;
    for (let i = 0; i < steps; i += 1) {
        const x = tailStart + (i + 0.5) * h;
        tailArea += pdf(x) * h;
    }
    const totalArea = cumulative + tailArea;
    return { layers, tailStart, totalArea };
}

function makeEntities(values: number[], tails: boolean[], current: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `sample-${index}`,
        type: "node" as const,
        label: tails[index] ? "T" : "S",
        value,
        state: index > current ? "unvisited" : tails[index] ? "highlight" : "sorted",
        x: index,
        y: value,
        width: 0,
        height: 0,
        metadata: { index, magnitude: value, tail: tails[index] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; samples?: number; layers?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 999;
    const samples = typeof task.samples === "number"
        ? Math.max(2, Math.min(20000, Math.floor(task.samples))) : 3000;
    const layerCount = typeof task.layers === "number"
        ? Math.max(8, Math.min(128, Math.floor(task.layers))) : 64;
    const rng = makeRng(seed);
    const { layers, tailStart, totalArea } = buildLayers(layerCount);
    const tailProbability = (pdf(tailStart) * 1) / totalArea;

    const values: number[] = [];
    const tails: boolean[] = [];
    let proposals = 0;
    while (values.length < samples && proposals < samples * 1000) {
        proposals += 1;
        const pick = rng() * totalArea;
        const isTail = pick > layers[layers.length - 1]!.cdf;
        let magnitude = 0;
        let accepted = false;
        if (isTail) {
            const x = tailStart - Math.log(Math.max(1e-12, rng()));
            const y = rng() * pdf(tailStart);
            if (y <= pdf(x)) {
                magnitude = x;
                accepted = true;
            }
        } else {
            const layer = layers.find((l) => pick <= l.cdf) ?? layers[0]!;
            const x = rng() * layer.width;
            const y = layer.low + rng() * (layer.high - layer.low);
            if (y <= pdf(x)) {
                magnitude = x;
                accepted = true;
            }
        }
        if (!accepted) continue;
        const sign = rng() < 0.5 ? -1 : 1;
        values.push(sign * magnitude);
        tails.push(isTail);
    }

    const count = values.length;
    const mean = count > 0 ? values.reduce((a, b) => a + b, 0) / count : 0;
    const variance = count > 0 ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / count : 0;
    const acceptance = count / proposals;

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Building a ${layerCount}-layer ziggurat and drawing ${samples} normals with seed ${seed}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seed, samples, layerCount, values: [], mean: 0, variance: 0, acceptance: 0, complete: false },
    };
    let step = 1;
    const stride = Math.max(1, Math.floor(count / 40));
    const shown: number[] = [];
    const shownTails: boolean[] = [];
    for (let i = 0; i < count; i += 1) {
        shown.push(values[i]!);
        shownTails.push(tails[i]!);
        if (i % stride === stride - 1 || i === count - 1) {
            yield {
                stepNumber: step,
                entities: makeEntities(shown.slice(), shownTails.slice(), i),
                edges: [],
                description: `Sample ${i + 1}: ${values[i]!.toFixed(4)}${tails[i] ? " from the tail layer" : ""}.`,
                codeLineNumber: 3,
                layout: "point",
                meta: {
                    seed, samples, layerCount, values: shown.slice(),
                    mean: 0, variance: 0, acceptance: 0, complete: false,
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(values, tails, count - 1),
        edges: [],
        description: `Generated ${count} variates from ${proposals} proposals: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            seed, samples, layerCount, proposals, count, values, mean, variance,
            acceptance, tailProbability, complete: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Stack rectangles of decreasing width under the bell curve so that almost every random point inside a rectangle is also under the curve. Pick a rectangle, throw a point in it, and accept when the point sits below the density. Only points near a rectangle's right edge need an extra check, and a final infinite rectangle handles the tail with an exponential proposal.",
        invariants: [
            "Every accepted point has magnitude at least zero.",
            "A point is accepted only when its height is below the unnormalized normal density.",
            "The sign is chosen uniformly, making the output symmetric about zero.",
        ],
        correctness:
            "The rectangles and the tail partition the area under the unnormalized normal density. Choosing a subregion with probability proportional to its area and a point uniformly within it, then accepting only under the curve, is rejection sampling over the whole curve. The accepted magnitude therefore has half-normal density, and attaching an independent fair sign yields a standard normal. The exponential proposal for the tail dominates the decaying density there, so its rejection step is also exact.",
        complexityRationale:
            "Building the table costs O(layers) work, and each sample needs only a few uniform draws and at most one exponential, so generation is O(samples) expected time with a high acceptance rate. Space is O(samples plus layers).",
        uses: [
            "Fast Gaussian noise in large Monte Carlo simulations",
            "Random initialization in graphics and machine learning",
            "A canonical example of rejection sampling with precomputed geometry",
        ],
        references: [
            "Marsaglia and Tsang, The Ziggurat Method for Generating Random Variables, 2000",
            "Knuth, The Art of Computer Programming, Volume 2, Section 3.4.1",
        ],
        workedExample:
            "With a bottom rectangle extending to about 3.5 and height exp(-3.5 squared / 2), a point at x = 1 has density exp(-0.5), about 0.607, far above the rectangle tops of the upper layers, so it is accepted immediately. A point near x = 3.4 in a narrow top layer may fail the height test and be redrawn, which is rare.",
    },
    id: "ziggurat-algorithm",
    name: "Ziggurat Normal Sampler",
    category: "statistics-probability",
    complexity: { time: "O(samples) expected", space: "O(samples + layers)" },
    defaultInput: { seed: 999, samples: 3000, layers: 64 },
    visualType: "point",
    run,
    pseudocode: [
        "build stacked rectangles under the half normal curve",
        "record each rectangle's cumulative area and the tail start",
        "for each sample pick a subregion by its area",
        "if the tail was picked propose with an exponential and accept under the curve",
        "otherwise sample a point in the rectangle and accept if it is under the curve",
        "attach a fair random sign to the accepted magnitude",
        "done: report the count, mean, and variance",
    ],
};

export default module;
