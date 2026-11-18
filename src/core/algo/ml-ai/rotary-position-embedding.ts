/**
 * rotary-position-embedding.ts - Rotary Position Embedding (RoPE)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RoPE encodes absolute position by rotating each pair of query or key channels
 * by an angle proportional to the token's position and a pair-specific inverse
 * frequency. Because a rotation composed with a rotation adds angles, the dot
 * product of a rotated query with a rotated key depends only on their relative
 * position. This makes position information available without adding learned
 * position vectors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) to rotate n vectors of dimension d
 *   Space: O(n * d) for the rotated vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each token's rotated vector is shown as a grid row.
 *   - Per-pair frequencies and angles are reported in meta.
 *   - The final frame reports pairwise rotated attention scores.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Rotate one even-length vector by position-dependent angles (RoPE). */
export function ropeRotate(vec: number[], position: number, base = 10000): number[] {
    const out = vec.slice();
    const pairs = Math.floor(vec.length / 2);
    for (let i = 0; i < pairs; i += 1) {
        const theta = base ** (-2 * i / vec.length);
        const angle = position * theta;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const a = vec[2 * i] ?? 0;
        const b = vec[2 * i + 1] ?? 0;
        out[2 * i] = a * c - b * s;
        out[2 * i + 1] = a * s + b * c;
    }
    return out;
}

/** Rotated query-key scores for a sequence starting at startPosition. */
export function ropeScores(Q: number[][], K: number[][], startPosition = 0, base = 10000): number[][] {
    return Q.map((query, i) => {
        const q = ropeRotate(query, startPosition + i, base);
        return K.map((key, j) => {
            const k = ropeRotate(key, startPosition + j, base);
            return q.reduce((sum, value, t) => sum + value * (k[t] ?? 0), 0);
        });
    });
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

function makeCells(matrix: number[][], shown: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            const visible = r < shown;
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: visible ? (matrix[r]?.[c] ?? 0).toFixed(2) : "?",
                value: visible ? matrix[r]?.[c] ?? 0 : 0,
                state: visible ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

/** The rotary-position-embedding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { vectors?: number[][]; startPosition?: number; base?: number } | null
    ) ?? {};
    const vectors = task.vectors ?? [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, -1, 0.5],
    ];
    const start = typeof task.startPosition === "number" ? task.startPosition : 0;
    const base = typeof task.base === "number" ? task.base : 10000;
    const rotated = vectors.map((vec, i) => ropeRotate(vec, start + i, base));
    const scores = rotated.map((q, i) => rotated.map((k) => dot(q, k)));
    const d = vectors[0]?.length ?? 0;
    const freqs = Array.from({ length: Math.floor(d / 2) }, (_, i) => base ** (-2 * i / d));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(vectors, 0),
        edges: [],
        description: `Rotate ${vectors.length} vectors of dimension ${d} at positions ${start} onward with base ${base}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: vectors.length, cols: d, n: vectors.length, d, start, base, freqs, angles: [], rotated: flatten(rotated) },
    };
    step += 1;

    for (let i = 0; i < vectors.length; i += 1) {
        const position = start + i;
        const angles = freqs.map((f) => position * f);
        yield {
            stepNumber: step,
            entities: makeCells(rotated, i + 1),
            edges: [],
            description: `Position ${position}: angles [${angles.map((a) => a.toFixed(2)).join(", ")}]; vector ${(rotated[i] ?? []).map((v) => v.toFixed(2)).join(", ")}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: vectors.length,
                cols: d,
                n: vectors.length,
                d,
                start,
                base,
                freqs,
                angles,
                rotated: flatten(rotated),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(scores, 0),
        edges: [],
        description: "Rotations preserve vector norms; pairwise dot products now encode relative position.",
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: vectors.length,
            cols: vectors.length,
            n: vectors.length,
            d,
            start,
            base,
            freqs,
            rotated: flatten(rotated),
            scores: flatten(scores),
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(scores, vectors.length),
        edges: [],
        description: `Done: ${vectors.length} by ${vectors.length} rotated score matrix reveals relative-position structure.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: vectors.length,
            cols: vectors.length,
            n: vectors.length,
            d,
            start,
            base,
            freqs,
            rotated: flatten(rotated),
            scores: flatten(scores),
            converged: true,
        },
    };
}

/** The rotary-position-embedding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of adding a position vector to a token, RoPE rotates the token's query and key vectors in a sequence of two-dimensional planes. Each plane spins at its own frequency, so the angle records where the token sits. Two rotations at positions m and n differ by the angle for m minus n, which is why attention sees relative position even though each vector was rotated using its absolute position.",
        invariants: [
            "Each two-channel pair is rotated by a 2D rotation matrix, preserving its norm.",
            "The frequency of pair i is base raised to minus 2i over d.",
            "Rotating by m and then by n equals rotating once by m plus n.",
        ],
        correctness:
            "A 2D rotation by angle a composed with one by angle b is a rotation by a+b because the corresponding complex multiplications add exponents. Therefore R_m(q) dot R_n(k) = q dot R_{n-m}(k), depending only on the offset n-m. Norm preservation follows from cos squared plus sin squared equaling one in each pair. These identities hold exactly for the implemented rotation, so the transformed attention scores encode relative position.",
        complexityRationale:
            "Each vector has d/2 pairs, each needing two trigonometric values and four multiply-adds, so rotating all n vectors costs O(n * d). Computing all pairwise scores costs O(n^2 * d). Storage is O(n * d) for the rotated vectors.",
        uses: [
            "Position encoding in modern large language models such as Llama",
            "Relative-position-aware attention in language and vision transformers",
            "Long-context models built with RoPE variants",
        ],
        references: [
            "Su et al., RoFormer: Enhanced Transformer with Rotary Position Embedding, 2021",
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
        ],
        workedExample:
            "For a four-dimensional vector at position two, the first pair rotates by 2 and the second by 2 divided by 10000. Rotating a key at position five and taking the dot product gives the same result as rotating that key by three relative steps against the unrotated query, showing the relative-position property.",
    },
    id: "rotary-position-embedding",
    name: "Rotary Position Embedding",
    category: "ml-ai",
    complexity: { time: "O(n * d + n^2 * d)", space: "O(n * d)" },
    defaultInput: {
        vectors: [
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [1, 1, -1, 0.5],
        ],
        startPosition: 0,
        base: 10000,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each two-channel pair compute inverse frequency from the dimension",
        "for each token compute the rotation angle for its position",
        "rotate the pair by cosine and sine of that angle",
        "leave the vector norm unchanged by the rotation",
        "compute dot products of all rotated query and key vectors",
        "observe that scores depend on relative position",
        "done: report rotated vectors and score matrix",
    ],
};

export default module;
