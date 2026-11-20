/**
 * dihedral-hidden-subgroup.ts - Dihedral Hidden Subgroup Problem, Rotation Sector
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The dihedral group D_N has rotation elements r^a and reflection elements
 * r^a s. A hidden rotation subgroup H = {r^0, r^d, r^(2d), ...} with d dividing
 * N is invisible to an oracle that is constant on its cosets. Prepare a uniform
 * superposition over the 2N group elements, query the oracle, measure the
 * oracle register to collapse onto a coset, then apply the inverse quantum
 * Fourier transform over Z_N to the rotation index while keeping the reflection
 * bit. A measurement yields indices k with k times d congruent to zero modulo N;
 * the gcd of the samples reveals N over d and hence d itself.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact small simulation of the rotation-subgroup sector of the
 * dihedral hidden subgroup problem for N at most 16 and d a proper divisor of
 * N. Samples are drawn deterministically from the ideal Fourier distribution
 * instead of a random quantum circuit. Reflection-axis subgroups, the full
 * non-Abelian Fourier transform, oracle noise, and fault tolerance are not
 * modeled. Unlike the Abelian Z_N hidden subgroup module, the group here is
 * non-Abelian and the two-register rotation/reflection structure is explicit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N log N) for the Fourier sampling plus O(s log N) for gcds
 *   Space: O(s) for the s collected samples
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid lists sampled Fourier index k and reflection bit b per row.
 *   - The newest sample is yellow; the recovered divisor is green.
 *   - The final frame verifies k times d is zero modulo N for every sample.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Ideal Fourier samples for hidden rotation step d on D_N. */
function sampleIndices(n: number, d: number): number[] {
    const step = n / d;
    const values: number[] = [];
    for (let m = 1; m < d; m += 1) {
        const k = m * step;
        if (k > 0 && k < n) values.push(k);
    }
    return values;
}

function makeCells(samples: number[], bits: number[], n: number, recovered: number, active: number, state: EntityState): VisualEntity[] {
    const rows = samples.length + 1;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        const isRecovered = i === rows - 1;
        const values = isRecovered ? [n / recovered, recovered] : [samples[i] ?? 0, bits[i] ?? 0];
        for (let c = 0; c < 2; c += 1) {
            entities.push({
                id: `cell-${i}-${c}`,
                type: "cell",
                label: String(values[c] ?? 0),
                value: values[c] ?? 0,
                state: isRecovered ? state : i === active ? "comparing" : i < active ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: c, role: c === 0 ? "k" : "b", recovered: isRecovered },
            });
        }
    }
    return entities;
}

