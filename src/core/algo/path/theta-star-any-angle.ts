/**
 * theta-star-any-angle.ts – Theta* (Any-Angle)
 *
 * Like A* but a node's parent can be any visible vertex: with line-of-sight
 * the path cuts corners instead of hugging grid edges. Open corridor gives
 * the straight shot (0,2)→(4,2), cost 4.
 * Time: O(E log V) Space: O(V)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            size?: number;
            wall?: number;
            gap?: [number, number];
            start?: [number, number];
            goal?: [number, number];
        } | null) ?? {};
    const size = task.size ?? 5;
    const wall = task.wall ?? 2;
    const gap = task.gap ?? [2, 2];
    const sk = task.start ?? [0, 2];
    const gk = task.goal ?? [4, 2];

    const key = (x: number, y: number): string => `${x},${y}`;
    const blocked = new Set<string>();
    for (let y = 0; y < size; y += 1)
        if (!(wall === gap[0] && y === gap[1])) blocked.add(key(wall, y));
    const free = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < size && y < size && !blocked.has(key(x, y));
    const cells: string[] = [];
    for (let y = 0; y < size; y += 1)
        for (let x = 0; x < size; x += 1) if (free(x, y)) cells.push(key(x, y));
    if (cells.length === 0) {
        const n0 = makeGraphNodes(["0,0"]);
        yield {
            stepNumber: 0,
            entities: n0.map((n) => ({ ...n })),
            edges: [],
            description: "Fully blocked grid – no path.",
            codeLineNumber: 0,
            layout: "graph" as const,
            meta: {},
        };
        return;
    }
    const nodes = makeGraphNodes(cells);
    const gadj: Record<string, string[]> = {};
    for (const c of cells) gadj[c] = [];
    const dirs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];
    for (let y = 0; y < size; y += 1)
        for (let x = 0; x < size; x += 1) {
            if (!free(x, y)) continue;
            for (const [dx, dy] of dirs)
                if (free(x + dx, y + dy)) (gadj[key(x, y)] as string[]).push(key(x + dx, y + dy));
        }
    const edges = makeGraphEdges(gadj);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    const skk = key(sk[0] as number, sk[1] as number);
    const gkk = key(gk[0] as number, gk[1] as number);
    if (!free(sk[0] as number, sk[1] as number) || !free(gk[0] as number, gk[1] as number)) {
        yield snap("Start or goal is blocked – no path.", 0, {});
        return;
    }
    const dist2 = (a: string, b: string): number => {
        const [x1, y1] = a.split(",").map(Number) as [number, number];
        const [x2, y2] = b.split(",").map(Number) as [number, number];
        return Math.hypot(x2 - x1, y2 - y1);
    };
    const los = (a: string, b: string): boolean => {
        const [x1, y1] = a.split(",").map(Number) as [number, number];
        const [x2, y2] = b.split(",").map(Number) as [number, number];
        const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
        for (let i = 1; i < steps; i += 1) {
            const x = Math.round(x1 + ((x2 - x1) * i) / steps);
            const y = Math.round(y1 + ((y2 - y1) * i) / steps);
            if (!free(x, y)) return false;
        }
        return true;
    };
    setN(skk, "comparing");
    setN(gkk, "highlight");
    yield snap(`Theta* from ${skk} to ${gkk}: any-angle parents with line-of-sight.`, 0, {});
    step += 1;
    const g = new Map([[skk, 0]]);
    const parent = new Map<string, string | null>([[skk, skk]]);
    const open: Array<[number, string]> = [[dist2(skk, gkk), skk]];
    const closed = new Set<string>();
    let guard = 0;
    while (open.length > 0 && guard < 14) {
        guard += 1;
        open.sort((a, b) => a[0] - b[0]);
        const [, cur] = open.shift() as [number, string];
        if (closed.has(cur)) continue;
        closed.add(cur);
        setN(cur, "sorted");
        if (cur === gkk) {
            yield snap(`Goal ${gkk} expanded with cost ${(g.get(gkk) as number).toFixed(1)}.`, 1, {
                cost: g.get(gkk) as number,
            });
            step += 1;
            break;
        }
        let shown = 0;
        for (const nb of gadj[cur] ?? []) {
            if (closed.has(nb)) continue;
            const pc = parent.get(cur) as string;
            let ng: number;
            let np: string;
            if (los(pc, nb) && (g.get(pc) as number) + dist2(pc, nb) < (g.get(nb) ?? Infinity)) {
                ng = (g.get(pc) as number) + dist2(pc, nb);
                np = pc;
            } else if ((g.get(cur) as number) + 1 < (g.get(nb) ?? Infinity)) {
                ng = (g.get(cur) as number) + 1;
                np = cur;
            } else continue;
            g.set(nb, ng);
            parent.set(nb, np);
            open.push([ng + dist2(nb, gkk), nb]);
            if (shown < 2) {
                setN(nb, "visited");
                shown += 1;
            }
        }
        yield snap(
            `Expand ${cur}${parent.get(cur) !== cur ? ` (parent ${parent.get(cur)})` : ""}: smoothing via line-of-sight.`,
            1,
            {},
        );
        step += 1;
    }
    const path: string[] = [];
    let c: string | null = closed.has(gkk) ? gkk : null;
    while (c !== null && c !== undefined) {
        path.unshift(c);
        const p = parent.get(c) as string | null;
        if (p === c || p === null) break;
        c = p;
    }
    clr();
    for (const v of path) setN(v, "path");
    yield snap(
        closed.has(gkk)
            ? `Any-angle path ${path.join("→")} costs ${(g.get(gkk) as number).toFixed(1)} (straight line, no grid zigzag).`
            : "Goal unreachable.",
        2,
        { cost: closed.has(gkk) ? (g.get(gkk) as number) : -1 },
    );
}

const module: AlgorithmModule = {
    id: "theta-star-any-angle",
    name: "Theta* (Any-Angle)",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V)" },
    defaultInput: { size: 5, wall: 2, gap: [2, 2], start: [0, 2], goal: [4, 2] },
    visualType: "graph",
    run,
};

export default module;
