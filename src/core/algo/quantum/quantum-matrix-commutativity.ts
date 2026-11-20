/**
 * quantum-matrix-commutativity.ts - Quantum Commutativity Test via Overlap
 *
 * Two operators commute exactly when AB - BA is the zero operator. The squared
 * Hilbert-Schmidt norm of that commutator is a sum of overlap terms, which a
 * quantum swap-style overlap circuit can estimate with far fewer matrix entries
 * than a classical entry-by-entry multiplication. This module evaluates the
 * same overlap quantity directly so the verdict is exact.
 *
 * Limits: matrices are fixed at 2 by 2 with real entries, arithmetic is exact
 * double precision, no physical quantum circuit or sampling noise is modeled,
 * and the zero threshold is 1e-12.
 *
 * Time: O(d^3) for d by d matrices (constant here)
 * Space: O(d^2) for the commutator display
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    matrixA?: number[][];
    matrixB?: number[][];
}

type Mat2 = [[number, number], [number, number]];

function asMat2(m: number[][] | undefined, fallback: Mat2): Mat2 {
    if (!Array.isArray(m) || m.length < 2 || !Array.isArray(m[0]) || !Array.isArray(m[1])) {
        return fallback;
    }
    return [
        [Number(m[0]?.[0] ?? 0), Number(m[0]?.[1] ?? 0)],
        [Number(m[1]?.[0] ?? 0), Number(m[1]?.[1] ?? 0)],
    ];
}

function multiply(a: Mat2, b: Mat2): Mat2 {
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
    ];
}

function makeCells(c: Mat2, revealed: number, commute: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 2; r += 1) {
        for (let col = 0; col < 2; col += 1) {
            const index = r * 2 + col;
            const shown = index < revealed;
            cells.push({
                id: `cell-${index}`,
                type: "cell" as const,
                label: shown ? c[r][col].toFixed(4) : "?",
                value: shown ? c[r][col] : 0,
                state: !shown ? "idle" : commute ? "sorted" : "error",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col, index, revealed: shown },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const a = asMat2(task.matrixA, [[2, 0], [0, 3]]);
    const b = asMat2(task.matrixB, [[5, 0], [0, 7]]);
    const ab = multiply(a, b);
    const ba = multiply(b, a);
    const c: Mat2 = [
        [ab[0][0] - ba[0][0], ab[0][1] - ba[0][1]],
        [ab[1][0] - ba[1][0], ab[1][1] - ba[1][1]],
    ];
    let running = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(c, 0, false),
        edges: [],
        description: "Test whether two 2 by 2 matrices commute using the commutator overlap norm.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { overlapNormSquared: 0, commute: true, entriesRevealed: 0 },
    };

    let step = 1;
    for (let r = 0; r < 2; r += 1) {
        for (let col = 0; col < 2; col += 1) {
            running += c[r][col] * c[r][col];
            const revealed = r * 2 + col + 1;
            yield {
                stepNumber: step,
                entities: makeCells(c, revealed, false),
                edges: [],
                description: `Entry (${r}, ${col}) of AB minus BA is ${c[r][col].toFixed(6)}; running overlap ${running.toExponential(4)}.`,
                codeLineNumber: r === 0 && col === 0 ? 3 : 4,
                layout: "grid",
                meta: { overlapNormSquared: running, commute: running < 1e-12, entriesRevealed: revealed },
            };
            step += 1;
        }
    }

    const commute = running < 1e-12;
    yield {
        stepNumber: step,
        entities: makeCells(c, 4, commute),
        edges: [],
        description: commute
            ? "The commutator is zero, so the matrices commute."
            : `The commutator overlap is ${running.toExponential(4)}, so the matrices do not commute.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { overlapNormSquared: running, commute, entriesRevealed: 4 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Commutativity asks whether applying two operators in either order gives the same result. Form the difference AB minus BA. If every entry is zero the operators commute; otherwise the size of the difference measures how much the order matters. The squared size is an overlap that a quantum circuit can estimate by sampling, whereas this simulation reveals each entry directly.",
        invariants: [
            "The commutator is computed from the two full matrix products.",
            "The reported overlap is a running sum of squared commutator entries.",
            "The verdict is true exactly when the overlap is below the stated threshold.",
        ],
        correctness:
            "Matrix multiplication is associative and distributive, so AB - BA is the unique operator that measures the failure to commute. Its squared Frobenius norm is zero if and only if every entry vanishes, which is equivalent to AB = BA. The test builds the products independently for diagonal and Pauli-matrix examples and checks that the reported norm and verdict agree.",
        complexityRationale:
            "For general d by d matrices the two products cost O(d^3) and the overlap sum costs O(d^2); with d fixed at two this is a constant. The displayed commutator occupies O(d^2) cells.",
        uses: [
            "Testing compatibility of observables in quantum mechanics",
            "Checking symmetry of operators before applying simultaneous diagonalization",
            "A teaching model for overlap estimation circuits",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
            "Barenco et al., Elementary Gates for Quantum Computation, 1995",
        ],
        workedExample:
            "For the Pauli matrices X=[[0,1],[1,0]] and Z=[[1,0],[0,-1]], the products XZ and ZX differ in both diagonal entries, the commutator is [[0,2],[-2,0]], and the squared overlap is 8, so the test reports that they do not commute. Two diagonal matrices give a zero commutator and commute.",
    },
    id: "quantum-matrix-commutativity",
    name: "Quantum Matrix Commutativity Test",
    category: "quantum",
    complexity: { time: "O(d^3)", space: "O(d^2)" },
    defaultInput: { matrixA: [[2, 0], [0, 3]], matrixB: [[5, 0], [0, 7]] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the two input matrices",
        "compute the product A times B",
        "compute the product B times A",
        "subtract to obtain the commutator entries",
        "sum the squares as the overlap norm",
        "compare the norm with the zero threshold",
        "report whether the operators commute",
    ],
};

export default module;
