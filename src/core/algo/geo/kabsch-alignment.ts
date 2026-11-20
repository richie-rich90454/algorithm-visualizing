/**
 * kabsch-alignment.ts - Optimal 3D rigid alignment from known correspondences.
 *
 * Given paired point sets P and Q, Kabsch centers both sets, forms their
 * cross-covariance, takes its singular value decomposition, and reads off the
 * rotation that maximizes the trace of the alignment. A determinant check
 * removes the reflection case, and the translation follows from the centroids.
 *
 * Time: O(n) for the covariance plus a fixed-size 3x3 SVD. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Vec3 = [number, number, number];

function transpose(m: number[][]): number[][] {
    return [[m[0]![0]!, m[1]![0]!, m[2]![0]!], [m[0]![1]!, m[1]![1]!, m[2]![1]!], [m[0]![2]!, m[1]![2]!, m[2]![2]!]];
}

function multiply(a: number[][], b: number[][]): number[][] {
    const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
            let sum = 0;
            for (let k = 0; k < 3; k += 1) sum += a[i]![k]! * b[k]![j]!;
            out[i]![j] = sum;
        }
    }
    return out;
}

function determinant(m: number[][]): number {
    return (
        m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
        m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
        m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!)
    );
}

/** One-sided Jacobi SVD of a 3x3 matrix: A = U diag(s) V^T. */
function svd3(a: number[][]): { u: number[][]; v: number[][]; s: number[] } {
    const u = a.map((row) => row.slice());
    const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 60; sweep += 1) {
        let changed = false;
        for (let p = 0; p < 2; p += 1) {
            for (let q = p + 1; q < 3; q += 1) {
                let alpha = 0, beta = 0, gamma = 0;
                for (let k = 0; k < 3; k += 1) {
                    const up = u[k]![p]!;
                    const uq = u[k]![q]!;
                    alpha += up * up;
                    beta += uq * uq;
                    gamma += up * uq;
                }
                if (Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) continue;
                const zeta = (beta - alpha) / (2 * gamma);
                const sign = zeta < 0 ? -1 : 1;
                const t = sign / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
                const c = 1 / Math.sqrt(1 + t * t);
                const s = c * t;
                for (let k = 0; k < 3; k += 1) {
                    const up = u[k]![p]!;
                    const uq = u[k]![q]!;
                    u[k]![p] = c * up - s * uq;
                    u[k]![q] = s * up + c * uq;
                    const vp = v[k]![p]!;
                    const vq = v[k]![q]!;
                    v[k]![p] = c * vp - s * vq;
                    v[k]![q] = s * vp + c * vq;
                }
                changed = true;
            }
        }
        if (!changed) break;
    }
    const s = [0, 0, 0];
    for (let j = 0; j < 3; j += 1) {
        let norm = 0;
        for (let k = 0; k < 3; k += 1) norm += u[k]![j]! * u[k]![j]!;
        s[j] = Math.sqrt(norm);
        if (s[j]! > 1e-14) {
            for (let k = 0; k < 3; k += 1) u[k]![j] /= s[j]!;
        }
    }
    return { u, v, s };
}

/** Optimal rigid transform mapping P onto Q under the given pairing. */
function kabsch(p: Vec3[], q: Vec3[]): { rotation: number[][]; translation: Vec3 } {
    const n = p.length;
    const pc: Vec3 = [0, 0, 0];
    const qc: Vec3 = [0, 0, 0];
    for (let i = 0; i < n; i += 1) {
        for (let a = 0; a < 3; a += 1) {
            pc[a] += p[i]![a]!;
            qc[a] += q[i]![a]!;
        }
    }
    for (let a = 0; a < 3; a += 1) {
        pc[a] /= n;
        qc[a] /= n;
    }
    const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < n; i += 1) {
        for (let a = 0; a < 3; a += 1) {
            for (let b = 0; b < 3; b += 1) {
                cov[a]![b] += (p[i]![a]! - pc[a]!) * (q[i]![b]! - qc[b]!);
            }
        }
    }
    const { u, v, s } = svd3(cov);
    let rotation = multiply(v, transpose(u));
    if (determinant(rotation) < 0) {
        let min = 0;
        if (s[1]! < s[min]!) min = 1;
        if (s[2]! < s[min]!) min = 2;
        for (let k = 0; k < 3; k += 1) u[k]![min] = -u[k]![min]!;
        rotation = multiply(v, transpose(u));
    }
    const rpc = multiply(rotation, [[pc[0]], [pc[1]], [pc[2]]]) as number[][];
    const translation: Vec3 = [
        qc[0]! - rpc[0]![0]!,
        qc[1]! - rpc[1]![0]!,
        qc[2]! - rpc[2]![0]!,
    ];
    return { rotation, translation };
}

