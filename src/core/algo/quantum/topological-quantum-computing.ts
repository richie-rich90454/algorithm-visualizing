/**
 * topological-quantum-computing.ts - Fibonacci Anyon Braiding on Three Anyons
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a topological quantum computer, information is stored in the fusion space
 * of non-Abelian anyons and gates are performed by braiding their world lines.
 * Three Fibonacci anyons with total charge tau span a two-dimensional fusion
 * space, which acts as one logical qubit. Exchanging neighboring anyons applies
 * the matrices sigma1 and sigma2, built from the R symbols and the F matrix of
 * the Fibonacci category. Applying a braid word evolves the logical state.
 *
 * This is an exact small simulation of that two-dimensional representation.
 * It handles three anyons and braids of the two adjacent generators; it does
 * not simulate four or more anyons, measurement, leakage, finite braid-time
 * dynamics, or compilation of arbitrary gates to long braid words.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L) for a braid word of length L with 2x2 complex matrices
 *   Space: O(1) for the state and the two generator matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the probability of the two fusion channels.
 *   - The bar affected by the current braid is yellow.
 *   - The final frame is green and reports the evolved fusion amplitudes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BraidInput {
    braidWord?: number[];
}

type Complex = [number, number];
type Matrix = [[Complex, Complex], [Complex, Complex]];

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;
const INV_SQRT_PHI = 1 / Math.sqrt(PHI);

function cAdd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cScale(a: Complex, s: number): Complex {
    return [a[0] * s, a[1] * s];
}

function matMul(a: Matrix, b: Matrix): Matrix {
    return [
        [cAdd(cMul(a[0][0], b[0][0]), cMul(a[0][1], b[1][0])),
         cAdd(cMul(a[0][0], b[0][1]), cMul(a[0][1], b[1][1]))],
        [cAdd(cMul(a[1][0], b[0][0]), cMul(a[1][1], b[1][0])),
         cAdd(cMul(a[1][0], b[0][1]), cMul(a[1][1], b[1][1]))],
    ];
}

function applyMatrix(m: Matrix, v: [Complex, Complex]): [Complex, Complex] {
    return [cAdd(cMul(m[0][0], v[0]), cMul(m[0][1], v[1])),
            cAdd(cMul(m[1][0], v[0]), cMul(m[1][1], v[1]))];
}

function phase(angle: number): Complex {
    return [Math.cos(angle), Math.sin(angle)];
}

/** R symbols for two Fibonacci anyons fusing to vacuum and to tau. */
function rMatrix(): Matrix {
    const r1 = phase((-4 * Math.PI) / 5);
    const rt = phase((3 * Math.PI) / 5);
    return [[r1, [0, 0]], [[0, 0], rt]];
}

/** F matrix relating the two fusion orders of three anyons. */
function fMatrix(): Matrix {
    return [[[INV_PHI, 0], [INV_SQRT_PHI, 0]], [[INV_SQRT_PHI, 0], [-INV_PHI, 0]]];
}

function generators(): { s1: Matrix; s2: Matrix } {
    const f = fMatrix();
    const s1 = rMatrix();
    const s2 = matMul(matMul(f, s1), f);
    return { s1, s2 };
}

