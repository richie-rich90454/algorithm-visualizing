/**
 * marching-cubes.ts - Isosurface extraction from a 3D scalar grid.
 *
 * Each grid cell with corners straddling the iso value is classified, and the
 * crossing points on its twelve edges are connected into contour loops on the
 * six faces. Those loops are fan-triangulated to build the surface mesh.
 *
 * Time: O(nx * ny * nz). Space: O(triangles).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Vec3 = [number, number, number];

const CORNERS: Vec3[] = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const EDGES: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
];
const FACE_EDGES = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 9, 4, 8],
    [1, 10, 5, 9],
    [2, 11, 6, 10],
    [3, 8, 7, 11],
];

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

/** Connect crossing points around each face and triangulate the resulting loops. */
function cubeMesh(values: number[], coords: Vec3[], iso: number): { triangles: Vec3[][]; crossing: number } {
    const points: Array<Vec3 | undefined> = new Array(12);
    for (let e = 0; e < EDGES.length; e += 1) {
        const [a, b] = EDGES[e]!;
        const va = values[a]!;
        const vb = values[b]!;
        if ((va < iso) !== (vb < iso)) {
            const t = (iso - va) / (vb - va);
            points[e] = lerp(coords[a]!, coords[b]!, t);
        }
    }
    const adjacency = new Map<number, number[]>();
    const connect = (a: number, b: number): void => {
        if (!adjacency.has(a)) adjacency.set(a, []);
        if (!adjacency.has(b)) adjacency.set(b, []);
        adjacency.get(a)!.push(b);
        adjacency.get(b)!.push(a);
    };
    for (const face of FACE_EDGES) {
        const hits = face.filter((e) => points[e] !== undefined);
        for (let pair = 0; pair + 1 < hits.length; pair += 2) {
            connect(hits[pair]!, hits[pair + 1]!);
        }
    }
    const triangles: Vec3[][] = [];
    const visited = new Set<number>();
    for (const start of adjacency.keys()) {
        if (visited.has(start)) continue;
        const cycle: number[] = [];
        let current: number | undefined = start;
        let previous = -1;
        while (current !== undefined && !visited.has(current)) {
            visited.add(current);
            cycle.push(current);
            const neighbors = adjacency.get(current) as number[];
            const next: number | undefined = neighbors.find((n: number) => n !== previous);
            previous = current;
            current = next;
        }
        for (let k = 1; k + 1 < cycle.length; k += 1) {
            const a = points[cycle[0]!]!;
            const b = points[cycle[k]!]!;
            const c = points[cycle[k + 1]!]!;
            triangles.push([a, b, c]);
        }
    }
    return { triangles, crossing: points.filter((p) => p !== undefined).length };
}

/** Project a 3D sample to a 2D location for the point layout. */
function project(p: Vec3): [number, number] {
    return [p[0] - 0.5 * p[2], p[1] - 0.35 * p[2]];
}

function sphereGrid(size: number, center: number, radius: number): number[][][] {
    return Array.from({ length: size }, (_, x) =>
        Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, z) => Math.hypot(x - center, y - center, z - center) - radius),
        ),
    );
}

