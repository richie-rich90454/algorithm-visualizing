/**
 * quantum-fisher-information.ts - Quantum Fisher Information of a Qubit
 *
 * Computes the quantum Fisher information (QFI) for a one-parameter family of
 * pure qubit states using the pure-state formula
 * F = 4 ( <dpsi|dpsi> - |<psi|dpsi>|^2 ), with the derivative estimated by a
 * central finite difference. Two exactly solvable encodings are provided and
 * the numerical result is compared with the closed form.
 *
 * This is an idealized exact small simulation of two single-qubit encodings.
 * It does not cover mixed states, the SLD eigenvalue decomposition, or
 * multi-parameter estimation.
 *
 * Time:  O(grid * d) with d = 2 amplitudes
 * Space: O(grid)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface Task {
    model?: "amplitude" | "phase";
    coefficient?: number;
    alpha?: number;
    thetas?: number[];
}

function cConj(z: Complex): Complex {
    return [z[0], -z[1]];
}

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cAbs2(z: Complex): number {
    return z[0] * z[0] + z[1] * z[1];
}

/** Build |psi(theta)> as two complex amplitudes. */
function state(theta: number, model: "amplitude" | "phase", c: number, alpha: number): Complex[] {
    if (model === "amplitude") {
        const g = c * theta * theta;
        return [[Math.cos(g), 0], [Math.sin(g), 0]];
    }
    return [[Math.cos(alpha), 0], [Math.sin(alpha) * Math.cos(theta), Math.sin(alpha) * Math.sin(theta)]];
}

/** Closed-form QFI for the two encodings. */
function analytic(theta: number, model: "amplitude" | "phase", c: number, alpha: number): number {
    if (model === "amplitude") {
        const gp = 2 * c * theta;
        return 4 * gp * gp;
    }
    return Math.sin(2 * alpha) ** 2;
}

function numerical(theta: number, model: "amplitude" | "phase", c: number, alpha: number, h: number): number {
    const plus = state(theta + h, model, c, alpha);
    const minus = state(theta - h, model, c, alpha);
    const psi = state(theta, model, c, alpha);
    let normD = 0;
    let overlapRe = 0;
    let overlapIm = 0;
    for (let i = 0; i < 2; i += 1) {
        const d: Complex = [(plus[i]![0] - minus[i]![0]) / (2 * h), (plus[i]![1] - minus[i]![1]) / (2 * h)];
        normD += cAbs2(d);
        const ov = cMul(cConj(psi[i]!), d);
        overlapRe += ov[0];
        overlapIm += ov[1];
    }
    return 4 * (normD - (overlapRe * overlapRe + overlapIm * overlapIm));
}

function makeBars(rows: number[][], active: number): VisualEntity[] {
    return rows.map((row, i) => ({
        id: `theta-${i}`,
        type: "bar" as const,
        label: `theta=${row[0]!.toFixed(2)} QFI=${row[1]!.toFixed(3)}`,
        value: row[1]!,
        state: i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, theta: row[0]!, qfi: row[1]!, analytic: row[2]!, error: row[3]! },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const model: "amplitude" | "phase" = task.model === "phase" ? "phase" : "amplitude";
    const c = Number.isFinite(task.coefficient) ? Number(task.coefficient) : 1;
    const alpha = Number.isFinite(task.alpha) ? Number(task.alpha) : Math.PI / 6;
    const grid = Array.isArray(task.thetas) && task.thetas.length >= 2
        ? task.thetas.map((v) => Number(v))
        : Array.from({ length: 9 }, (_, i) => 0.2 + i * 0.2);
    const h = 1e-5;

    const rows = grid.map((theta) => {
        const qfi = numerical(theta, model, c, alpha, h);
        const closed = analytic(theta, model, c, alpha);
        return [theta, qfi, closed, Math.abs(qfi - closed)];
    });
    const maxError = rows.reduce((m, r) => Math.max(m, r[3]!), 0);
    const metaFor = (active: number, done: boolean) => ({
        model,
        coefficient: c,
        alpha,
        step: h,
        grid: rows.map((r) => [...r]),
        maxError,
        active,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(rows, -1),
        edges: [],
        description: `Compute quantum Fisher information for the ${model} qubit encoding on ${grid.length} parameter values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(-1, false),
    };

    for (let i = 0; i < rows.length; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeBars(rows, i),
            edges: [],
            description: `At theta=${rows[i]![0]!.toFixed(3)} the central-difference QFI is ${rows[i]![1]!.toFixed(5)} versus closed form ${rows[i]![2]!.toFixed(5)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "array",
            meta: metaFor(i, false),
        };
    }

    yield {
        stepNumber: rows.length + 1,
        entities: makeBars(rows, -1),
        edges: [],
        description: `All values agree with the pure-state closed form; largest absolute error ${maxError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quantum Fisher information measures how sensitively a parameterized quantum state changes as the parameter moves. A state that rotates quickly in Hilbert space carries more information about the parameter. For pure states the quantity reduces to a simple expression involving the state and its derivative, so it can be computed by differentiating the amplitudes and forming two inner products.",
        invariants: [
            "The state is normalized for every parameter value, so the overlap term is purely imaginary.",
            "Quantum Fisher information is nonnegative for any parameterization.",
            "For the amplitude model QFI grows quadratically with theta; for pure phase encoding it depends only on the superposition angle.",
        ],
        correctness:
            "For a normalized pure state, differentiating the normalization identity shows that the overlap <psi|dpsi> is purely imaginary, so the pure-state QFI formula is equivalent to four times the squared norm of the component of the derivative orthogonal to the state. Applying it to the amplitude encoding gives 4 times the squared derivative of the rotation angle, and applying it to phase encoding gives the sine-squared of twice the superposition angle. The central-difference computation must reproduce both closed forms.",
        complexityRationale:
            "Each grid point builds three two-amplitude states and combines them in constant time, so the cost is O(grid). The grid rows and scalar parameters are stored, giving O(grid) space.",
        uses: [
            "Quantum metrology and the quantum Cramer-Rao precision bound",
            "Comparing sensing strategies such as phase and amplitude encodings",
            "Analyzing parameter sensitivity in variational quantum circuits",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 9",
            "Paris, Quantum Estimation for Quantum Technology, 2009",
        ],
        workedExample:
            "For the phase encoding with alpha equal to pi over six, sin of twice alpha is sin of pi over three, so QFI is three quarters at every theta. For the amplitude encoding with coefficient one at theta equal to one, the rotation angle derivative is two, giving QFI of sixteen.",
    },
    id: "quantum-fisher-information",
    name: "Quantum Fisher Information (Qubit Simulation)",
    category: "quantum",
    complexity: { time: "O(grid)", space: "O(grid)" },
    defaultInput: { model: "amplitude", coefficient: 1, thetas: [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6] },
    visualType: "array",
    run,
    pseudocode: [
        "choose the qubit encoding and parameter grid",
        "for each parameter value build the state at theta plus and minus h",
        "approximate the state derivative by a central difference",
        "compute the squared norm of that derivative",
        "compute the overlap of the state with its derivative",
        "set QFI to four times norm minus overlap magnitude squared",
        "compare with the analytic closed form for the encoding",
        "done: report the largest absolute error",
    ],
};

export default module;
