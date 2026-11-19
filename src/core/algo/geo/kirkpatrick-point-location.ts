/**
 * kirkpatrick-point-location.ts - Kirkpatrick Hierarchical Point Location
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a triangulation whose outer face is a fixed triangle, Kirkpatrick's
 * method removes a low-degree interior vertex, retriangulates the resulting
 * hole, and repeats until only a coarse triangulation remains. Each coarse
 * triangle records the finer triangles it covers, forming a DAG. A query walks
 * down that DAG: starting from the triangle of the coarsest level containing
 * the point, it tests only the few finer triangles beneath it until it reaches
 * the original triangulation. This is distinct from the slab and trapezoidal
 * map point-location modules already in the catalog.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) preprocessing, O(log n) expected query with balanced removal
 *   Space: O(n) for the hierarchy levels and triangle mappings
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type Tri = [number, number, number];

/** Twice the signed area of the triangle with these three points. */
function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** True when point p lies in or on triangle (a, b, c). */
function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    const hasNeg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
    const hasPos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
    return !(hasNeg && hasPos);
}

/** Stable key for a triangle of vertex indices. */
function triKey(tri: Tri): string {
    return tri.slice().sort((a, b) => a - b).join("-");
}

/** Centroid of a triangle in point coordinates. */
function centroid(tri: Tri, points: Point[]): Point {
    const a = points[tri[0]] as Point;
    const b = points[tri[1]] as Point;
    const c = points[tri[2]] as Point;
    return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
}

/** Angular sort of the neighbor cycle around a removed vertex. */
function orderNeighbors(neighbors: number[], center: Point, points: Point[]): number[] {
    return neighbors.slice().sort((x, y) => {
        const px = points[x] as Point;
        const py = points[y] as Point;
        const ax = Math.atan2(px[1] - center[1], px[0] - center[0]);
        const ay = Math.atan2(py[1] - center[1], py[0] - center[0]);
        return ax - ay;
    });
}

