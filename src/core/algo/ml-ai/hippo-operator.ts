/**
 * hippo-operator.ts - HiPPO-LegS Memory Operator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * HiPPO-LegS compresses an entire input stream into a short vector of scaled
 * Legendre projection coefficients. The coefficients obey a linear ODE driven
 * by the newest sample, so the memory is updated online without revisiting the
 * past. The lower-triangular LegS matrix gives the memory a polynomial decay,
 * which is why it underlies long-range state-space models such as S4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2) per step for the dense triangular solve (O(N) with the
 *          prefix-sum form), for state size N
 *   Space: O(N^2) for the operator matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The LegS matrix occupies the first N rows of the grid.
 *   - The next row shows the live coefficient state.
 *   - The last row shows the input samples seen so far.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HippoInput {
    signal?: number[];
    stateSize?: number;
    dt?: number;
}

/** The positive lower-triangular LegS matrix H; the stable state matrix is -H. */
export function hippoH(N: number): number[][] {
    return Array.from({ length: N }, (_, n) =>
        Array.from({ length: N }, (_, k) => {
            if (n > k) {
                return Math.sqrt((2 * n + 1) * (2 * k + 1));
            }
            return n === k ? n + 1 : 0;
        }),
    );
}

/** Endpoint values of the scaled Legendre basis, B_n = sqrt(2n + 1). */
export function hippoB(N: number): number[] {
    return Array.from({ length: N }, (_, n) => Math.sqrt(2 * n + 1));
}

/**
 * One bilinear (trapezoidal) step of c' = -H/t c + B/t u.
 * `s` is 1 / (2 * t_mid). The solve uses forward substitution because
 * I + sH is lower triangular.
 */
export function hippoStep(H: number[][], B: number[], c: number[], uPrev: number, u: number, s: number): number[] {
    const N = c.length;
    const rhs = c.map((ci, n) => {
        let hc = 0;
        for (let k = 0; k <= n; k += 1) {
            hc += (H[n]?.[k] ?? 0) * (c[k] ?? 0);
        }
        return ci - s * hc + s * (B[n] ?? 0) * (uPrev + u);
    });
    const next = new Array<number>(N).fill(0);
    for (let n = 0; n < N; n += 1) {
        let acc = rhs[n] ?? 0;
        for (let k = 0; k < n; k += 1) {
            acc -= s * (H[n]?.[k] ?? 0) * (next[k] ?? 0);
        }
        next[n] = acc / (1 + s * (H[n]?.[n] ?? 1));
    }
    return next;
}

