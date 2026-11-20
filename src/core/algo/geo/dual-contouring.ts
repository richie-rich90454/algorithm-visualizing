/**
 * dual-contouring.ts - Isosurface extraction by dual vertices on grid cubes.
 *
 * For each cube whose corners straddle the iso value, dual contouring places a
 * single vertex near the crossing (here the average of the edge intersections,
 * a simple quadratic-error minimizer) and connects vertices of neighboring
 * cubes whose shared face is crossed. The resulting mesh is the dual of the
 * primal marching-cubes surface and avoids sliver triangles.
 *
 * Time: O(nx * ny * nz) cubes with twelve edge tests each. Space: O(cubes).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Vec3 = [number, number, number];

const CORNERS: Vec3[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
];
const CUBE_EDGES: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
];
const FACE_CORNERS: number[][] = [
    [0, 1, 2, 3], // z low
    [4, 5, 6, 7], // z high
    [0, 1, 5, 4], // y low
    [3, 2, 6, 7], // y high
    [0, 3, 7, 4], // x low
    [1, 2, 6, 5], // x high
];
const NEIGHBOR_DIRS: Vec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
];

function project(v: Vec3): [number, number] {
    return [v[0] + 0.4 * v[2], v[1] + 0.3 * v[2]];
}

function node(id: string, p: [number, number], state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: p,
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        dims?: [number, number, number];
        center?: Vec3;
        radius?: number;
        iso?: number;
        field?: number[];
    } | null) ?? {};
    const dims: Vec3 = task.dims ?? [5, 5, 5];
    const [nx, ny, nz] = dims;
    const center: Vec3 = task.center ?? [2, 2, 2];
    const radius = typeof task.radius === "number" ? task.radius : 1.6;
    const iso = typeof task.iso === "number" ? task.iso : 0;
    const field: number[] | null = task.field ?? null;

    const valueAt = (x: number, y: number, z: number): number => {
        if (field) return field[(z * ny + y) * nx + x] as number;
        return radius - Math.hypot(x - center[0], y - center[1], z - center[2]);
    };
    const cubeIndex = (i: number, j: number, k: number): number => (k * (ny - 1) + j) * (nx - 1) + i;
    const fromIndex = (index: number): Vec3 => [
        index % (nx - 1),
        Math.floor(index / (nx - 1)) % (ny - 1),
        Math.floor(index / ((nx - 1) * (ny - 1))),
    ];

    const active: number[] = [];
    const vertices3D: Vec3[] = [];
    for (let k = 0; k < nz - 1; k += 1) {
        for (let j = 0; j < ny - 1; j += 1) {
            for (let i = 0; i < nx - 1; i += 1) {
                const cornerValues = CORNERS.map((d) => valueAt(i + d[0], j + d[1], k + d[2]));
                const signs = cornerValues.map((v) => v >= iso);
                if (signs.every((s) => s) || signs.every((s) => !s)) continue;
                let sx = 0;
                let sy = 0;
                let sz = 0;
                let count = 0;
                for (const [a, b] of CUBE_EDGES) {
                    if (signs[a] === signs[b]) continue;
                    const va = cornerValues[a] as number;
                    const vb = cornerValues[b] as number;
                    const t = Math.abs(vb - va) < 1e-12 ? 0.5 : (iso - va) / (vb - va);
                    const da = CORNERS[a] as Vec3;
                    const db = CORNERS[b] as Vec3;
                    const p: Vec3 = [
                        i + da[0] + t * (db[0] - da[0]),
                        j + da[1] + t * (db[1] - da[1]),
                        k + da[2] + t * (db[2] - da[2]),
                    ];
                    sx += p[0];
                    sy += p[1];
                    sz += p[2];
                    count += 1;
                }
                active.push(cubeIndex(i, j, k));
                vertices3D.push([sx / count, sy / count, sz / count]);
            }
        }
    }

    const vertexOf = new Map<number, number>();
    active.forEach((cube, index) => vertexOf.set(cube, index));
    const dualEdges: Array<[number, number]> = [];
    for (let a = 0; a < active.length; a += 1) {
        const cube = active[a] as number;
        const [i, j, k] = fromIndex(cube);
        for (const dir of NEIGHBOR_DIRS) {
            const ni = i + dir[0];
            const nj = j + dir[1];
            const nk = k + dir[2];
            if (ni >= nx - 1 || nj >= ny - 1 || nk >= nz - 1) continue;
            const neighbor = cubeIndex(ni, nj, nk);
            const b = vertexOf.get(neighbor);
            if (b === undefined) continue;
            const face = dir[0] === 1
                ? (FACE_CORNERS[5] as number[])
                : dir[1] === 1
                  ? (FACE_CORNERS[3] as number[])
                  : (FACE_CORNERS[1] as number[]);
            const cornerSigns = face.map((offset) => {
                const d = CORNERS[offset] as Vec3;
                return valueAt(i + d[0], j + d[1], k + d[2]) >= iso;
            });
            if (cornerSigns.every((s) => s) || cornerSigns.every((s) => !s)) continue;
            dualEdges.push([a, b]);
        }
    }

    const projected = vertices3D.map(project);
    const finalMeta = {
        iso,
        dims,
        activeCubes: active,
        vertices2D: projected.flatMap((p) => [p[0], p[1]]),
        vertices3D: vertices3D.flat(),
        dualEdges: dualEdges.flat(),
        cubeCount: active.length,
        edgeCount: dualEdges.length,
    };
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Scanning ${(nx - 1) * (ny - 1) * (nz - 1)} cubes for iso value ${iso}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { ...finalMeta, activeCubes: [], vertices2D: [], vertices3D: [], dualEdges: [], cubeCount: 0, edgeCount: 0 },
    };
    step += 1;

    const shown = Math.min(12, active.length);
    for (let s = 0; s < shown; s += 1) {
        const nodes = projected.slice(0, s + 1).map((p, index) =>
            node(`v-${index}`, p, index === s ? "active" : "visited", String(active[index])),
        );
        yield {
            stepNumber: step,
            entities: nodes,
            edges: [],
            description: `Cube ${active[s]} straddles the surface; placed dual vertex ${s + 1}/${active.length}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { ...finalMeta, vertices2D: projected.slice(0, s + 1).flatMap((p) => [p[0], p[1]]), dualEdges: [] },
        };
        step += 1;
    }

    const entities = projected.map((p, index) => node(`v-${index}`, p, "sorted", String(active[index])));
    const edges: VisualEdge[] = dualEdges.map(([a, b], index) => ({
        id: `d-${index}`,
        sourceId: `v-${a}`,
        targetId: `v-${b}`,
        label: "",
        state: "path" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities,
        edges,
        description: `Done: ${active.length} dual vertices and ${dualEdges.length} connecting edges.`,
        codeLineNumber: 6,
        layout: "point",
        meta: finalMeta,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Where marching cubes places many small triangles on a grid cube, dual contouring places one representative vertex per crossed cube and connects vertices of neighboring cubes. Averaging the edge crossings gives a vertex near the surface, and the links form a mesh with far fewer skinny triangles.",
        invariants: [
            "A cube receives a vertex only when its corners have both signs.",
            "A dual vertex lies at the average of the cube's iso-crossing edge points.",
            "Two cube vertices are linked only across a face the surface actually crosses.",
        ],
        correctness:
            "Every cube intersecting the surface has mixed corner signs by the intermediate value property of a continuous field, so the sign test finds all of them and no others. The averaged intersection point lies inside the convex hull of the true crossings and therefore near the surface. Linking neighboring crossed cubes across a crossed shared face makes the dual graph follow the surface topology, producing a connected approximation of the isosurface.",
        complexityRationale:
            "There are (nx-1)(ny-1)(nz-1) cubes, each testing eight corners and twelve edges, so time is O(nx * ny * nz). Active cubes, their vertices and the dual edge list use space proportional to the number of surface cubes.",
        uses: [
            "Extracting smooth surfaces from volumetric medical scans",
            "Terrain and scientific isosurface visualization",
            "Adaptive mesh generation from implicit functions",
        ],
        references: [
            "Ju, Losasso, Schaefer, and Warren, Dual Contouring of Hermite Data, ACM Transactions on Graphics, 2002",
            "Lorensen and Cline, Marching Cubes, Computer Graphics, 1987",
        ],
        workedExample:
            "On a 5 by 5 by 5 grid with a sphere of radius 1.6 centered at (2,2,2), every cube along the shell has corners inside and outside the sphere. Each such cube contributes one vertex near the spherical surface, and neighboring shell cubes are linked, forming a coarse closed mesh.",
    },
    id: "dual-contouring",
    name: "Dual Contouring",
    category: "geometry",
    complexity: { time: "O(nx * ny * nz)", space: "O(cubes)" },
    defaultInput: { dims: [5, 5, 5], center: [2, 2, 2], radius: 1.6, iso: 0 },
    visualType: "point",
    run,
    pseudocode: [
        "scan every grid cube",
        "read the sign of each of its eight corners",
        "skip cubes whose corners all share a sign",
        "average the iso crossings on its twelve edges",
        "store the resulting dual vertex",
        "link vertices of neighboring cubes across crossed faces",
        "project the mesh for display",
        "done: return the dual isosurface mesh",
    ],
};

export default module;