/** Build the initial triangulation by inserting interior points one by one. */
function buildInitial(points: Point[]): Tri[] {
    let triangles: Tri[] = [[0, 1, 2]];
    for (let i = 3; i < points.length; i += 1) {
        const p = points[i] as Point;
        let replaced = false;
        for (let t = 0; t < triangles.length; t += 1) {
            const tri = triangles[t] as Tri;
            const a = points[tri[0]] as Point;
            const b = points[tri[1]] as Point;
            const c = points[tri[2]] as Point;
            if (inTriangle(p, a, b, c)) {
                triangles.splice(t, 1, [tri[0], tri[1], i], [tri[1], tri[2], i], [tri[2], tri[0], i]);
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            // Point outside the outer triangle: ignore it for the hierarchy.
            continue;
        }
    }
    return triangles;
}

type Removal = {
    vertex: number;
    incident: Tri[];
    children: Map<string, string[]>;
};

/** Build all hierarchy levels by repeatedly removing low-degree interior vertices. */
function buildHierarchy(points: Point[]): { levels: Tri[][]; removals: Removal[] } {
    const levels: Tri[][] = [buildInitial(points)];
    const removals: Removal[] = [];
    for (let depth = 0; depth < points.length; depth += 1) {
        const current = levels[levels.length - 1] as Tri[];
        const degrees = new Map<number, number>();
        for (const tri of current) {
            for (const index of tri) {
                if (index >= 3) {
                    degrees.set(index, (degrees.get(index) ?? 0) + 1);
                }
            }
        }
        let chosen = -1;
        let best = Infinity;
        for (const [vertex, degree] of degrees) {
            if (degree < best) {
                best = degree;
                chosen = vertex;
            }
        }
        if (chosen < 0 || best > 8) {
            break;
        }

        const incident = current.filter((tri) => tri.includes(chosen));
        const neighborSet = new Set<number>();
        for (const tri of incident) {
            for (const index of tri) {
                if (index !== chosen) {
                    neighborSet.add(index);
                }
            }
        }
        const center = points[chosen] as Point;
        const neighbors = orderNeighbors([...neighborSet], center, points);
        const kept = current.filter((tri) => !tri.includes(chosen));
        const fan: Tri[] = [];
        for (let i = 1; i < neighbors.length - 1; i += 1) {
            fan.push([neighbors[0] as number, neighbors[i] as number, neighbors[i + 1] as number]);
        }

        const children = new Map<string, string[]>();
        for (const tri of kept) {
            children.set(triKey(tri), [triKey(tri)]);
        }
        for (const coarse of fan) {
            const a = points[coarse[0]] as Point;
            const b = points[coarse[1]] as Point;
            const c = points[coarse[2]] as Point;
            const covered = incident
                .filter((fine) => {
                    const p = centroid(fine, points);
                    return inTriangle(p, a, b, c);
                })
                .map(triKey);
            children.set(triKey(coarse), covered);
        }

        levels.push(kept.concat(fan));
        removals.push({ vertex: chosen, incident: incident.slice(), children });
    }
    return { levels, removals };
}

/** Locate the query by descending through the hierarchy. */
function descend(
    levels: Tri[][],
    removals: Removal[],
    points: Point[],
    query: Point,
): { path: Tri[]; leaf: Tri | null } {
    const top = levels[levels.length - 1] as Tri[];
    let current: Tri | null = null;
    for (const tri of top) {
        const a = points[tri[0]] as Point;
        const b = points[tri[1]] as Point;
        const c = points[tri[2]] as Point;
        if (inTriangle(query, a, b, c)) {
            current = tri;
            break;
        }
    }
    if (!current) {
        return { path: [], leaf: null };
    }
    const path: Tri[] = [current];
    for (let k = removals.length - 1; k >= 0; k -= 1) {
        const removal = removals[k] as Removal;
        const candidates: string[] = removal.children.get(triKey(current as Tri)) ?? [triKey(current as Tri)];
        const level = levels[k] as Tri[];
        let next: Tri | null = null;
        for (const tri of level) {
            if (!candidates.includes(triKey(tri))) {
                continue;
            }
            const a = points[tri[0]] as Point;
            const b = points[tri[1]] as Point;
            const c = points[tri[2]] as Point;
            if (inTriangle(query, a, b, c)) {
                next = tri;
                break;
            }
        }
        if (!next) {
            next = level.find((tri) => candidates.includes(triKey(tri))) ?? null;
        }
        if (!next) {
            break;
        }
        current = next;
        path.push(current);
    }
    return { path, leaf: current };
}

function makeEntities(points: Point[], active: Set<number>, highlight: number): VisualEntity[] {
    return points.map((p, i) => ({
        id: `point-${i}`,
        type: "node" as const,
        label: String(i),
        value: p,
        state: (active.has(i) ? "active" : i < 3 ? "sorted" : "unvisited") as EntityState,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function triangleEdges(tri: Tri, prefix: string, state: EntityState): VisualEdge[] {
    const result: VisualEdge[] = [];
    for (let i = 0; i < 3; i += 1) {
        result.push({
            id: `${prefix}-${i}`,
            sourceId: `point-${tri[i]}`,
            targetId: `point-${tri[(i + 1) % 3]}`,
            label: "",
            state,
            directed: false,
        });
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; query?: Point } | null) ?? {};
    const points: Point[] = (task.points ?? [
        [0, 0], [12, 0], [6, 10], [6, 5], [4, 2], [8, 2], [6, 2], [5, 4], [7, 4],
    ]).map((p) => [p[0], p[1]] as Point);
    const query: Point = task.query ?? [6, 3];
    let step = 0;

    if (points.length < 4) {
        yield {
            stepNumber: step,
            entities: makeEntities(points, new Set(), -1),
            edges: [],
            description: "Kirkpatrick location needs an outer triangle and at least one interior point.",
            codeLineNumber: 0,
            layout: "point",
            meta: { degenerate: true, levels: 0 },
        };
        return;
    }

    const { levels, removals } = buildHierarchy(points);
    yield {
        stepNumber: step,
        entities: makeEntities(points, new Set(), -1),
        edges: levels[0]?.flatMap((tri, i) => triangleEdges(tri, `t0-${i}`, "idle")) ?? [],
        description: `Initial triangulation has ${levels[0]?.length ?? 0} triangles over ${points.length} vertices.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { levels: levels.length, triangles: levels[0]?.length ?? 0, phase: "initial" },
    };
    step += 1;

    for (let k = 0; k < removals.length; k += 1) {
        const removal = removals[k] as Removal;
        yield {
            stepNumber: step,
            entities: makeEntities(points, new Set([removal.vertex]), removal.vertex),
            edges: (levels[k + 1] ?? []).flatMap((tri, i) => triangleEdges(tri, `t${k + 1}-${i}`, "path")),
            description: `Removed interior vertex ${removal.vertex} and retriangulated its hole; level ${k + 1} has ${levels[k + 1]?.length ?? 0} triangles.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { level: k + 1, removed: removal.vertex, triangles: levels[k + 1]?.length ?? 0 },
        };
        step += 1;
    }

    const { path, leaf } = descend(levels, removals, points, query);
    for (let k = 0; k < path.length; k += 1) {
        const tri = path[k] as Tri;
        yield {
            stepNumber: step,
            entities: makeEntities(points, new Set(tri), -1),
            edges: triangleEdges(tri, `query-${k}`, "path"),
            description: `Query descent at level ${path.length - 1 - k}: the point lies in triangle (${tri.join(", ")}).`,
            codeLineNumber: 6,
            layout: "point",
            meta: { level: path.length - 1 - k, triangle: tri.slice(), query: query.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, new Set(leaf ?? []), -1),
        edges: leaf ? triangleEdges(leaf, "leaf", "sorted") : [],
        description: leaf
            ? `Point (${query[0]}, ${query[1]}) is located in leaf triangle (${leaf.join(", ")}).`
            : `Point (${query[0]}, ${query[1]}) is outside the outer triangle.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { query: query.slice(), leaf: leaf?.slice() ?? [], levels: levels.length, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A triangulation can be made coarser by deleting a low-degree interior vertex and filling the hole with a fan of diagonals. Repeat this to get a small stack of triangulations, each a simplified picture of the one below. Each coarse triangle remembers which finer triangles it covers. To answer a point query, find the triangle containing the point in the coarsest picture, then look only at the children of that triangle in the next picture, and keep going until the original triangulation is reached.",
        invariants: [
            "The outer triangle is never removed, so every level covers the same region.",
            "A removed vertex has small degree, so each coarse triangle covers only a few finer triangles.",
            "Every triangle containing the query at one level has a child triangle at the level below that also contains it.",
        ],
        correctness:
            "Removing a vertex and fanning from one neighbor retriangulates the exact same polygon, so all levels cover the same region. The fan triangles partition the hole, and the centroid of each removed triangle lies in exactly the coarse triangle that covers it, so the child links are correct. By induction the query lies in a linked child at every level; arriving at the finest level gives the triangle of the original triangulation that contains the query.",
        complexityRationale:
            "Each removal touches only the triangles incident to one low-degree vertex, so a whole level costs time proportional to that degree. With a constant degree bound the hierarchy has O(log n) levels after balanced removal, and each query descends through a constant number of child triangles per level, giving O(log n) query time. Storing all levels and links uses O(n) space.",
        uses: [
            "Answering point-in-subdivision queries in geographic information systems",
            "Accelerating mesh navigation in computer graphics and finite element methods",
            "A canonical example of a planning search structure with provable query bounds",
        ],
        references: [
            "Kirkpatrick, Optimal Search in Planar Subdivisions, 1983",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 6",
        ],
        workedExample:
            "Start with a triangle containing five interior points. Remove a low-degree interior vertex and replace its incident triangles with a fan, keeping a link from each new triangle to the old ones it covers. After a few removals only the outer triangle remains. Querying a point, the coarse triangle containing it points to two finer triangles; testing them selects one, and repeating reaches the leaf triangle of the original mesh.",
    },
    id: "kirkpatrick-point-location",
    name: "Kirkpatrick Point Location",
    category: "geometry",
    complexity: { time: "O(log n) query", space: "O(n)" },
    defaultInput: {
        points: [[0, 0], [12, 0], [6, 10], [6, 5], [4, 2], [8, 2], [6, 2], [5, 4], [7, 4]],
        query: [6, 3],
    },
    visualType: "point",
    run,
    pseudocode: [
        "triangulate the region with the outer triangle fixed",
        "while an interior vertex of small degree remains",
        "collect its neighbors in cyclic order around it",
        "delete its incident triangles and fan the hole from one neighbor",
        "link each new triangle to the old triangles it covers",
        "start a query in a triangle of the coarsest level",
        "at each finer level test only the linked child triangles",
        "report the leaf triangle containing the query point",
    ],
};

export default module;
