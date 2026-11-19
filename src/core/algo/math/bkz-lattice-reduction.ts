/**
 * bkz-lattice-reduction.ts - Block Korkine-Zolotarev Reduction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BKZ strengthens LLL by reducing short blocks of consecutive basis vectors
 * instead of only neighboring pairs. Each position k takes a block of size
 * beta, searches the projected block for a shorter lattice vector with leading
 * coefficient one, inserts it with a unimodular row operation, and re-runs LLL.
 * Repeated tours progressively shorten the basis while preserving the lattice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(tours * n * SVP(beta) + LLL) with a bounded brute-force SVP oracle
 *   Space: O(n^2) for the basis, GSO data, and transformation matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each basis vector is a coefficient row of cells.
 *   - The block being searched is GREEN; the inserted short vector is SORTED.
 *   - The final frame reports the squared first-vector length before and after.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
    return sum;
}

function cloneMatrix(m: Vec[]): Vec[] {
    return m.map((row) => row.slice());
}

function identity(n: number): Vec[] {
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
}

/** Gram-Schmidt orthogonalization with mu coefficients and squared lengths. */
function gso(basis: Vec[]): { bstar: Vec[]; mu: number[][] } {
    const bstar: Vec[] = [];
    const mu: number[][] = [];
    for (let i = 0; i < basis.length; i += 1) {
        const row = new Array<number>(basis.length).fill(0);
        let v = basis[i]!.slice();
        for (let j = 0; j < i; j += 1) {
            const bj = bstar[j]!;
            const value = dot(basis[i]!, bj) / dot(bj, bj);
            row[j] = value;
            v = v.map((x, k) => x - value * (bj[k] ?? 0));
        }
        row[i] = 1;
        mu.push(row);
        bstar.push(v);
    }
    return { bstar, mu };
}

/** Elementary row operations applied to both the basis and its transformation. */
function sizeReduce(
    basis: Vec[],
    transform: Vec[],
    target: number,
    source: number,
    q: number,
): void {
    if (q === 0) return;
    for (let i = 0; i < basis[target]!.length; i += 1) {
        basis[target]![i] -= q * basis[source]![i]!;
    }
    for (let i = 0; i < transform[target]!.length; i += 1) {
        transform[target]![i] -= q * transform[source]![i]!;
    }
}

function swapRows(basis: Vec[], transform: Vec[], a: number, b: number): void {
    [basis[a], basis[b]] = [basis[b]!, basis[a]!];
    [transform[a], transform[b]] = [transform[b]!, transform[a]!];
}

/** LLL reduction with a tracked unimodular transformation. */
function lll(basis: Vec[], transform: Vec[], delta = 0.75): boolean {
    const n = basis.length;
    let k = 1;
    let changed = false;
    let guard = 0;
    while (k < n && guard < 5000) {
        guard += 1;
        let current = gso(basis);
        for (let j = k - 1; j >= 0; j -= 1) {
            const q = Math.round(current.mu[k]![j]!);
            if (q !== 0) {
                sizeReduce(basis, transform, k, j, q);
                changed = true;
                current = gso(basis);
            }
        }
        const lengthK = dot(current.bstar[k]!, current.bstar[k]!);
        const lengthPrev = dot(current.bstar[k - 1]!, current.bstar[k - 1]!);
        if (lengthK >= (delta - current.mu[k]![k - 1]! ** 2) * lengthPrev) {
            k += 1;
        } else {
            swapRows(basis, transform, k, k - 1);
            changed = true;
            k = Math.max(k - 1, 1);
        }
    }
    return changed;
}

/** Squared norm of the projection of v orthogonal to b*0..b*(k-1). */
function projectedNormSquared(v: Vec, bstar: Vec[], k: number): number {
    let projection = v.slice();
    for (let j = 0; j < k; j += 1) {
        const bj = bstar[j]!;
        const factor = dot(v, bj) / dot(bj, bj);
        projection = projection.map((x, i) => x - factor * (bj[i] ?? 0));
    }
    return dot(projection, projection);
}

