/**
 * christofides-euclidean-tsp.ts – 1.5-approximation for Euclidean TSP.
 * MST (Prim) → odd-degree vertices → min perfect matching (brute force on
 * tiny odds) → Euler multigraph → shortcut tour. O(n³) tiny-n.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

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
function dist(a: Pt, b: Pt): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function prim(pts: Pt[]): Array<[number, number]> {
    const n = pts.length,
        inT = new Array(n).fill(false),
        edges: Array<[number, number]> = [];
    inT[0] = true;
    while (edges.length < n - 1) {
        let bi = -1,
            bj = -1,
            bv = Infinity;
        for (let i = 0; i < n; i += 1) {
            if (!inT[i]) continue;
            for (let j = 0; j < n; j += 1) {
                if (inT[j]) continue;
                const d = dist(pts[i] as Pt, pts[j] as Pt);
                if (d < bv) {
                    bv = d;
                    bi = i;
                    bj = j;
                }
            }
        }
        if (bi < 0) break;
        inT[bj] = true;
        edges.push([bi, bj]);
    }
    return edges;
}
function minMatching(odd: number[], pts: Pt[]): Array<[number, number]> {
    let best: Array<[number, number]> = [],
        bv = Infinity;
    const rec = (rest: number[], cur: Array<[number, number]>, cost: number) => {
        if (rest.length === 0) {
            if (cost < bv) {
                bv = cost;
                best = cur.map((e) => [...e] as [number, number]);
            }
            return;
        }
        const [a, ...tail] = rest;
        for (let i = 0; i < tail.length; i += 1) {
            const b = tail[i] as number;
            rec(
                tail.filter((_, k) => k !== i),
                [...cur, [a as number, b]],
                cost + dist(pts[a as number] as Pt, pts[b] as Pt),
            );
        }
    };
    rec(odd, [], 0);
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = t.points ?? [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
    ];
    let step = 0;
    const base = pts.map((p, i) => node(`p-${i}`, p, "unvisited", String(i)));
    const edge = (id: string, a: number, b: number, s: EntityState) => ({
        id,
        sourceId: `p-${a}`,
        targetId: `p-${b}`,
        label: "",
        state: s,
        directed: false,
    });
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Christofides TSP on ${pts.length} Euclidean points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (pts.length < 3) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e })),
            edges: [],
            description: "Degenerate input: need ≥3 cities for a tour.",
            codeLineNumber: 1,
            layout: "point",
            meta: { length: 0 },
        };
        return;
    }
    const mst = prim(pts);
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: mst.map(([a, b], k) => edge(`mst-${k}`, a, b, "comparing")),
        description: `MST (${mst.length} edges) by Prim.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { mst: mst.map(([a, b]) => `${a}-${b}`) },
    };
    const deg = new Array(pts.length).fill(0);
    for (const [a, b] of mst) {
        deg[a] += 1;
        deg[b] += 1;
    }
    const odd = deg.map((d, i) => (d % 2 === 1 ? i : -1)).filter((i) => i >= 0);
    yield {
        stepNumber: step++,
        entities: base.map((e, k) => ({
            ...e,
            state: odd.includes(k) ? ("highlight" as EntityState) : e.state,
        })),
        edges: mst.map(([a, b], k) => edge(`mst-${k}`, a, b, "comparing")),
        description: `Odd-degree vertices: [${odd.join(", ")}].`,
        codeLineNumber: 2,
        layout: "point",
        meta: { odd },
    };
    const match = minMatching(odd, pts);
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [
            ...mst.map(([a, b], k) => edge(`mst-${k}`, a, b, "comparing")),
            ...match.map(([a, b], k) => edge(`mm-${k}`, a, b, "highlight")),
        ],
        description: `Min-weight perfect matching on ${odd.length} odds (${match.length} pairs).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { matching: match.map(([a, b]) => `${a}-${b}`) },
    };
    // Euler tour over multigraph via Hierholzer, then shortcut.
    const adj = new Map<number, number[]>();
    const addE = (a: number, b: number) => {
        adj.set(a, [...(adj.get(a) ?? []), b]);
        adj.set(b, [...(adj.get(b) ?? []), a]);
    };
    for (const [a, b] of mst) addE(a, b);
    for (const [a, b] of match) addE(a, b);
    const stack = [0],
        euler: number[] = [];
    const work = new Map<number, number[]>([...adj].map(([k, v]) => [k, [...v]]));
    while (stack.length > 0) {
        const v = stack[stack.length - 1] as number;
        const nb = work.get(v) ?? [];
        if (nb.length === 0) euler.push(stack.pop() as number);
        else {
            const u = nb.pop() as number;
            work.set(v, nb);
            const list = work.get(u) as number[];
            list.splice(list.indexOf(v), 1);
            stack.push(u);
        }
    }
    const seen = new Set<number>(),
        tour: number[] = [];
    for (const v of euler.reverse())
        if (!seen.has(v)) {
            seen.add(v);
            tour.push(v);
        }
    tour.push(tour[0] as number);
    let length = 0;
    for (let i = 0; i < tour.length - 1; i += 1)
        length += dist(pts[tour[i] as number] as Pt, pts[tour[i + 1] as number] as Pt);
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: tour
            .slice(0, -1)
            .map((v, k) => edge(`t-${k}`, v, tour[k + 1] as number, "comparing")),
        description: `Euler tour shortcut to Hamiltonian cycle [${tour.join("→")}].`,
        codeLineNumber: 4,
        layout: "point",
        meta: { tour },
    };
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: tour.slice(0, -1).map((v, k) => edge(`t-${k}`, v, tour[k + 1] as number, "sorted")),
        description: `Tour length = ${length.toFixed(4)} (≤1.5× optimal).`,
        codeLineNumber: 5,
        layout: "point",
        meta: { tour, length },
    };
}

const module: AlgorithmModule = {
    id: "christofides-euclidean-tsp",
    name: "Christofides Euclidean TSP",
    category: "geometry",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: {
        points: [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
