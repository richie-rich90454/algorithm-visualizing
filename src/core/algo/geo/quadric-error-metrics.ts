/**
 * quadric-error-metrics.ts - Quadric Error Metrics Mesh Simplification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quadric error metrics simplify a triangle mesh by contracting edges. Each
 * vertex owns a 4 by 4 quadric: the sum of the outer products of the planes of
 * its incident triangles. The cost of contracting an edge is the quadratic
 * form of the merged quadric at the best replacement point, found by solving
 * a small linear system. The cheapest valid edge is contracted repeatedly,
 * its quadric is added to the survivor, and degenerate triangles are removed
 * until the target face count is reached.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(F^2 log F) with a rescan of all faces at each contraction
 *   Space: O(V + F) for quadrics, positions, and faces
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Mesh vertices are drawn as points using their x and y coordinates.
 *   - Edges of the current mesh connect the surviving vertices.
 *   - Each frame highlights the contracted pair and reports its error.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point3 = [number, number, number];
type Quad = number[][];

const CUBE_VERTICES: Point3[] = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const CUBE_FACES: number[][] = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
];

function zeroQuad(): Quad {
    return Array.from({ length: 4 }, () => new Array<number>(4).fill(0));
}

function addQuads(left: Quad, right: Quad): Quad {
    return left.map((row, rowIndex) => row.map((value, colIndex) => value + (right[rowIndex] as number[])[colIndex]));
}

/** Add the outer product of a triangle's normalized plane to each vertex quadric. */
function addPlane(quad: Quad, a: Point3, b: Point3, c: Point3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) {
        return;
    }
    nx /= length;
    ny /= length;
    nz /= length;
    const plane = [nx, ny, nz, -(nx * a[0] + ny * a[1] + nz * a[2])];
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
            quad[row][col] = (quad[row][col] as number) + plane[row] * plane[col];
        }
    }
}

function errorAt(quad: Quad, point: Point3): number {
    const v = [point[0], point[1], point[2], 1];
    let total = 0;
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
            total += v[row] * (quad[row][col] as number) * v[col];
        }
    }
    return Math.max(0, total);
}

function determinant3(m: number[][]): number {
    return (m[0][0] as number) * ((m[1][1] as number) * (m[2][2] as number) - (m[1][2] as number) * (m[2][1] as number))
        - (m[0][1] as number) * ((m[1][0] as number) * (m[2][2] as number) - (m[1][2] as number) * (m[2][0] as number))
        + (m[0][2] as number) * ((m[1][0] as number) * (m[2][1] as number) - (m[1][1] as number) * (m[2][0] as number));
}

/** Find the replacement point minimizing the merged quadric, with safe fallbacks. */
function optimalPoint(quad: Quad, a: Point3, b: Point3): { point: Point3; error: number } {
    const matrix = [
        [quad[0][0], quad[0][1], quad[0][2]],
        [quad[1][0], quad[1][1], quad[1][2]],
        [quad[2][0], quad[2][1], quad[2][2]],
    ];
    const det = determinant3(matrix);
    if (Math.abs(det) > 1e-12) {
        const rhs = [-(quad[0][3] as number), -(quad[1][3] as number), -(quad[2][3] as number)];
        const solveWith = (column: number): number => {
            const replaced = matrix.map((row) => row.slice());
            for (let row = 0; row < 3; row += 1) {
                replaced[row][column] = rhs[row];
            }
            return determinant3(replaced) / det;
        };
        const point: Point3 = [solveWith(0), solveWith(1), solveWith(2)];
        if (point.every((value) => Number.isFinite(value))) {
            return { point, error: errorAt(quad, point) };
        }
    }
    const midpoint: Point3 = [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2,
    ];
    const candidates = [midpoint, a, b];
    let best = candidates[0] as Point3;
    let bestError = errorAt(quad, best);
    for (const candidate of candidates.slice(1)) {
        const error = errorAt(quad, candidate);
        if (error < bestError) {
            best = candidate;
            bestError = error;
        }
    }
    return { point: best, error: bestError };
}

