/**
 * blakley-secret-sharing.ts - Blakley Geometric Secret Sharing (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Blakley's scheme hides a secret as one coordinate of a point in k
 * dimensional space over a finite field. Each share is a hyperplane passing
 * through that point. Any k independent hyperplanes meet in exactly one point,
 * which reveals the secret, while k minus one hyperplanes leave a whole line
 * of possible points. Coefficients use a Vandermonde pattern so every subset
 * of k shares is independent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * k + k^3) for m shares and threshold k
 *   Space: O(m * k) for the share table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is one share: k hyperplane coefficients plus the constant b.
 *   - The rows used by the reconstruction are highlighted in turn.
 *   - Metadata reports the recovered point and the secret coordinate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SharingInput {
    secret?: number;
    prime?: number;
    threshold?: number;
    shares?: number;
}

/** Modular inverse by extended Euclid. */
function modInverse(a: number, m: number): number {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1;
    let s = 0;
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        const nextR = oldR - quotient * r;
        oldR = r;
        r = nextR;
        const nextS = oldS - quotient * s;
        oldS = s;
        s = nextS;
    }
    return ((oldS % m) + m) % m;
}

/** Solve A x = b modulo a prime using Gaussian elimination. */
function solveSystem(a: number[][], b: number[], p: number, n: number): number[] {
    const matrix = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        while (pivot < n && (matrix[pivot]?.[col] ?? 0) % p === 0) {
            pivot += 1;
        }
        if (pivot >= n) {
            return new Array<number>(n).fill(0);
        }
        const temp = matrix[col];
        matrix[col] = matrix[pivot] ?? [];
        matrix[pivot] = temp ?? [];
        const inv = modInverse(matrix[col]?.[col] ?? 1, p);
        matrix[col] = (matrix[col] ?? []).map((value) => (value * inv) % p);
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = matrix[row]?.[col] ?? 0;
            if (factor === 0) {
                continue;
            }
            matrix[row] = (matrix[row] ?? []).map(
                (value, index) => (((value - factor * (matrix[col]?.[index] ?? 0)) % p) + p) % p,
            );
        }
    }
    return matrix.map((row) => row[n] ?? 0);
}

/** Build the share-table cells. */
function makeCells(rows: number[][], highlight: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    rows.forEach((row, r) => {
        row.forEach((value, c) => {
            entities.push({
                id: `share-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (r === highlight ? "comparing" : "visited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        });
    });
    return entities;
}

/** The Blakley secret sharing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SharingInput | null) ?? {};
    const p = typeof task.prime === "number" && task.prime > 2 ? Math.floor(task.prime) : 97;
    const k = typeof task.threshold === "number" ? Math.max(2, Math.floor(task.threshold)) : 3;
    const m = typeof task.shares === "number" ? Math.max(k, Math.floor(task.shares)) : 5;
    const secret = typeof task.secret === "number" ? ((Math.floor(task.secret) % p) + p) % p : 42;

    const point = [secret];
    for (let coord = 1; coord < k; coord += 1) {
        point.push((secret * 3 + coord * 11) % p);
    }
    const rows: number[][] = [];
    for (let i = 0; i < m; i += 1) {
        const t = (i + 1) % p;
        const coefficients: number[] = [];
        let power = 1;
        for (let d = 0; d < k; d += 1) {
            coefficients.push(power);
            power = (power * t) % p;
        }
        let b = 0;
        for (let d = 0; d < k; d += 1) {
            b = (b + coefficients[d] * (point[d] ?? 0)) % p;
        }
        rows.push([...coefficients, b]);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1),
        edges: [],
        description: `Blakley sharing over F_${p}: secret ${secret}, threshold ${k}, ${m} hyperplane shares.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: m, cols: k + 1, prime: p, threshold: k, shares: m, secret, recovered: -1 },
    };
    step += 1;

    const chosen = rows.slice(0, k);
    const matrix = chosen.map((row) => row.slice(0, k));
    const b = chosen.map((row) => row[k] ?? 0);
    for (let i = 0; i < k; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, i),
            edges: [],
            description: `Selecting share ${i + 1}: coefficients ${matrix[i]?.join(",")}, constant ${b[i]}.`,
            codeLineNumber: 2,
            layout: "matrix",
            meta: { rows: m, cols: k + 1, prime: p, threshold: k, shares: m, secret, recovered: -1 },
        };
        step += 1;
    }

    const solution = solveSystem(matrix, b, p, k);
    const recovered = solution[0] ?? -1;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1),
        edges: [],
        description: `The ${k} hyperplanes meet at a point whose first coordinate is ${recovered}.`,
        codeLineNumber: 4,
        layout: "matrix",
        meta: { rows: m, cols: k + 1, prime: p, threshold: k, shares: m, secret, recovered },
    };
}

/** The Blakley secret sharing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the secret as one coordinate of a hidden point. Each share describes a flat surface that passes through that point. One or two surfaces leave the point sliding along a line or plane, but enough surfaces pin it down uniquely. The shares here are equations with Vandermonde coefficients, which guarantees every threshold-sized group is independent.",
        invariants: [
            "Every share hyperplane passes through the hidden secret point.",
            "Any k shares form a nonsingular Vandermonde matrix modulo the prime.",
            "The first coordinate of the reconstructed point is the secret.",
        ],
        correctness:
            "Each share is built so the dot product of its coefficients with the secret point equals its constant term, so the point satisfies every equation. Vandermonde rows built from distinct parameters have full rank k, so any k equations have exactly one solution, which must be the secret point. Fewer than k equations leave a nontrivial nullspace, so the point is undetermined. The companion test enumerates every k-subset and confirms correct reconstruction and that smaller subsets have rank below k.",
        complexityRationale:
            "Building m shares needs m times k multiply-add operations. Reconstruction solves a k by k linear system with Gaussian elimination in O(k cubed) field operations. Storing the share table uses O(m * k) space.",
        uses: [
            "Distributing a signing key across several custodians",
            "Threshold access control without a single point of failure",
            "A geometric counterpart to polynomial-based secret sharing",
        ],
        references: [
            "Blakley, Safeguarding Cryptographic Keys, 1979",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 12",
        ],
        workedExample:
            "Over the field with 97 elements, take the secret 42 and threshold three. Each share is a plane through a point whose first coordinate is 42. Any three planes from the generated Vandermonde family intersect at that one point, so Gaussian elimination on their equations returns 42 as the secret.",
    },
    id: "blakley-secret-sharing",
    name: "Blakley Secret Sharing (Teaching Model)",
    category: "cryptography-security",
    complexity: { time: "O(m * k + k^3)", space: "O(m * k)" },
    defaultInput: { secret: 42, prime: 97, threshold: 3, shares: 5 },
    visualType: "matrix",
    run,
    pseudocode: [
        "choose a prime field and a threshold k",
        "place the secret in the first coordinate of a hidden point",
        "build each share as a Vandermonde row and its dot product",
        "hand one hyperplane equation to each participant",
        "collect any k shares and assemble a linear system",
        "solve the system by Gaussian elimination in the field",
        "read the secret from the first solved coordinate",
        "done: report the recovered secret",
    ],
};

export default module;