interface BlockEvent {
    index: number;
    coefficients: number[];
    before: number;
    after: number;
}

/** BKZ with a bounded brute-force short-vector search in each projected block. */
function bkz(
    input: Vec[],
    beta: number,
    tours: number,
    radius: number,
): { basis: Vec[]; transform: Vec[]; events: BlockEvent[] } {
    const basis = cloneMatrix(input);
    const transform = identity(basis.length);
    const events: BlockEvent[] = [];
    lll(basis, transform);

    for (let tour = 0; tour < tours; tour += 1) {
        let changedThisTour = false;
        for (let k = 0; k < basis.length - 1; k += 1) {
            const end = Math.min(basis.length - 1, k + beta - 1);
            const width = end - k;
            const current = gso(basis);
            const before = projectedNormSquared(basis[k]!, current.bstar, k);
            let bestNorm = before;
            let bestCoefficients = new Array<number>(width).fill(0);

            const search = (position: number, coefficients: number[]): void => {
                if (position === width) {
                    const v = basis[k]!.slice();
                    for (let i = 1; i <= width; i += 1) {
                        const coefficient = coefficients[i - 1] ?? 0;
                        if (coefficient === 0) continue;
                        const source = basis[k + i]!;
                        for (let d = 0; d < v.length; d += 1) {
                            v[d] += coefficient * (source[d] ?? 0);
                        }
                    }
                    const value = projectedNormSquared(v, current.bstar, k);
                    if (value < bestNorm - 1e-9) {
                        bestNorm = value;
                        bestCoefficients = coefficients.slice();
                    }
                    return;
                }
                for (let c = -radius; c <= radius; c += 1) {
                    coefficients[position] = c;
                    search(position + 1, coefficients);
                }
            };
            search(0, new Array<number>(width).fill(0));

            if (bestCoefficients.some((c) => c !== 0)) {
                for (let i = 1; i <= width; i += 1) {
                    sizeReduce(basis, transform, k, k + i, -(bestCoefficients[i - 1] ?? 0));
                }
                lll(basis, transform);
                events.push({
                    index: k,
                    coefficients: bestCoefficients.slice(),
                    before,
                    after: bestNorm,
                });
                changedThisTour = true;
            }
        }
        if (!changedThisTour) break;
    }
    return { basis, transform, events };
}

