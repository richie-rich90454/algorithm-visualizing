/**
 * power-analysis.ts - Statistical Power Analysis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Statistical power is the chance that a test rejects a false null hypothesis.
 * For a one-sample z test with effect size d and sample size n, the noncentrality
 * is d times the square root of n. Power is the normal probability of falling
 * beyond the critical value under that shifted distribution. The module draws
 * the whole power curve as the effect size grows.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * bisectionSteps) for the curve and critical value
 *   Space: O(points) for the displayed nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One node per effect size shows the power at that effect size.
 *   - Edges connect the nodes into a power curve.
 *   - The final frame highlights the requested effect size.
 */
import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const upper = (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
    return z >= 0 ? 1 - upper : upper;
}

function inverseNormal(p: number): number {
    let lo = 0;
    let hi = 10;
    for (let i = 0; i < 80; i += 1) {
        const mid = (lo + hi) / 2;
        if (normalCdf(mid) < p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

function powerAt(d: number, n: number, zCrit: number, tails: number): number {
    const delta = d * Math.sqrt(n);
    return tails === 1 ? normalCdf(delta - zCrit) : normalCdf(delta - zCrit) + normalCdf(-delta - zCrit);
}

function makeEntities(ds: number[], powers: number[], current: number, done: boolean): VisualEntity[] {
    return ds.map((d, i) => ({
        id: `point-${i}`,
        type: "node" as const,
        label: `d=${d.toFixed(2)}, power=${(powers[i] ?? 0).toFixed(2)}`,
        value: (powers[i] ?? 0),
        state: (done ? (i === current ? "path" : "sorted") : i === current ? "comparing" : "idle"),
        x: d,
        y: powers[i] ?? 0,
        width: 0,
        height: 0,
        metadata: { index: i, effect: d },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { effectSize?: number; n?: number; alpha?: number; tails?: number; points?: number } | null) ?? {};
    const effectSize = typeof task.effectSize === "number" ? task.effectSize : 0.5;
    const n = typeof task.n === "number" && task.n > 0 ? Math.floor(task.n) : 64;
    const alpha = typeof task.alpha === "number" && task.alpha > 0 && task.alpha < 1 ? task.alpha : 0.05;
    const tails = task.tails === 1 ? 1 : 2;
    const points = typeof task.points === "number" ? Math.max(3, Math.floor(task.points)) : 12;
    const zCrit = inverseNormal(1 - alpha / tails);
    const maxD = Math.max(1, effectSize * 1.5);
    const ds = Array.from({ length: points }, (_, i) => (maxD * i) / (points - 1));
    const powers = ds.map((d) => powerAt(d, n, zCrit, tails));
    const power = powerAt(effectSize, n, zCrit, tails);

    const edges: VisualEdge[] = Array.from({ length: points - 1 }, (_, i) => ({
        id: `edge-${i}`,
        sourceId: `point-${i}`,
        targetId: `point-${i + 1}`,
        label: "",
        state: "path" as const,
        directed: false,
    }));
    const base = { effectSize, n, alpha, tails, points, zCrit, power };

    yield {
        stepNumber: 0,
        entities: makeEntities(ds, powers.map(() => 0), -1, false),
        edges: [],
        description: `Building a power curve for a ${tails === 1 ? "one" : "two"}-sided z test at alpha ${alpha}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { ...base, ds, powers: [] },
    };
    for (let i = 0; i < points; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeEntities(ds, [...powers.slice(0, i + 1), ...powers.map(() => 0)].slice(0, points), i, false),
            edges: edges.slice(0, Math.max(0, i)),
            description: `Effect size ${ds[i]?.toFixed(3)} gives power ${(powers[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { ...base, ds, powers: powers.slice(0, i + 1) },
        };
    }
    const nearest = ds.reduce((best, d, i) => Math.abs(d - effectSize) < Math.abs(ds[best]! - effectSize) ? i : best, 0);
    yield {
        stepNumber: points + 1,
        entities: makeEntities(ds, powers, nearest, true),
        edges,
        description: `At effect size ${effectSize.toFixed(3)} with n = ${n}, power is ${power.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { ...base, ds, powers, nearest },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A test with low power can miss a real effect most of the time. Power is computed by asking how far the null distribution's critical value sits from the alternative distribution's center. Larger effects and larger samples push the two distributions apart and raise power toward one.",
        invariants: [
            "The critical value depends only on alpha and the number of tails.",
            "Power at effect size zero equals alpha, the false positive rate under the null.",
            "Power is nondecreasing in the effect size and the sample size.",
        ],
        correctness:
            "With noncentrality delta = d sqrt(n), the test statistic under the alternative is normal with mean delta and unit variance. For a two-sided test the rejection region is below minus zCrit or above zCrit, so power is the sum of the two normal tail probabilities at those cutoffs. At delta zero the two tails sum exactly to alpha, confirming the null rejection rate.",
        complexityRationale:
            "Each power value needs a constant number of normal evaluations; the critical value uses a fixed 80-step bisection. Drawing the curve therefore costs O(points), and storing the nodes and edges uses O(points) space.",
        uses: [
            "Choosing a sample size before running an experiment",
            "Comparing the sensitivity of competing study designs",
            "Evaluating whether a null result is informative",
        ],
        references: [
            "Cohen, Statistical Power Analysis for the Behavioral Sciences",
            "Casella and Berger, Statistical Inference, Section on power functions",
        ],
        workedExample:
            "For alpha = 0.05, a two-sided test has zCrit about 1.96. With d = 0.5 and n = 64, delta = 4, so power is Phi(4-1.96) plus a negligible lower tail, about 0.979. With d = 0, power equals 0.05.",
    },
    id: "power-analysis",
    name: "Statistical Power Analysis",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { effectSize: 0.5, n: 64, alpha: 0.05, tails: 2, points: 12 },
    visualType: "point",
    run,
    pseudocode: [
        "read effect size, sample size, alpha, and tails",
        "find the critical normal value from alpha",
        "set noncentrality to effect size times square root of n",
        "for each effect size on the curve evaluate the normal tails",
        "sum the tail probabilities to obtain power",
        "evaluate power at the requested effect size",
        "done: report the power curve and target power",
    ],
};

export default module;