function makeBars(state: [Complex, Complex], active: number, done: boolean): VisualEntity[] {
    return state.map((amplitude, index) => {
        const magnitude = Math.hypot(amplitude[0], amplitude[1]);
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `channel ${index === 0 ? "1" : "tau"}: ${amplitude[0].toFixed(3)}${amplitude[1] < 0 ? "-" : "+"}${Math.abs(amplitude[1]).toFixed(3)}i`,
            value: magnitude * magnitude,
            state: done ? "sorted" : index === active ? "comparing" : "idle",
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, channel: index === 0 ? "vacuum" : "tau", re: amplitude[0], im: amplitude[1] },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BraidInput | null) ?? {};
    const raw = Array.isArray(task.braidWord) && task.braidWord.length > 0
        ? task.braidWord.slice(0, 16).map((value) => (value === 2 ? 2 : 1))
        : [1, 2, 1, 2];
    const { s1, s2 } = generators();
    let state: [Complex, Complex] = [[1, 0], [0, 0]];

    const metaOf = (step: number) => ({
        braidWord: [...raw],
        amplitudes: state.flatMap((z) => [z[0], z[1]]),
        probabilities: state.map((z) => z[0] * z[0] + z[1] * z[1]),
        norm: state.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0),
        step,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(state, -1, false),
        edges: [],
        description: "Three Fibonacci anyons with total charge tau give a two-dimensional fusion space.",
        codeLineNumber: 0,
        layout: "array",
        meta: metaOf(0),
    };

    for (let i = 0; i < raw.length; i += 1) {
        state = applyMatrix(raw[i] === 2 ? s2 : s1, state);
        yield {
            stepNumber: i + 1,
            entities: makeBars(state, 0, false),
            edges: [],
            description: `Braid step ${i + 1}: exchanging anyons ${raw[i]} and ${raw[i] === 1 ? 2 : 3} applies sigma${raw[i]}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: metaOf(i + 1),
        };
    }

    yield {
        stepNumber: raw.length + 1,
        entities: makeBars(state, -1, true),
        edges: [],
        description: `Braid word ${raw.join(" ")} maps the fusion state to the amplitudes shown; braiding is unitary.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaOf(raw.length + 1), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Some quasiparticles remember how they were swapped around each other. With three Fibonacci anyons there are two ways their charges can combine, and those two possibilities behave like the zero and one of a qubit. Dragging one anyon around another rotates that qubit in a way that depends only on the braid pattern, not on the exact path.",
        invariants: [
            "The fusion space of three tau anyons with total charge tau is two-dimensional.",
            "Each braid generator is unitary, so the total probability stays one.",
            "The generators satisfy the Yang-Baxter relation sigma1 sigma2 sigma1 equals sigma2 sigma1 sigma2.",
        ],
        correctness:
            "The R symbols give the phase for exchanging two anyons in each fusion channel, and the F matrix changes between the two possible orders of fusing three anyons. Conjugating R by F gives the second generator. The F and R matrices satisfy the pentagon and hexagon identities of the Fibonacci category, which imply the Yang-Baxter equation; the test verifies that identity and unitarity directly. Because braid words are built from unitary matrices, the evolved fusion state stays normalized.",
        complexityRationale:
            "A braid word of length L applies L matrix-vector products of size two by two, so time is O(L) and space is constant. Simulating more anyons would enlarge the fusion space exponentially in the anyon count.",
        uses: [
            "Topologically protected quantum gates insensitive to local noise",
            "A model for non-Abelian statistics in fractional quantum Hall systems",
            "Compiling single-qubit gates into braid words",
        ],
        references: [
            "Freedman, Larsen, and Wang, A Modular Functor Which Is Universal for Quantum Computation, 2002",
            "Nayak et al., Non-Abelian Anyons and Topological Quantum Computation, 2008",
        ],
        workedExample:
            "Starting with the first two anyons fused to vacuum, the state is the vector (1, 0). One sigma1 exchange multiplies it by the phase exp(minus four pi i over five). A sigma2 exchange first changes fusion basis with F, applies the phase, and changes back, producing a superposition of both fusion channels.",
    },
    id: "topological-quantum-computing",
    name: "Topological Quantum Computing (Fibonacci Anyon Braiding)",
    category: "quantum",
    complexity: { time: "O(L)", space: "O(1)" },
    defaultInput: { braidWord: [1, 2, 1, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "build F and R matrices of the Fibonacci category",
        "set sigma1 to R and sigma2 to F R F",
        "initialize the fusion state to the vacuum channel",
        "for each generator in the braid word",
        "apply the matching two-by-two unitary",
        "record the channel probabilities after each braid",
        "done: report the final fusion amplitudes",
    ],
};

export default module;
