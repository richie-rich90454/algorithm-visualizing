/**
 * farhi-gutmann-search.ts - Farhi-Gutmann Continuous-Time Quantum Walk Search
 *
 * Implements the continuous-time quantum walk search on a complete graph. The
 * Hamiltonian H = -gamma A - |w><w| evolves the uniform superposition, and the
 * probability of measuring the marked vertex w is tracked over time. By
 * symmetry the evolution stays in the two-dimensional span of the marked state
 * and the uniform state over unmarked vertices, so it is computed exactly with
 * a closed-form two-level evolution.
 *
 * This is an idealized coherent simulation on complete graphs up to 64
 * vertices. It does not include decoherence, measurement back-action,
 * hardware noise, or graphs other than the complete graph.
 *
 * Time:  O(times) for the reduced simulation
 * Space: O(times)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    vertices?: number;
    gamma?: number;
    samples?: number;
}

interface Evolution {
    a: number;
    b: number;
    c: number;
    delta: number;
    psi0: number;
    psi1: number;
}

function setup(N: number, gamma: number): Evolution {
    const r = Math.sqrt(N - 1);
    return {
        a: -1,
        b: -gamma * r,
        c: -gamma * (N - 2),
        delta: Math.sqrt(((-1 + gamma * (N - 2)) / 2) ** 2 + (gamma * r) ** 2),
        psi0: 1 / Math.sqrt(N),
        psi1: r / Math.sqrt(N),
    };
}

/** Exact probability amplitudes in the {marked, unmarked} basis at time t. */
function evolve(ev: Evolution, t: number): { pw: number; pr: number; re0: number; im0: number; re1: number; im1: number } {
    const d = (ev.a - ev.c) / 2;
    const cos = Math.cos(ev.delta * t);
    const sin = Math.sin(ev.delta * t) / ev.delta;
    const m0 = d * ev.psi0 + ev.b * ev.psi1;
    const m1 = ev.b * ev.psi0 - d * ev.psi1;
    const re0 = cos * ev.psi0;
    const im0 = -sin * m0;
    const re1 = cos * ev.psi1;
    const im1 = -sin * m1;
    return { pw: re0 * re0 + im0 * im0, pr: re1 * re1 + im1 * im1, re0, im0, re1, im1 };
}