function basisEntities(basis: Vec[], highlight: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    basis.forEach((row, r) => {
        row.forEach((value, c) => {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (r === highlight ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { basis?: Vec[]; blockSize?: number; tours?: number; radius?: number } | null) ??
        {};
    const basis: Vec[] = task.basis ?? [
        [1, 1, 1],
        [-2, 0, 1],
        [4, 1, 0],
    ];
    const beta = Math.max(2, Math.min(basis.length, Math.trunc(task.blockSize ?? 3)));
    const tours = Math.max(1, Math.trunc(task.tours ?? 3));
    const radius = Math.max(1, Math.min(4, Math.trunc(task.radius ?? 2)));
    let step = 0;

    yield {
        stepNumber: step,
        entities: basisEntities(basis, -1),
        edges: [],
        description: `Starting BKZ reduction with block size ${beta} on a rank ${basis.length} lattice.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, beta, tours },
    };
    step += 1;

    const before = dot(basis[0] ?? [], basis[0] ?? []);
    const result = bkz(basis, beta, tours, radius);
    yield {
        stepNumber: step,
        entities: basisEntities(result.basis, -1),
        edges: [],
        description: `LLL preprocessing produced an initial reduced basis; first-vector squared length ${dot(result.basis[0] ?? [], result.basis[0] ?? [])}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { step, phase: "lll", firstNorm: dot(result.basis[0] ?? [], result.basis[0] ?? []) },
    };
    step += 1;

    for (const event of result.events) {
        yield {
            stepNumber: step,
            entities: basisEntities(result.basis, event.index),
            edges: [],
            description: `Block at index ${event.index}: inserted short vector with coefficients [${event.coefficients.join(", ")}], projected length ${event.before.toFixed(2)} to ${event.after.toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                step,
                index: event.index,
                coefficients: event.coefficients,
                before: event.before,
                after: event.after,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: basisEntities(result.basis, -1).map((entity) => ({
            ...entity,
            state: "sorted" as EntityState,
        })),
        edges: [],
        description: `BKZ finished: first-vector squared length improved from ${before} to ${dot(result.basis[0] ?? [], result.basis[0] ?? [])} with the lattice unchanged.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            step,
            blockSize: beta,
            originalFirstNorm: before,
            finalFirstNorm: dot(result.basis[0] ?? [], result.basis[0] ?? []),
            determinantPreserved: true,
            reducedBasis: result.basis.map((row) => row.join(",")),
            transform: result.transform.map((row) => row.join(",")),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LLL only looks at neighboring vectors, so it can miss a very short vector that lives inside a larger block. BKZ zooms out: it projects a window of beta consecutive vectors, finds the shortest vector in that projected lattice, and swaps it into the basis. Repeating this over every window and sweeping the basis again and again gradually drives the vectors closer to orthogonal and much shorter.",
        invariants: [
            "Every basis change is a unimodular row operation, so the generated lattice is unchanged.",
            "After each insertion the whole basis is LLL reduced again.",
            "The projected norm of the inserted vector never exceeds the block's previous best.",
        ],
        correctness:
            "Adding integer multiples of other rows to one row and swapping rows are unimodular operations, so the lattice generated by the basis is invariant; the tracked transformation matrix records the product of these moves. The block search finds the shortest vector within the bounded coefficient window by exhaustive enumeration, so it cannot miss a shorter vector in that window, and LLL restores the Lovasz condition after every insertion. Hence the output is an LLL-reduced basis of the same lattice with a no-longer first vector.",
        complexityRationale:
            "Each of the n block positions enumerates at most (2r + 1) raised to (beta - 1) coefficient tuples and recomputes a GSO, with an LLL pass costing polynomial work in n; over a fixed number of tours the time is bounded by tours times n times the SVP oracle cost plus LLL. The basis, GSO table, and transformation matrix occupy O(n^2) space.",
        uses: [
            "Breaking reduced lattices in cryptanalysis of lattice schemes",
            "Finding short vectors for integer relation detection",
            "Improving basis quality before closest-vector decoding",
        ],
        references: [
            "Schnorr and Euchner, Lattice Basis Reduction: Improved Practical Algorithms, 1994",
            "Cohen, A Course in Computational Algebraic Number Theory, Chapter 2",
        ],
        workedExample:
            "On a rank-three basis (1,1,1), (-2,0,1), (4,1,0), LLL first shortens the vectors. A BKZ tour with block size three then projects all three vectors, enumerates small coefficient combinations with leading coefficient one, and may insert a combination such as b0 + b2 when its projected length is smaller, then re-LLL reduces before finishing.",
    },
    id: "bkz-lattice-reduction",
    name: "BKZ Lattice Reduction",
    category: "math",
    complexity: { time: "O(tours * n * SVP(beta))", space: "O(n^2)" },
    defaultInput: {
        basis: [
            [1, 1, 1],
            [-2, 0, 1],
            [4, 1, 0],
        ],
        blockSize: 3,
        tours: 3,
        radius: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "input a lattice basis and block size beta",
        "LLL reduce the basis and record the transformation",
        "for each BKZ tour",
        "for each block start k from left to right",
        "project the block orthogonal to earlier vectors",
        "enumerate short projected vectors bounded by radius",
        "insert the shortest with a unimodular row operation",
        "LLL reduce again and repeat until no block improves",
        "done: a shorter basis generating the same lattice",
    ],
};

export default module;
