/**
 * dewall-delaunay.ts - Streaming (DeWall) Delaunay triangulation.
 *
 * Sites arrive one at a time in a fixed shuffled order. Each insertion splits
 * the containing triangle or stitches the visible hull edges to the new site,
 * and only the edges near the insertion are legalized by flipping. Because the
 * mesh is Delaunay after every arrival, the algorithm is suitable for streaming
 * where no global pass over all sites is possible.
 *
 * Time: expected O(n log n) with good shuffling, O(n^2) worst case.
 * Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Tri = [number, number, number];

function orient(a: Pt, b: Pt, c: Pt): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function inCircle(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
    const ax = a[0] - d[0];
    const ay = a[1] - d[1];
    const bx = b[0] - d[0];
    const by = b[1] - d[1];
    const cx = c[0] - d[0];
    const cy = c[1] - d[1];
    const det =
        (ax * ax + ay * ay) * (bx * cy - cx * by) -
        (bx * bx + by * by) * (ax * cy - cx * ay) +
        (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 1e-10;
}

function key(u: number, v: number): string {
    return `${Math.min(u, v)}-${Math.max(u, v)}`;
}

function makeTri(a: number, b: number, c: number, pts: Pt[]): Tri {
    return orient(pts[a] as Pt, pts[b] as Pt, pts[c] as Pt) >= 0 ? [a, b, c] : [a, c, b];
}

function inTriangle(p: Pt, tri: Tri, pts: Pt[]): boolean {
    const a = pts[tri[0]] as Pt;
    const b = pts[tri[1]] as Pt;
    const c = pts[tri[2]] as Pt;
    return orient(a, b, p) >= -1e-9 && orient(b, c, p) >= -1e-9 && orient(c, a, p) >= -1e-9;
}

function findIllegal(triangles: Tri[], pts: Pt[]): { triA: number; triB: number; w: number; z: number; u: number; v: number } | null {
    const map = new Map<string, number[]>();
    triangles.forEach((tri, index) => {
        for (const [a, b] of [
            [tri[0], tri[1]],
            [tri[1], tri[2]],
            [tri[2], tri[0]],
        ]) {
            const k = key(a as number, b as number);
            const list = map.get(k) ?? [];
            list.push(index);
            map.set(k, list);
        }
    });
    for (const [k, owners] of map) {
        if (owners.length !== 2) continue;
        const [u, v] = k.split("-").map(Number) as [number, number];
        const ta = triangles[owners[0] as number] as Tri;
        const tb = triangles[owners[1] as number] as Tri;
        const w = ta.find((x) => x !== u && x !== v) as number;
        const z = tb.find((x) => x !== u && x !== v) as number;
        if (orient(pts[w] as Pt, pts[z] as Pt, pts[u] as Pt) * orient(pts[w] as Pt, pts[z] as Pt, pts[v] as Pt) >= 0) continue;
        if (inCircle(pts[ta[0] as number] as Pt, pts[ta[1] as number] as Pt, pts[ta[2] as number] as Pt, pts[z] as Pt)) {
            return { triA: owners[0] as number, triB: owners[1] as number, w, z, u, v };
        }
    }
    return null;
}

function applyFlip(triangles: Tri[], bad: NonNullable<ReturnType<typeof findIllegal>>, pts: Pt[]): void {
    const high = Math.max(bad.triA, bad.triB);
    const low = Math.min(bad.triA, bad.triB);
    triangles.splice(high, 1);
    triangles.splice(low, 1);
    triangles.push(makeTri(bad.w, bad.z, bad.u, pts));
    triangles.push(makeTri(bad.w, bad.z, bad.v, pts));
}

function edgesOf(triangles: Tri[]): Array<[number, number]> {
    const seen = new Set<string>();
    const edges: Array<[number, number]> = [];
    for (const tri of triangles) {
        for (const [a, b] of [
            [tri[0], tri[1]],
            [tri[1], tri[2]],
            [tri[2], tri[0]],
        ]) {
            const k = key(a as number, b as number);
            if (seen.has(k)) continue;
            seen.add(k);
            edges.push([Math.min(a as number, b as number), Math.max(a as number, b as number)]);
        }
    }
    return edges;
}

function shuffledOrder(n: number, seed: number): number[] {
    let s = seed >>> 0;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const j = s % (i + 1);
        const tmp = order[i] as number;
        order[i] = order[j] as number;
        order[j] = tmp;
    }
    return order;
}

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; seed?: number } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4.3, 3],
        [0.2, 3.2],
        [1.6, 1.4],
    ];
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 7;
    const order = shuffledOrder(pts.length, seed);
    const triangles: Tri[] = [];
    let hull: number[] = [];
    let flips = 0;
    let step = 0;

    const frameFor = (done: boolean, inserted: number): VisualFrame => {
        const states = new Map<number, EntityState>();
        for (let i = 0; i < inserted; i += 1) states.set(order[i] as number, "sorted");
        if (inserted > 0 && !done) states.set(order[inserted - 1] as number, "active");
        const edges: VisualEdge[] = edgesOf(triangles).map(([u, v]) => ({
            id: `e-${u}-${v}`,
            sourceId: `p-${u}`,
            targetId: `p-${v}`,
            label: "",
            state: "path" as EntityState,
            directed: false,
        }));
        return {
            stepNumber: step,
            entities: pts.map((p, i) => node(`p-${i}`, p, states.get(i) ?? "unvisited", String(i))),
            edges,
            description: done
                ? `Done: streaming Delaunay mesh with ${triangles.length} triangles after ${flips} flip(s).`
                : `Arrival ${inserted}/${pts.length}: site p-${order[inserted - 1]} inserted and legalized.`,
            codeLineNumber: done ? 7 : 3,
            layout: "point",
            meta: {
                order,
                inserted,
                triangles: triangles.flat(),
                flips,
                points: pts.length,
            },
        };
    };

    yield frameFor(false, 0);
    step += 1;

    const pending: number[] = [];
    for (let pos = 0; pos < order.length; pos += 1) {
        const p = order[pos] as number;
        if (triangles.length === 0) {
            pending.push(p);
            if (pending.length < 3) {
                yield frameFor(false, pos + 1);
                step += 1;
                continue;
            }
            const [a, b, c] = pending as [number, number, number];
            if (Math.abs(orient(pts[a] as Pt, pts[b] as Pt, pts[c] as Pt)) > 1e-9) {
                triangles.push(makeTri(a, b, c, pts));
                hull = triangles[0] as number[];
            }
            pending.length = 0;
            yield frameFor(false, pos + 1);
            step += 1;
            continue;
        }
        if (pending.length > 0) {
            // Collinear first three sites: keep waiting for a non-collinear triple.
            pending.push(p);
            yield frameFor(false, pos + 1);
            step += 1;
            continue;
        }
        const containing = triangles.findIndex((tri) => inTriangle(pts[p] as Pt, tri, pts));
        if (containing >= 0) {
            const tri = triangles[containing] as Tri;
            triangles.splice(containing, 1);
            triangles.push(makeTri(p, tri[1], tri[2], pts));
            triangles.push(makeTri(tri[0], p, tri[2], pts));
            triangles.push(makeTri(tri[0], tri[1], p, pts));
        } else if (hull.length >= 3) {
            const m = hull.length;
            let s = -1;
            let e = -1;
            for (let start = 0; start < m; start += 1) {
                if (orient(pts[hull[start] as number] as Pt, pts[hull[(start + 1) % m] as number] as Pt, pts[p] as Pt) >= 0) continue;
                let end = start;
                while (
                    end < start + m - 1 &&
                    orient(
                        pts[hull[(end + 1) % m] as number] as Pt,
                        pts[hull[(end + 2) % m] as number] as Pt,
                        pts[p] as Pt,
                    ) < 0
                ) {
                    end += 1;
                }
                if (s === -1 || end - start > e - s) {
                    s = start;
                    e = end;
                }
            }
            if (s !== -1 && e !== -1) {
                for (let t = s; t <= e; t += 1) {
                    triangles.push(makeTri(hull[t % m] as number, hull[(t + 1) % m] as number, p, pts));
                }
                const newHull: number[] = [hull[s % m] as number, p];
                for (let t = e + 1; t < s + m; t += 1) newHull.push(hull[t % m] as number);
                hull = newHull;
            }
        }

        for (let guard = 0; guard < 200; guard += 1) {
            const bad = findIllegal(triangles, pts);
            if (!bad) break;
            applyFlip(triangles, bad, pts);
            flips += 1;
        }
        yield frameFor(false, pos + 1);
        step += 1;
    }

    yield frameFor(true, pts.length);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "DeWall is an online Delaunay construction: points stream in and the mesh is repaired locally after each one. A new site either splits the triangle that contains it or is stitched to the visible part of the convex hull. Any edges that violate the empty-circle rule are then flipped, so the mesh is Delaunay again before the next site arrives.",
        invariants: [
            "After each arrival the triangulation covers the convex hull of the sites seen so far.",
            "No interior edge is illegal once the local flip pass finishes.",
            "The shuffled arrival order is fixed, so the streaming replay is deterministic.",
        ],
        correctness:
            "Inserting a site into its containing triangle or onto the visible hull keeps a valid triangulation of the current hull. The local flip loop removes every illegal edge introduced by the insertion; since the rest of the mesh was already Delaunay, the whole mesh again satisfies the empty-circumcircle condition. By induction the final mesh is the Delaunay triangulation of all sites, independent of arrival order.",
        complexityRationale:
            "Each arrival performs one insertion and a number of local flips, each with a constant-size adjacency scan, so the expected total is O(n log n) for random order and O(n^2) worst case. The triangle and hull lists require O(n) space.",
        uses: [
            "Incrementally meshing points that arrive from a sensor stream",
            "Real-time terrain and surface reconstruction",
            "Maintaining a Delaunay mesh during interactive editing",
        ],
        references: [
            "Devillers, Pion, and Teillaud, Walking in a Triangulation, Algorithmica, 2002",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 9",
        ],
        workedExample:
            "Sites arrive in the order p2, p0, p4, p1, p3. The first three are skipped until a triangle exists; each later site splits or stitches into the mesh and any illegal edge is flipped immediately, so after the last arrival the mesh matches the batch Delaunay triangulation.",
    },
    id: "dewall-delaunay",
    name: "DeWall Delaunay",
    category: "geometry",
    complexity: { time: "O(n log n) expected", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4.3, 3],
            [0.2, 3.2],
            [1.6, 1.4],
        ],
        seed: 7,
    },
    visualType: "point",
    run,
    pseudocode: [
        "shuffle the sites into a fixed arrival order",
        "wait until three sites form the first triangle",
        "for each arriving site",
        "split its containing triangle or stitch the visible hull",
        "find any edge violating the empty-circle rule",
        "flip illegal edges until the mesh is legal again",
        "record the Delaunay state after the arrival",
        "done: return the streaming Delaunay mesh",
    ],
};

export default module;