function meshEntities(
    positions: Point3[],
    removed: Set<number>,
    highlight: number[],
): VisualEntity[] {
    return positions.map((point, index) => ({
        id: `vertex-${index}`,
        type: "node" as const,
        label: String(index),
        value: point,
        state: (highlight.includes(index) ? "comparing" : removed.has(index) ? "visited" : "sorted") as EntityState,
        x: point[0],
        y: point[1],
        width: 0,
        height: 0,
        metadata: { index, z: point[2] },
    }));
}

function meshEdges(faces: number[][]): VisualEdge[] {
    const seen = new Set<string>();
    const edges: VisualEdge[] = [];
    for (const face of faces) {
        for (let i = 0; i < 3; i += 1) {
            const a = face[i] as number;
            const b = face[(i + 1) % 3] as number;
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            edges.push({
                id: `edge-${key}`,
                sourceId: `vertex-${a}`,
                targetId: `vertex-${b}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number[][]; faces?: number[][]; targetFaces?: number } | null) ?? {};
    const vertices: Point3[] = Array.isArray(task.vertices) && task.vertices.length > 0
        ? (task.vertices as number[][]).map((point) => [Number(point[0]), Number(point[1]), Number(point[2])])
        : CUBE_VERTICES.map((point) => point.slice() as Point3);
    const faces: number[][] = Array.isArray(task.faces)
        ? (task.faces as number[][]).map((face) => face.map((index) => Math.floor(Number(index)))).filter((face) => face.length === 3)
        : CUBE_FACES.map((face) => face.slice());
    const targetFaces = Math.max(0, Math.floor(Number(task.targetFaces) || 4));

    const positions = vertices.map((point) => point.slice() as Point3);
    const quads = vertices.map(() => zeroQuad());
    for (const face of faces) {
        const a = positions[face[0] as number];
        const b = positions[face[1] as number];
        const c = positions[face[2] as number];
        if (!a || !b || !c) {
            continue;
        }
        for (const index of face) {
            const quad = quads[index as number];
            if (quad) {
                addPlane(quad, a, b, c);
            }
        }
    }

    const removed = new Set<number>();
    let currentFaces = faces.filter((face) => face.every((index) => index >= 0 && index < vertices.length));
    const contracted: { pair: number[]; error: number; point: Point3 }[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: meshEntities(positions, removed, []),
        edges: meshEdges(currentFaces),
        description: `Simplify ${currentFaces.length} triangle(s) with quadric error metrics toward ${targetFaces} face(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { faces: currentFaces.length, targetFaces, contractions: 0, errors: [] },
    };
    step += 1;

    while (currentFaces.length > targetFaces) {
        const edgeMap = new Map<string, [number, number]>();
        for (const face of currentFaces) {
            for (let i = 0; i < 3; i += 1) {
                const a = face[i] as number;
                const b = face[(i + 1) % 3] as number;
                if (removed.has(a) || removed.has(b)) {
                    continue;
                }
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                if (!edgeMap.has(key)) {
                    edgeMap.set(key, [Math.min(a, b), Math.max(a, b)]);
                }
            }
        }
        const candidates: { a: number; b: number; error: number; point: Point3 }[] = [];
        for (const [a, b] of edgeMap.values()) {
            const merged = addQuads(quads[a] as Quad, quads[b] as Quad);
            const solution = optimalPoint(merged, positions[a] as Point3, positions[b] as Point3);
            candidates.push({ a, b, error: solution.error, point: solution.point });
        }
        if (candidates.length === 0) {
            break;
        }
        candidates.sort((left, right) => left.error - right.error || left.a - right.a || left.b - right.b);
        const chosen = candidates[0] as { a: number; b: number; error: number; point: Point3 };

        quads[chosen.a] = addQuads(quads[chosen.a] as Quad, quads[chosen.b] as Quad);
        positions[chosen.a] = chosen.point;
        removed.add(chosen.b);
        currentFaces = currentFaces
            .map((face) => face.map((index) => (index === chosen.b ? chosen.a : index)))
            .filter((face) => new Set(face).size === 3);
        contracted.push({ pair: [chosen.a, chosen.b], error: chosen.error, point: chosen.point });

        yield {
            stepNumber: step,
            entities: meshEntities(positions, removed, [chosen.a, chosen.b]),
            edges: meshEdges(currentFaces),
            description: `Contracted edge ${chosen.b} into ${chosen.a} with quadric error ${chosen.error.toFixed(4)}; ${currentFaces.length} face(s) remain.`,
            codeLineNumber: 5,
            layout: "point",
            meta: {
                faces: currentFaces.length,
                targetFaces,
                contractions: contracted.length,
                errors: contracted.map((entry) => entry.error),
                pair: [chosen.a, chosen.b],
                error: chosen.error,
                point: chosen.point,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: meshEntities(positions, removed, []),
        edges: meshEdges(currentFaces),
        description: `Simplification stopped with ${currentFaces.length} face(s) after ${contracted.length} contraction(s).`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            faces: currentFaces.length,
            targetFaces,
            contractions: contracted.length,
            errors: contracted.map((entry) => entry.error),
            faceList: currentFaces.map((face) => face.slice()),
            removed: [...removed],
        },
    };
}

/** The quadric error metrics module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A triangle's plane says where its surface is. Adding the squared distance to that plane for every incident triangle gives each vertex a quadratic score for any candidate position. Contract the edge whose merged score is smallest, move the surviving vertex to the minimizing point, and throw away triangles that collapsed. Repeat until the mesh is small enough.",
        invariants: [
            "A removed vertex never appears again in a live triangle.",
            "Each surviving vertex quadric is the sum of the original plane quadrics of all vertices mapped to it.",
            "The reported contraction error is the merged quadric evaluated at the chosen replacement point.",
            "Every retained triangle has three distinct vertex indices.",
        ],
        correctness:
            "The quadratic form of a summed plane outer product equals the sum of squared distances to those planes, so minimizing it finds the point closest to all incident surfaces in a least-squares sense. Choosing the smallest such cost at every step is the greedy QEM rule. Removing collapsed triangles keeps the face list a valid simplicial complex, and the quadric transfer preserves the geometry of every original face at the survivor.",
        complexityRationale:
            "At each contraction the algorithm scans all faces to rebuild the edge list, so with F faces and a constant number of contractions per removed face, the total work is O(F^2 log F) including sorting. Storing one four by four quadric per vertex and the face list uses O(V + F) space.",
        uses: [
            "Level-of-detail meshes in games and simulations",
            "Decimating scanned or CAD models for real-time rendering",
            "Progressive mesh transmission over the network",
        ],
        references: [
            "Garland and Heckbert, Surface Simplification Using Quadric Error Metrics, 1997",
            "Garland and Heckbert, Fast Polygonal Approximation of Terrains, 1995",
        ],
        workedExample:
            "A cube has 8 vertices and 12 triangles. Each vertex quadric is the sum of the three plane outer products at that corner. The cheapest edges are the cube's twelve equal-length edges; contracting one merges two corner quadrics into the survivor and removes the two triangles that shared the edge. Repeating this a few times yields a coarser closed shape.",
    },
    id: "quadric-error-metrics",
    name: "Quadric Error Metrics Mesh Simplification",
    category: "geometry",
    complexity: { time: "O(F^2 log F)", space: "O(V + F)" },
    defaultInput: {
        vertices: CUBE_VERTICES,
        faces: CUBE_FACES,
        targetFaces: 4,
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute a plane quadric for every triangle and add it to its vertices",
        "build the list of edges from the current faces",
        "while more faces remain than the target",
        "merge the quadrics at each edge's two endpoints",
        "solve for the point minimizing the merged quadric",
        "contract the edge with the smallest error into its lower-index endpoint",
        "replace references and discard triangles with repeated vertices",
        "record the contraction and its error",
        "done: report the simplified mesh and contraction history",
    ],
};

export default module;
