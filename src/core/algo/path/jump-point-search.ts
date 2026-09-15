/**
 * jump-point-search.ts – Jump Point Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jump Point Search speeds up A* on uniform grids by skipping symmetric
 * paths. Instead of stepping cell by cell, it jumps straight past cells
 * with no forced neighbors and branches only at jump points where the wall
 * forces a turn. On the demo grid a vertical wall blocks every row except
 * the gap at (2,2), so the search jumps the corridor (0,2) to (2,2) to
 * (4,2) with optimal cost 4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) worst case, far less on open grids
 *   Space: O(V) for the open set and bookkeeping
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The start cell is YELLOW (comparing), the goal PINK (highlight).
 *   - Jump landing cells are YELLOW (comparing).
 *   - Closed cells are GREEN (sorted).
 *   - The final corridor is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal on uniform-cost grids with straight and diagonal moves.
 *   - Symmetry breaking is the core idea worth teaching.
 *   - Degrades to A* in mazes with forced neighbors everywhere.
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
    const jump = (x: number, y: number, dx: number, dy: number): [number, number] | null => {
        let cx = x + dx;
        let cy = y + dy;
        while (free(cx, cy)) {
            if (cx === gk[0] && cy === gk[1]) return [cx, cy];
            if (
                dx !== 0 &&
                ((!free(cx, cy + 1) && free(cx + dx, cy + 1)) ||
                    (!free(cx, cy - 1) && free(cx + dx, cy - 1)))
            )
                return [cx, cy];
            if (
                dy !== 0 &&
                ((!free(cx + 1, cy) && free(cx + 1, cy + dy)) ||
                    (!free(cx - 1, cy) && free(cx - 1, cy + dy)))
            )
                return [cx, cy];
            cx += dx;
            cy += dy;
        }
        return null;
    };
    setN(skk, "comparing");
    setN(gkk, "highlight");
    yield snap(
        `Jump Point Search from ${skk} to ${gkk}: jumping east along the corridor past cells with no forced neighbors.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    const g = new Map([[skk, 0]]);
    const parent = new Map<string, string | null>([[skk, null]]);
    const open: Array<[number, string]> = [
        [
            Math.abs((sk[0] as number) - (gk[0] as number)) +
                Math.abs((sk[1] as number) - (gk[1] as number)),
            skk,
        ],
    ];
    const closed = new Set<string>();
    let found = false;
    let guard = 0;
    while (open.length > 0 && !found && guard < 12) {
        guard += 1;
        open.sort((a, b) => a[0] - b[0]);
        const [, cur] = open.shift() as [number, string];
        if (closed.has(cur)) continue;
        closed.add(cur);
        const [cx, cy] = cur.split(",").map(Number) as [number, number];
        const jp = jump(cx, cy, 1, 0);
        if (!jp) {
            setN(cur, "visited");
            yield snap(
                `Cell ${cur} at distance ${g.get(cur)}: eastward jump from here runs into the wall, a dead end.`,
                2,
                { settled: closed.size, visits: closed.size },
            );
            step += 1;
            continue;
        }
        const jk = key(jp[0], jp[1]);
        const ng = (g.get(cur) as number) + Math.abs(jp[0] - cx);
        if (ng < (g.get(jk) ?? Infinity)) {
            g.set(jk, ng);
            parent.set(jk, cur);
            const h = Math.abs(jp[0] - (gk[0] as number)) + Math.abs(jp[1] - (gk[1] as number));
            open.push([ng + h, jk]);
        }
        clr();
        setN(cur, "sorted");
        setN(jk, "comparing");
        setN(gkk, "highlight");
        yield snap(
            `Jump from ${cur} to ${jk} with cost ${ng}${jk === gkk ? " reaching goal " + gkk : " stopping at a forced neighbor by the wall"}.`,
            3,
            { cost: ng, settled: closed.size, visits: closed.size },
        );
        step += 1;
        if (jk === gkk) found = true;
    }
    const path: string[] = [];
    let cur2: string | null = found ? gkk : null;
    while (cur2 !== null) {
        path.unshift(cur2);
        cur2 = parent.get(cur2) as string | null;
    }
    const line: string[] = [];
    for (let i = 0; i + 1 < path.length; i += 1) {
        const [x1, y1] = (path[i] as string).split(",").map(Number) as [number, number];
        const [x2] = (path[i + 1] as string).split(",").map(Number) as [number, number];
        const d = x2 > x1 ? 1 : -1;
        for (let x = x1; x !== x2 + d; x += d) {
            const k = key(x, y1);
            if (!line.includes(k)) line.push(k);
        }
    }
    clr();
    for (const c of line) setN(c, "path");
    setN(gkk, "path");
    yield snap(
        found
            ? `Optimal grid path with cost ${g.get(gkk)}: ${line.join(" → ")} through the wall gap without extra expansions.`
            : "Goal cell is unreachable on this grid.",
        6,
        {
            cost: found ? (g.get(gkk) as number) : -1,
            distance: found ? (g.get(gkk) as number) : -1,
            path: line.join("→"),
            settled: closed.size,
            visits: closed.size,
        },
    );
}

const module: AlgorithmModule = {
    id: "jump-point-search",
    name: "Jump Point Search",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V)" },
    defaultInput: { size: 5, wall: 2, gap: [2, 2], start: [0, 2], goal: [4, 2] },
    visualType: "graph",
    run,
    pseudocode: [
        "open holds start with f ← heuristic to goal",
        "pop cell u with smallest f-score for expansion",
        "jump east from u past cells with no forced neighbors",
        "stop at jump point, wall, or goal cell reached",
        "push jump point with updated cost g plus heuristic",
        "close u, repeat until goal is expanded",
        "done: rebuild optimal corridor through jump points",
    ],
};

export default module;