/** Brute-force full-graph reference: Taylor series exp(-i H t) applied to the uniform state. */
export function bruteMarkedProbability(N: number, gamma: number, t: number, marked: number): number {
    const inv = 1 / Math.sqrt(N);
    let re = new Array<number>(N).fill(inv);
    let im = new Array<number>(N).fill(0);
    let sumRe = new Array<number>(N).fill(inv);
    let sumIm = new Array<number>(N).fill(0);
    const scale = t / 1;
    for (let k = 0; k < 200; k += 1) {
        const nextRe = new Array<number>(N).fill(0);
        const nextIm = new Array<number>(N).fill(0);
        for (let i = 0; i < N; i += 1) {
            let hRe = i === marked ? -re[i]! : 0;
            let hIm = i === marked ? -im[i]! : 0;
            for (let j = 0; j < N; j += 1) {
                if (i === j) continue;
                hRe += -gamma * re[j]!;
                hIm += -gamma * im[j]!;
            }
            nextRe[i] = (hIm * scale) / (k + 1);
            nextIm[i] = (-hRe * scale) / (k + 1);
        }
        re = nextRe;
        im = nextIm;
        for (let i = 0; i < N; i += 1) {
            sumRe[i] = sumRe[i]! + re[i]!;
            sumIm[i] = sumIm[i]! + im[i]!;
        }
    }
    return sumRe[marked]! ** 2 + sumIm[marked]! ** 2;
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, i) => ({
        id: `time-${i}`,
        type: "bar" as const,
        label: `P(w)=${value.toFixed(4)}`,
        value,
        state: i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    let N = Math.round(Number(task.vertices ?? 16));
    N = Math.min(64, Math.max(4, Number.isFinite(N) ? N : 16));
    const gamma = Number.isFinite(task.gamma) && Number(task.gamma)! > 0 ? Number(task.gamma) : 1 / N;
    const samples = Math.min(60, Math.max(3, Math.floor(Number(task.samples ?? 17)) || 17));
    const ev = setup(N, gamma);
    const tStar = Math.PI / (2 * ev.delta);
    const tMax = 2 * tStar;
    const times = Array.from({ length: samples }, (_, i) => (tMax * i) / (samples - 1));
    const amps = times.map((t) => evolve(ev, t));
    const pMarked = amps.map((a) => a.pw);
    const best = pMarked.reduce((m, p, i) => (p > (pMarked[m] ?? -1) ? i : m), 0);

    const metaFor = (active: number, done: boolean) => ({
        vertices: N,
        gamma,
        delta: ev.delta,
        tStar,
        times: [...times],
        pMarked: [...pMarked],
        active,
        currentT: active >= 0 ? times[active]! : 0,
        currentP: active >= 0 ? pMarked[active]! : 0,
        totalProbability: active >= 0 ? amps[active]!.pw + amps[active]!.pr : 1,
        bestIndex: best,
        bestProbability: pMarked[best]!,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(pMarked, -1),
        edges: [],
        description: `Continuous-time walk search on K_${N}: evolve the uniform state under H = -gamma A - |w><w| and watch the marked-vertex probability.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(-1, false),
    };

    for (let i = 0; i < times.length; i += 1) {
        const a = amps[i]!;
        yield {
            stepNumber: i + 1,
            entities: makeBars(pMarked, i),
            edges: [],
            description: `Time ${times[i]!.toFixed(3)}: marked probability ${a.pw.toFixed(5)}, unmarked probability ${a.pr.toFixed(5)}, total ${(a.pw + a.pr).toFixed(6)}.`,
            codeLineNumber: i === 0 ? 2 : 3,
            layout: "array",
            meta: metaFor(i, false),
        };
    }

    yield {
        stepNumber: times.length + 1,
        entities: makeBars(pMarked, -1),
        edges: [],
        description: `Peak marked probability ${pMarked[best]!.toFixed(5)} occurs near t = ${times[best]!.toFixed(3)}; the ideal search time is ${tStar.toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A continuous-time quantum walk spreads amplitude across a graph just like a wave. By adding an attractive energy at one marked vertex, the wave stays trapped there: after a characteristic time most of the probability has concentrated on that single vertex. For a complete graph the symmetry collapses the dynamics to two levels, so the effect can be computed exactly.",
        invariants: [
            "The total probability on the marked and uniform-unmarked states stays equal to one.",
            "The initial state is the uniform superposition over all vertices.",
            "Evolution is coherent and norm-preserving because the Hamiltonian is Hermitian.",
        ],
        correctness:
            "The complete graph adjacency acting on the marked state and the uniform unmarked state closes a two-dimensional invariant subspace, so the full N-dimensional evolution reduces to a real symmetric two-by-two Hamiltonian. Diagonalizing it gives a closed-form sinusoid for the marked amplitude that reaches magnitude one when the rotation angle is pi over two. The independent brute-force Taylor expansion of the full N by N Hamiltonian must reproduce the same marked probability at every sampled time.",
        complexityRationale:
            "The reduced simulation evaluates a constant amount of trigonometry per sample, so it is O(samples). Storing the time grid and probability series is O(samples); the independent full-graph cross-check used in testing is O(N^3) per time.",
        uses: [
            "Searching unstructured databases with continuous-time Hamiltonian evolution",
            "A pedagogical bridge between quantum walks and Grover search",
            "Studying transport on highly connected networks",
        ],
        references: [
            "Farhi and Gutmann, Quantum Computation by Adiabatic Evolution, 1998",
            "Childs, Goldstone, and Landman, Continuous-Time Quantum Walk Search, 2003",
        ],
        workedExample:
            "On sixteen vertices with gamma one over sixteen the two-level gap is one over four, so the ideal measurement time is about six point two eight. At that time the marked probability reaches one, while at half that time it is close to one half.",
    },
    id: "farhi-gutmann-search",
    name: "Farhi-Gutmann Continuous-Time Search",
    category: "quantum",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { vertices: 16, samples: 17 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the complete graph size N and coupling gamma",
        "build the two-level Hamiltonian in the marked/unmarked basis",
        "compute the spectral gap from the two-level matrix",
        "prepare the uniform superposition over all vertices",
        "for each sample time apply the closed-form two-level evolution",
        "record the probability of measuring the marked vertex",
        "verify total probability stays equal to one",
        "done: report the peak probability and search time",
    ],
};

export default module;