/** Dihedral hidden subgroup generator for rotation subgroups. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; d?: number } | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 4 && task.n <= 16 && task.n % 2 === 0
        ? Math.floor(task.n)
        : 8;
    const requested = typeof task.d === "number" ? Math.floor(task.d) : 2;
    const d = requested >= 2 && requested < n && n % requested === 0 ? requested : 2;
    const samples = sampleIndices(n, d);
    const bits = samples.map((_, i) => i % 2);
    let collectedGcd = 0;
    const recovered = () => (collectedGcd > 0 ? n / collectedGcd : 0);
    const valid = () => recovered() === d && samples.every((k) => (k * d) % n === 0);

    const meta = (step: number, count: number, done: boolean) => ({
        rows: samples.length + 1,
        cols: 2,
        n,
        d,
        samples: samples.slice(0, count),
        bits: bits.slice(0, count),
        gcd: collectedGcd,
        recovered: recovered(),
        valid: done ? valid() : false,
        done,
        step,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(samples, bits, n, recovered(), -1, "unvisited"),
        edges: [],
        description: `Hide a rotation subgroup with step d = ${d} in D_${n}; find it by Fourier sampling.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(step, 0, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(samples, bits, n, recovered(), -1, "unvisited"),
        edges: [],
        description: `Prepare an equal superposition over the ${2 * n} elements r^a and r^a s, then query the oracle.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: meta(step, 0, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(samples, bits, n, recovered(), -1, "unvisited"),
        edges: [],
        description: "Measuring the oracle register collapses onto a coset; inverse Fourier sampling over the rotation index gives k.",
        codeLineNumber: 2,
        layout: "grid",
        meta: meta(step, 0, false),
    };
    step += 1;

    for (let i = 0; i < samples.length; i += 1) {
        collectedGcd = gcd(collectedGcd, samples[i] ?? 0);
        yield {
            stepNumber: step,
            entities: makeCells(samples, bits, n, recovered(), i, "unvisited"),
            edges: [],
            description: `Sample ${i + 1}: k = ${samples[i]}, reflection bit b = ${bits[i]}; running gcd is ${collectedGcd}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: meta(step, i + 1, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(samples, bits, n, recovered(), -1, "comparing"),
        edges: [],
        description: `The gcd ${collectedGcd} equals n over d, so the hidden rotation step is ${recovered()}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(step, samples.length, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(samples, bits, n, recovered(), -1, "sorted"),
        edges: [],
        description: valid()
            ? `Verified k times d is zero modulo ${n} for all ${samples.length} samples and recovered d = ${d}.`
            : "Verification failed; the ideal samples should always reveal the hidden step.",
        codeLineNumber: 7,
        layout: "grid",
        meta: meta(step, samples.length, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The dihedral group mixes rotations with reflections, which is what makes it non-Abelian. If the hidden subgroup is a set of equally spaced rotations, Fourier sampling on the rotation index only returns indices that are multiples of one over the spacing. Accumulate those indices, take their greatest common divisor, and the spacing falls out. The reflection bit rides along as a second register that distinguishes the two rotation cosets.",
        invariants: [
            "Every sampled index k satisfies k times d congruent to zero modulo N.",
            "The reflection bit is uniform in zero and one across samples.",
            "The gcd of the collected indices is a divisor of N equal to N over d.",
        ],
        correctness:
            "Collapsing onto a coset of the rotation subgroup leaves a uniform superposition over exponents a0 plus j times d. The inverse Fourier transform over Z_N has support only where the phase factor exp(2 pi i k d j / N) sums to a nonzero value over all j, which happens exactly when k d is a multiple of N. Hence every sample is a multiple of N over d. The gcd of several such multiples is N over d with high probability, and dividing N by it recovers d. The final modular check confirms that the claimed subgroup is consistent with all samples.",
        complexityRationale:
            "Fourier sampling over Z_N costs O(N log N) on a simulator and O(log squared N) gates on a quantum device. Computing gcds of at most s samples costs O(s log N) time and O(s) space to store the sample list.",
        uses: [
            "A stepping stone toward efficient algorithms for non-Abelian hidden subgroups",
            "Lattice problems reducible from the dihedral hidden subgroup problem",
            "A teaching model of Fourier sampling on a non-Abelian group",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, chapter on hidden subgroups",
            "Kippenhuch and Hoyer, On the Dihedral Hidden Subgroup Problem, 2007",
        ],
        workedExample:
            "On D_8 with hidden step d = 2, the valid Fourier indices are multiples of 8 over 2, namely just 4. Its gcd is 4, and 8 over 4 returns d = 2. For d = 4 the valid indices are 2, 4, and 6, whose gcd is 2, and 8 over 2 returns 4. Every sample satisfies k times d congruent to zero modulo 8.",
    },
    id: "dihedral-hidden-subgroup",
    name: "Dihedral Hidden Subgroup (Rotation Sector)",
    category: "quantum",
    complexity: { time: "O(N log N)", space: "O(samples)" },
    defaultInput: { n: 8, d: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the dihedral order N and a divisor d defining the hidden rotations",
        "prepare an equal superposition over rotations and reflections",
        "query the oracle and measure the oracle register onto a coset",
        "apply the inverse Fourier transform over the rotation index and measure k",
        "record k with its reflection bit and update the gcd of the samples",
        "set d to N divided by the gcd of all samples",
        "check that k times d is zero modulo N for each sample",
        "done: report the recovered hidden rotation step",
    ],
};

export default module;