/** The marching cubes generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: number[][][]; iso?: number } | null) ?? {};
    const grid: number[][][] = task.grid ?? sphereGrid(5, 2, 1.6);
    const iso = task.iso ?? 0;
    const nx = grid.length;
    const ny = grid[0]?.length ?? 0;
    const nz = grid[0]?.[0]?.length ?? 0;
    let step = 0;

    const allTriangles: Vec3[][] = [];
    const crossingCounts: number[] = [];
    const perCubeTriangles: number[] = [];
    for (let i = 0; i + 1 < nx; i += 1) {
        for (let j = 0; j + 1 < ny; j += 1) {
            for (let k = 0; k + 1 < nz; k += 1) {
                const coords = CORNERS.map((c) => [i + c[0], j + c[1], k + c[2]] as Vec3);
                const values = CORNERS.map((c) => grid[i + c[0]]![j + c[1]]![k + c[2]]!);
                const mesh = cubeMesh(values, coords, iso);
                crossingCounts.push(mesh.crossing);
                perCubeTriangles.push(mesh.triangles.length);
                allTriangles.push(...mesh.triangles);
            }
        }
    }

    const vertexIds = new Map<string, number>();
    const vertices: Vec3[] = [];
    for (const tri of allTriangles) {
        for (const v of tri) {
            const key = `${v[0].toFixed(6)},${v[1].toFixed(6)},${v[2].toFixed(6)}`;
            if (!vertexIds.has(key)) {
                vertexIds.set(key, vertices.length);
                vertices.push(v);
            }
        }
    }

    const emit = (shownTriangles: number, description: string, codeLineNumber: number, final: boolean): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const used = new Set<number>();
        for (let t = 0; t < shownTriangles; t += 1) {
            const tri = allTriangles[t]!;
            const ids = tri.map((v) => {
                const key = `${v[0].toFixed(6)},${v[1].toFixed(6)},${v[2].toFixed(6)}`;
                return vertexIds.get(key)!;
            });
            ids.forEach((id) => used.add(id));
            for (let s = 0; s < 3; s += 1) {
                edges.push({
                    id: `tri-${t}-${s}`,
                    sourceId: `v-${ids[s]!}`,
                    targetId: `v-${ids[(s + 1) % 3]!}`,
                    label: "",
                    state: final ? "path" : "comparing",
                    directed: false,
                });
            }
        }
        for (const id of used) {
            const p = vertices[id]!;
            const at = project(p);
            entities.push({
                id: `v-${id}`,
                type: "node",
                label: "",
                value: p,
                state: final ? "sorted" : "active",
                x: at[0],
                y: -at[1],
                width: 0,
                height: 0,
                metadata: { index: id },
            });
        }
        const flat: number[] = [];
        for (let t = 0; t < shownTriangles; t += 1) {
            for (const v of allTriangles[t]!) flat.push(v[0], v[1], v[2]);
        }
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: {
                triangles: flat,
                crossingCounts,
                triangleCount: shownTriangles,
                cubeCount: crossingCounts.length,
                bounds: [nx, ny, nz, iso],
            },
        };
    };

    if (nx < 2 || ny < 2 || nz < 2) {
        yield emit(0, "Marching cubes: a grid smaller than two in each axis has no cubes.", 0, true);
        return;
    }

    yield emit(0, `Marching cubes: ${crossingCounts.length} cells scanned at iso ${iso}.`, 0, false);
    let cumulative = 0;
    for (let c = 0; c < crossingCounts.length; c += 1) {
        cumulative += perCubeTriangles[c]!;
        yield emit(
            cumulative,
            `Marching cubes: processed cell ${c + 1} of ${crossingCounts.length}, ${cumulative} triangles so far.`,
            2,
            false,
        );
    }
    yield emit(allTriangles.length, `Marching cubes: extracted ${allTriangles.length} triangles.`, 5, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Marching cubes turns a scalar field into a surface by visiting each little cube of the grid. Corners are marked inside or outside the target value, and the edges where the sign flips give points on the surface. Connecting those points around each cube face produces loops, which are split into triangles to form the mesh.",
        invariants: [
            "A surface vertex lies on a cube edge whose corner values straddle the iso value.",
            "Every cube face has an even number of crossing edges.",
            "Faces connect crossing points so that every vertex meets two face segments.",
        ],
        correctness:
            "Along an edge whose endpoint values straddle the iso value, the scalar varies continuously and linearly, so exactly one interpolated point has that value; linear interpolation finds it. Around any face, the number of sign changes is even, so crossing points can be paired into contour segments. Each cube edge belongs to two faces, so every crossing point has degree two in the face graph and the graph decomposes into cycles, which fan triangulation converts into triangles covering the same surface patch.",
        complexityRationale:
            "The algorithm visits (nx-1)(ny-1)(nz-1) cubes and performs a constant number of edge and face tests per cube, so time is linear in the number of cells. Space is proportional to the number of extracted triangles and vertices.",
        uses: [
            "Reconstructing organ surfaces from medical CT or MRI scans",
            "Rendering implicit functions and metaballs",
            "Generating meshes from signed distance fields",
        ],
        references: [
            "Lorensen and Cline, Marching Cubes: A High Resolution 3D Surface Construction Algorithm, 1987",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 10",
        ],
        workedExample:
            "On a 5 by 5 by 5 grid holding the values of a sphere centered at (2,2,2) with radius 1.6, cubes near the shell have some corners inside and some outside. Each of those cubes produces a small loop of crossing points and one or two triangles, and the triangles together approximate the sphere surface.",
    },
    id: "marching-cubes",
    name: "Marching Cubes",
    category: "geometry",
    complexity: { time: "O(nx ny nz)", space: "O(triangles)" },
    defaultInput: {},
    visualType: "point",
    run,
    pseudocode: [
        "for each cube of the scalar grid",
        "mark corners as inside or outside the iso value",
        "interpolate a surface point on every crossing edge",
        "connect crossing points around each cube face",
        "walk the resulting loops and fan-triangulate them",
        "emit the triangles as the extracted surface",
        "done: the triangles approximate the iso surface",
    ],
};

export default module;
