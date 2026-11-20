/**
 * power-diagram.ts - Additively weighted Voronoi diagram by half-plane clipping.
 *
 * The power distance from a point p to a site s with weight w is |p - s|^2 - w.
 * The set of points where site i beats site j is a half-plane bounded by a
 * straight line, so the cell of a site is the intersection of one half-plane
 * per other site. Clipping a bounding box by each half-plane yields every cell
 * exactly, and cells sharing a boundary segment give the adjacency graph.
 *
 *   Time:  O(n^2) for n sites
 *   Space: O(n^2) in the worst case for the polygon vertices
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Site = [number, number, number];
type P2 = [number, number];

function siteNode(site: Site, index: number, state: EntityState = "unvisited"): VisualEntity {
    return {
        id: `s-${index}`,
        type: "node" as const,
        label: `s${index}(w=${site[2]})`,
        value: [site[0], site[1], site[2]],
        state,
        x: site[0],
        y: site[1],
        width: 0,
        height: 0,
        metadata: { index, weight: site[2] },
    };
}

function clip(poly: P2[], a: number, b: number, c: number): P2[] {
    if (poly.length === 0) return [];
    const out: P2[] = [];
    for (let i = 0; i < poly.length; i += 1) {
        const p = poly[i]!;
        const q = poly[(i + 1) % poly.length]!;
        const fp = a * p[0] + b * p[1] - c;
        const fq = a * q[0] + b * q[1] - c;
        if (fp <= 1e-9) out.push(p);
        if ((fp < -1e-9 && fq > 1e-9) || (fp > 1e-9 && fq < -1e-9)) {
            const t = fp / (fp - fq);
            out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
    }
    return out;
}

function bisector(si: Site, sj: Site): [number, number, number] {
    const dx = sj[0] - si[0];
    const dy = sj[1] - si[1];
    const a = 2 * dx;
    const b = 2 * dy;
    const c = sj[0] * sj[0] + sj[1] * sj[1] - si[0] * si[0] - si[1] * si[1] + si[2] - sj[2];
    return [a, b, c];
}

function insideConvex(point: P2, poly: P2[]): boolean {
    let positive = 0;
    let negative = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const p = poly[i]!;
        const q = poly[(i + 1) % poly.length]!;
        const cross = (q[0] - p[0]) * (point[1] - p[1]) - (q[1] - p[1]) * (point[0] - p[0]);
        if (cross > 1e-6) positive += 1;
        if (cross < -1e-6) negative += 1;
    }
    return positive === 0 || negative === 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sites?: Site[] } | null) ?? {};
    const sites: Site[] = task.sites ?? [
        [0, 0, 0],
        [4, 0, 2],
        [0, 4, 0],
        [4, 4, 1],
        [2, 2, 5],
    ];
    let step = 0;
    const frame = (
        entities: VisualEntity[],
        edges: VisualFrame["edges"],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta: { sites: sites.length, ...meta },
    });

    if (sites.length === 0) {
        yield frame([], [], "No sites, so the power diagram is empty.", 0, { cells: [], edges: [] });
        return;
    }
    const xs = sites.map((s) => s[0]);
    const ys = sites.map((s) => s[1]);
    const minX = Math.min(...xs) - 3;
    const maxX = Math.max(...xs) + 3;
    const minY = Math.min(...ys) - 3;
    const maxY = Math.max(...ys) + 3;
    const bounds: P2[] = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];

    yield frame(sites.map((s, i) => siteNode(s, i)), [], `Power diagram of ${sites.length} weighted sites.`, 0);
    step += 1;

    const cells: P2[][] = [];
    for (let i = 0; i < sites.length; i += 1) {
        let poly = bounds.map((p) => [p[0], p[1]] as P2);
        for (let j = 0; j < sites.length; j += 1) {
            if (i === j) continue;
            const [a, b, c] = bisector(sites[i]!, sites[j]!);
            poly = clip(poly, a, b, c);
            if (poly.length === 0) break;
        }
        cells.push(poly);
        const st = sites.map((s, k) => siteNode(s, k, k === i ? "comparing" : "unvisited"));
        yield frame(st, [], `Clipped cell for site ${i}: ${poly.length} vertices.`, 1, {
            current: i,
            vertexCounts: cells.map((p) => p.length),
        });
        step += 1;
    }

    const edges: VisualFrame["edges"] = [];
    for (let i = 0; i < sites.length; i += 1) {
        for (let j = i + 1; j < sites.length; j += 1) {
            const [a, b, c] = bisector(sites[i]!, sites[j]!);
            let shared = false;
            for (const v of cells[i] ?? []) {
                if (Math.abs(a * v[0] + b * v[1] - c) > 1e-4) continue;
                if (insideConvex(v, cells[j] ?? [])) {
                    shared = true;
                    break;
                }
            }
            if (shared) {
                edges.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `s-${i}`,
                    targetId: `s-${j}`,
                    label: "",
                    state: "sorted" as EntityState,
                    directed: false,
                });
            }
        }
    }
    yield frame(
        sites.map((s, i) => siteNode(s, i, "sorted")),
        edges,
        `Power diagram complete: ${cells.filter((c) => c.length > 0).length} cells, ${edges.length} adjacencies.`,
        3,
        {
            cells: cells.map((poly) =>
                poly.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(";"),
            ),
            adjacency: edges.map((e) => `${e.sourceId}-${e.targetId}`),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A power diagram is a Voronoi diagram in which each site carries a weight that pushes its cell outward or inward. The difference between the power distances to two sites is a linear function, so the boundary between their cells is always a straight line. Each cell is therefore the intersection of simple half-planes and can be found by clipping a large bounding box once per other site.",
        invariants: [
            "The power distance from a point p to site s is |p - s| squared minus the weight of s.",
            "Every point of a cell is at least as close in power distance to its site as to every other site.",
            "Two cells share an edge only where their power distances are equal.",
        ],
        correctness:
            "The inequality |p - si|^2 - wi <= |p - sj|^2 - wj expands to a linear half-plane a*x + b*y <= c, so clipping a convex region by it keeps exactly the points nearer to si in power distance. Starting from a box that contains all sites and intersecting all such half-planes yields exactly the cell of si. A point in that cell minimizes power distance over all sites by construction, so the collection of cells partitions the plane and the shared edges give the true adjacencies.",
        complexityRationale:
            "There are n sites and each cell is clipped by n - 1 half-planes, so the construction performs O(n^2) clipping operations. Each clip walks the current polygon, whose size is bounded by a constant on average but can grow to O(n), giving O(n^2) space in the worst case.",
        uses: [
            "Modeling weighted regions such as cell growth with different rates",
            "Computing staggered mesh duals in finite element methods",
            "Weighted nearest-neighbor queries in spatial databases",
        ],
        references: [
            "Aurenhammer, Power Diagrams: Properties, Algorithms and Applications, SIAM Journal on Computing 16 (1987)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 7",
        ],
        workedExample:
            'Take sites at (0,0) with weight 0 and (4,0) with weight 2. The bisector satisfies 8x = 16 + 0 - 2, so x = 1.75. Every point left of that line is nearer in power distance to the first site, and every point right of it is nearer to the second.',
    },
    id: "power-diagram",
    name: "Power Diagram",
    category: "geometry",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: {
        sites: [
            [0, 0, 0],
            [4, 0, 2],
            [0, 4, 0],
            [4, 4, 1],
            [2, 2, 5],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "wrap all sites in a bounding rectangle",
        "for each site: start its cell as the bounding rectangle",
        "for each other site: compute the power bisector line",
        "clip the cell by the half-plane where this site wins",
        "store the resulting convex polygon as the cell",
        "after all cells: detect pairs sharing a boundary segment",
        "report cells and the adjacency graph",
    ],
};

export default module;