function apply(rotation: number[][], translation: Vec3, p: Vec3): Vec3 {
    return [
        rotation[0]![0]! * p[0]! + rotation[0]![1]! * p[1]! + rotation[0]![2]! * p[2]! + translation[0]!,
        rotation[1]![0]! * p[0]! + rotation[1]![1]! * p[1]! + rotation[1]![2]! * p[2]! + translation[1]!,
        rotation[2]![0]! * p[0]! + rotation[2]![1]! * p[1]! + rotation[2]![2]! * p[2]! + translation[2]!,
    ];
}

/** Project a 3D point to a stable 2D location for the point layout. */
function project(p: Vec3): [number, number] {
    return [p[0]! - 0.45 * p[2]!, p[1]! - 0.3 * p[2]!];
}

const DEFAULT_P: Vec3[] = [
    [0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0], [1, 1, 2], [3, 1, 1], [-1, 1, 1],
];
const TRUE_ROTATION = ((): number[][] => {
    const axis: Vec3 = [0.3, 0.6, 0.74];
    const norm = Math.hypot(...axis);
    const ux = axis[0]! / norm, uy = axis[1]! / norm, uz = axis[2]! / norm;
    const angle = 0.7;
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    return [
        [t * ux * ux + c, t * ux * uy - s * uz, t * ux * uz + s * uy],
        [t * ux * uy + s * uz, t * uy * uy + c, t * uy * uz - s * ux],
        [t * ux * uz - s * uy, t * uy * uz + s * ux, t * uz * uz + c],
    ];
})();
const TRUE_TRANSLATION: Vec3 = [1.5, -0.8, 0.4];