function makeCells(H: number[][], B: number[], c: number[], signal: number[], t: number): VisualEntity[] {
    const N = c.length;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < N; row += 1) {
        for (let col = 0; col < N; col += 1) {
            const value = H[row]?.[col] ?? 0;
            entities.push({
                id: `matrix-${row}-${col}`,
                type: "cell",
                label: value === 0 ? "0" : value.toFixed(2),
                value,
                state: value === 0 ? "idle" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, kind: "matrix" },
            });
        }
    }
    for (let col = 0; col < N; col += 1) {
        const value = c[col] ?? 0;
        entities.push({
            id: `state-${col}`,
            type: "cell",
            label: value.toFixed(3),
            value,
            state: Math.abs(value) > 1e-6 ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: N, col, kind: "state", weight: B[col] ?? 0 },
        });
        const sample = signal[Math.min(t, Math.max(0, signal.length - 1))] ?? 0;
        entities.push({
            id: `input-${col}`,
            type: "cell",
            label: col === 0 ? sample.toFixed(2) : "",
            value: col === 0 ? sample : 0,
            state: col === 0 && t >= 0 ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: N + 1, col, kind: "input" },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HippoInput | null) ?? {};
    const signal = Array.isArray(task.signal) && task.signal.length > 0
        ? task.signal.map(Number)
        : [1, 1, 1, 1, 1, 1];
    const N = Math.max(1, Math.min(6, Math.floor(task.stateSize ?? 4)));
    const dt = typeof task.dt === "number" && task.dt > 0 ? task.dt : 1;
    const H = hippoH(N);
    const B = hippoB(N);
    let c = new Array<number>(N).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(H, B, c, signal, -1),
        edges: [],
        description: `HiPPO-LegS operator of size ${N}: memory starts at zero before any input.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: N + 2, cols: N, N, t: -1, dt, matrix: H.flat(), state: c, basis: B },
    };
    step += 1;

    for (let k = 0; k < signal.length; k += 1) {
        const uPrev = k === 0 ? 0 : signal[k - 1] ?? 0;
        const u = signal[k] ?? 0;
        const tMid = dt * (k + 0.5);
        c = hippoStep(H, B, c, uPrev, u, 1 / (2 * tMid));
        yield {
            stepNumber: step,
            entities: makeCells(H, B, c, signal, k),
            edges: [],
            description: `Sample ${k}: u=${u.toFixed(2)}; coefficient c0=${(c[0] ?? 0).toFixed(3)} tracks the running mean.`,
            codeLineNumber: k === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows: N + 2, cols: N, N, t: k, dt, matrix: H.flat(), state: c, basis: B, input: u },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(H, B, c, signal, signal.length - 1),
        edges: [],
        description: `Encoded ${signal.length} samples into ${N} coefficients; c0=${(c[0] ?? 0).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: N + 2, cols: N, N, t: signal.length - 1, dt, matrix: H.flat(), state: c, basis: B },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of storing a growing signal, keep a handful of numbers that describe its shape. Those numbers are the coefficients of orthogonal Legendre polynomials over the whole history. A linear update folds each new sample into the coefficients, so the memory never needs to look back.",
        invariants: [
            "The stable state matrix is the negative of a lower-triangular matrix with diagonal 1, 2, ..., N.",
            "The coefficient update is linear in the previous state and the new sample.",
            "For a constant input of one, the coefficients converge to exactly (1, 0, ..., 0).",
        ],
        correctness:
            "Differentiating the projection integral and applying the Legendre derivative identity yields the exact ODE c' = -(1/t) H c + (1/t) B u. The trapezoidal discretization used here is a consistent second-order approximation of that ODE, and its fixed point for a constant signal solves H c = B, whose solution is the first canonical basis vector because the first column of H equals B.",
        complexityRationale:
            "The dense triangular solve touches about N squared entries per sample, and storing H costs N squared space. The equivalent prefix-sum form reduces the recurrence to O(N) per step.",
        uses: [
            "Long-range sequence modeling in state-space neural networks",
            "Online compression of streaming sensor signals",
            "Initialization of structured state-space matrices in S4",
        ],
        references: [
            "Gu, Dao, Fu et al., HiPPO: Recurrent Memory with Optimal Polynomial Projections, NeurIPS 2020",
            "Gu, Goel, Re, Efficiently Modeling Long Sequences with Structured State Spaces, ICLR 2022",
        ],
        workedExample:
            "With N=2, H=[[1,0],[sqrt(3),2]] and B=[1,sqrt(3)]. Feeding a constant one repeatedly drives c toward [1,0]: the steady state satisfies H c = B, so c0=1 and sqrt(3)*1+2*c1=sqrt(3), giving c1=0.",
    },
    id: "hippo-operator",
    name: "HiPPO-LegS Memory Operator",
    category: "ml-ai",
    complexity: { time: "O(N^2) per step", space: "O(N^2)" },
    defaultInput: { signal: [1, 1, 1, 1, 1, 1], stateSize: 4, dt: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "build the lower-triangular LegS matrix H and vector B",
        "initialize the coefficient vector c to zero",
        "for each incoming sample u at time t",
        "set s to one over twice the midpoint time",
        "solve (I plus sH) times new c equals (I minus sH)c plus sB times the two samples",
        "use forward substitution because I plus sH is triangular",
        "record the updated coefficient memory",
        "done: return the compressed history vector",
    ],
};

export default module;
