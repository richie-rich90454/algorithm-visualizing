/**
 * continuous-time-quantum-walk.ts - Continuous-Time Quantum Walk on a Path
 *
 * Exact small simulation: a particle on N linearly arranged sites evolves under
 * the adjacency-matrix Hamiltonian with U(t) = exp(-i A t). For a path graph the
 * eigenpairs are known in closed form, so the amplitudes are computed exactly by
 * a sine transform. This is an ideal coherent model; it does not include coin
 * registers, decoherence, measurement back-action, or hardware noise, and is
 * limited here to odd path sizes 3 through 9.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface WalkInput {
    sites?: number;
    time?: number;
    steps?: number;
    start?: number;
}

function cAdd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

/** Exact amplitudes of exp(-i A t) applied to the site basis vector |start>. */
function evolve(sites: number, start: number, t: number): Complex[] {
    const out: Complex[] = Array.from({ length: sites }, () => [0, 0] as Complex);
    for (let k = 1; k <= sites; k += 1) {
        const lambda = 2 * Math.cos((Math.PI * k) / (sites + 1));
        const scale = Math.sqrt(2 / (sites + 1));
        const fromStart = scale * Math.sin((Math.PI * k * (start + 1)) / (sites + 1));
        const cosine = Math.cos(-lambda * t);
        const sine = Math.sin(-lambda * t);
        for (let j = 0; j < sites; j += 1) {
            const atSite = scale * Math.sin((Math.PI * k * (j + 1)) / (sites + 1));
            const coefficient = fromStart * atSite;
            out[j] = cAdd(out[j]!, [coefficient * cosine, coefficient * sine]);
        }
    }
    return out;
}

function probabilities(amps: Complex[]): number[] {
    return amps.map((z) => z[0] * z[0] + z[1] * z[1]);
}

function makeBars(amps: Complex[], highlight: number, final: boolean): VisualEntity[] {
    const probs = probabilities(amps);
    return amps.map((z, index) => ({
        id: `site-${index}`,
        type: "bar" as const,
        label: `site ${index}: ${probs[index]!.toFixed(4)}`,
        value: probs[index]!,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: probs[index]!, re: z[0], im: z[1] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WalkInput | null) ?? {};
    let sites = typeof task.sites === "number" ? Math.round(task.sites) : 7;
    sites = Math.max(3, Math.min(9, sites));
    if (sites % 2 === 0) sites += 1;
    const time = typeof task.time === "number" && Number.isFinite(task.time)
        ? Math.max(0, Math.min(6, task.time))
        : 0.9;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.min(8, Math.floor(task.steps))) : 4;
    const start = Math.max(0, Math.min(sites - 1, typeof task.start === "number" ? Math.floor(task.start) : (sites - 1) / 2 | 0));
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (amps: Complex[], t: number, done: boolean) => {
        const probs = probabilities(amps);
        const norm = probs.reduce((sum, p) => sum + p, 0);
        let variance = 0;
        for (let j = 0; j < sites; j += 1) variance += probs[j]! * (j - start) ** 2;
        return {
            sites,
            steps,
            start,
            time: t,
            totalTime: time,
            amplitudes: flat(amps),
            probabilities: probs,
            norm,
            spread: Math.sqrt(Math.max(0, variance)),
            done,
        };
    };

    let state = evolve(sites, start, 0);
    yield {
        stepNumber: 0,
        entities: makeBars(state, start, false),
        edges: [],
        description: `Start the walk at site ${start} of a ${sites}-site path with zero Hamiltonian evolution time.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(state, 0, false),
    };

    for (let i = 1; i <= steps; i += 1) {
        const t = (time * i) / steps;
        state = evolve(sites, start, t);
        const probs = probabilities(state);
        const peak = probs.indexOf(Math.max(...probs));
        yield {
            stepNumber: i,
            entities: makeBars(state, peak, false),
            edges: [],
            description: `Evolve under exp(-iAt) to time ${t.toFixed(3)}; the sine eigenbasis keeps the amplitudes exact.`,
            codeLineNumber: i === steps ? 4 : 3,
            layout: "array",
            meta: { ...metaFor(state, t, false), peak },
        };
    }

    yield {
        stepNumber: steps + 1,
        entities: makeBars(state, -1, true),
        edges: [],
        description: `Final time ${time.toFixed(3)}: total probability is ${metaFor(state, time, true).norm.toFixed(10)} with spread ${metaFor(state, time, true).spread.toFixed(4)} sites.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(state, time, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A discrete walk flips a coin at every site and then steps left or right. A continuous-time walk has no coin: the adjacency matrix itself is the Hamiltonian, so amplitude flows into neighboring sites continuously and coherently. Interference between the many paths makes the distribution oscillate and spread, which is why it differs from a classical diffusion process.",
        invariants: [
            "The sum of squared amplitudes stays one because exp(-iAt) is unitary for the real symmetric adjacency matrix.",
            "The path eigenvectors are sine functions with eigenvalues 2 cos(pi k /(N+1)), so the sine transform is exact.",
            "Starting at the center, the distribution stays symmetric about the center for every time.",
        ],
        correctness:
            "The path adjacency matrix is real symmetric, hence diagonalized by the orthonormal Fourier-sine basis phi_k(j) = sqrt(2/(N+1)) sin(pi k j/(N+1)) with eigenvalue 2 cos(pi k/(N+1)). Therefore exp(-iAt) applied to |s> has amplitude sum_k phi_k(j) phi_k(s) exp(-i lambda_k t), which is exactly what the simulation computes. Completeness of the sine basis gives the identity at t = 0, and unitarity of each phase factor gives norm preservation for all t.",
        complexityRationale:
            "For each time snapshot the code loops over N eigenmodes and N sites, costing O(N^2) arithmetic, with a handful of snapshots. Memory holds O(N) amplitudes. The exact sine spectrum is special to a path; a general graph needs a numerical diagonalization, but the same formula applies once the eigenpairs are known.",
        uses: [
            "Continuous-time quantum walk search on graphs and hypercubes",
            "Models of coherent transport in engineered lattice systems",
            "Quantum simulation of tight-binding Hamiltonians in condensed matter",
        ],
        references: [
            "Farhi and Gutmann, Quantum Computation by Adiabatic Evolution, 1998",
            "Aharonov, Ambainis, Kempe, and Vazirani, Quantum Walks on Graphs, 2001",
        ],
        workedExample:
            "On three sites with the walk starting at the center, the eigenvalues are sqrt(2), 0, and minus sqrt(2). At time t the center amplitude is (1 + cos(sqrt(2) t))/3 and each end amplitude is minus i sin(sqrt(2) t)/sqrt(18) plus a real contribution, showing probability flowing out and back with no coin.",
    },
    id: "continuous-time-quantum-walk",
    name: "Continuous-Time Quantum Walk",
    category: "quantum",
    complexity: { time: "O(N^2) per snapshot", space: "O(N)" },
    defaultInput: { sites: 7, time: 0.9, steps: 4, start: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the path length N, start site, final time, and snapshot count",
        "for each mode k compute eigenvalue 2 cos(pi k /(N+1))",
        "for each site j sum phi_k(j) phi_k(start) exp(-i lambda_k t)",
        "accumulate the complex amplitude at j over all modes",
        "advance time by final time divided by the snapshot count",
        "record the probability distribution at each snapshot",
        "done: report the final distribution, norm, and spread",
    ],
};

export default module;