/** The Kabsch generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pointsP?: Vec3[]; pointsQ?: Vec3[] } | null) ?? {};
    const p: Vec3[] = task.pointsP ?? DEFAULT_P;
    const q: Vec3[] = task.pointsQ ?? p.map((v) => apply(TRUE_ROTATION, TRUE_TRANSLATION, v));
    let step = 0;

    const emit = (phase: number, description: string, codeLineNumber: number, final: boolean, transform?: { rotation: number[][]; translation: Vec3 }): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        p.forEach((v, i) => {
            const at = project(v);
            entities.push({
                id: `p-${i}`, type: "node", label: `P${i}`, value: v, state: phase >= 3 ? "visited" : "active",
                x: at[0], y: -at[1], width: 0, height: 0, metadata: { index: i, role: "P" },
            });
        });
        q.forEach((v, i) => {
            const at = project(v);
            entities.push({
                id: `q-${i}`, type: "node", label: `Q${i}`, value: v, state: "sorted",
                x: at[0], y: -at[1], width: 0, height: 0, metadata: { index: i, role: "Q" },
            });
            edges.push({ id: `pair-${i}`, sourceId: `p-${i}`, targetId: `q-${i}`, label: "", state: "idle", directed: false });
        });
        let aligned: number[] = [];
        let rmsd = 0;
        if (transform) {
            aligned = [];
            p.forEach((v, i) => {
                const r = apply(transform.rotation, transform.translation, v);
                const at = project(r);
                aligned.push(r[0], r[1], r[2]);
                entities.push({
                    id: `a-${i}`, type: "node", label: `A${i}`, value: r, state: "path",
                    x: at[0] + 0.15, y: -at[1] - 0.15, width: 0, height: 0, metadata: { index: i, role: "aligned" },
                });
                edges.push({ id: `residual-${i}`, sourceId: `a-${i}`, targetId: `q-${i}`, label: "", state: "comparing", directed: false });
            });
            let squared = 0;
            for (let i = 0; i < p.length; i += 1) {
                const r = apply(transform.rotation, transform.translation, p[i]!);
                squared += (r[0] - q[i]![0]!) ** 2 + (r[1] - q[i]![1]!) ** 2 + (r[2] - q[i]![2]!) ** 2;
            }
            rmsd = Math.sqrt(squared / Math.max(1, p.length));
        }
        const flat = (arr: Vec3[]): number[] => {
            const out: number[] = [];
            for (const v of arr) out.push(v[0], v[1], v[2]);
            return out;
        };
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: {
                pointsP: flat(p),
                pointsQ: flat(q),
                rotation: transform ? transform.rotation.flat() : [1, 0, 0, 0, 1, 0, 0, 0, 1],
                translation: transform ? transform.translation : [0, 0, 0],
                aligned,
                rmsd,
                phase,
            },
        };
    };

    if (p.length === 0 || q.length === 0 || p.length !== q.length) {
        yield emit(0, "Kabsch: both point sets must be nonempty and the same size.", 0, true);
        return;
    }

    yield emit(0, `Kabsch: ${p.length} paired points in three dimensions.`, 0, false);
    yield emit(1, "Kabsch: subtract the centroid of each point set.", 1, false);
    yield emit(2, "Kabsch: form the cross-covariance and take its SVD.", 2, false);
    const transform = kabsch(p, q);
    yield emit(3, "Kabsch: recover the rotation and reject any reflection.", 3, false, transform);
    yield emit(4, "Kabsch: translate by the difference between the two centroids.", 4, false, transform);
    yield emit(5, "Kabsch: the rigid transform overlays P on Q.", 5, true, transform);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Kabsch answers the question: given that point P_i corresponds to point Q_i, what single rotation and shift best carries every P onto its partner? After moving both clouds so their centers sit at the origin, the best rotation is read from the singular value decomposition of how the two sets covary. The shift is then just the gap between the original centers.",
        invariants: [
            "The fitted transform is rigid: it preserves all pairwise distances.",
            "The returned rotation is orthogonal with determinant plus one.",
            "The translation is the target centroid minus the rotated source centroid.",
        ],
        correctness:
            "Minimizing the sum of squared errors expands to a constant minus twice the trace of R times the cross-covariance, so the problem becomes maximizing that trace over rotations. The von Neumann trace inequality says the maximum is attained when R equals V times U transpose for the SVD of the covariance. If that matrix is a reflection, flipping the column of U with the smallest singular value restores a proper rotation, and centering makes the centroid formula for translation exact.",
        complexityRationale:
            "Forming the covariance scans n points with a constant amount of work each, so it is O(n). The SVD is on a fixed 3 by 3 matrix and takes constant time, giving O(n) time and O(n) space overall.",
        uses: [
            "Molecular structure superposition and protein alignment",
            "Registering 3D scans when correspondences are known",
            "Pose estimation from matched landmark pairs",
        ],
        references: [
            "Kabsch, A Solution for the Best Rotation to Relate Two Sets of Vectors, 1976",
            "Horn, Closed-Form Solution of Absolute Orientation, 1987",
        ],
        workedExample:
            "Take the four corners of a unit square and rotate them 30 degrees about the z axis, then shift by (1, 0, 0). Kabsch centers both quadrilaterals, finds the covariance of the centered sets, and returns exactly that 30 degree rotation and shift, with every transformed corner landing on its partner.",
    },
    id: "kabsch-alignment",
    name: "Kabsch Alignment",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {},
    visualType: "point",
    run,
    pseudocode: [
        "collect the paired source and target points",
        "compute the centroid of each set and subtract it",
        "form the three by three cross-covariance matrix",
        "compute its singular value decomposition",
        "set the rotation to V times U transpose and reject reflections",
        "set the translation to the target centroid minus the rotated source centroid",
        "done: the rigid transform overlays the two point sets",
    ],
};

export default module;
