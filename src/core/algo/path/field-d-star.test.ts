/**
 * field-d-star.test.ts - Correctness against an independent Dijkstra reference
 * using the same interpolated edge costs, plus frame shape and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./field-d-star";
import type { VisualFrame } from "@/types";

type GridPoint = [number, number];

const DIRECTIONS: GridPoint[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];

/** Independent reference: dense Dijkstra with bilinear-interpolated edge costs. */
function reference(
    costs: number[][],
    start: GridPoint,
    goal: GridPoint,
): { cost: number; pathNodes: Set<string> } {
    const h = costs.length;
    const w = h > 0 ? (costs[0]?.length ?? 0) : 0;
    const key = (x: number, y: number): string => `${x},${y}`;
    const at = (x: number, y: number): number =>
        costs[Math.min(h - 1, Math.max(0, y))]?.[Math.min(w - 1, Math.max(0, x))] ?? 1;
    const interp = (x: number, y: number): number => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        return (
            at(x0, y0) * (1 - fx) * (1 - fy) +
            at(x0 + 1, y0) * fx * (1 - fy) +
            at(x0, y0 + 1) * (1 - fx) * fy +
            at(x0 + 1, y0 + 1) * fx * fy
        );
    };
    const n = w * h;
    const dist = new Array<number>(n).fill(Infinity);
    const parent = new Array<number>(n).fill(-1);
    const used = new Array<boolean>(n).fill(false);
    const idx = (x: number, y: number): number => y * w + x;
    const sx = start[0];
    const sy = start[1];
    const gx = goal[0];
    const gy = goal[1];
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || gx < 0 || gy < 0 || gx >= w || gy >= h) {
        return { cost: -1, pathNodes: new Set() };
    }
    dist[idx(sx, sy)] = 0;
    for (let iter = 0; iter < n; iter += 1) {
        let pick = -1;
        for (let i = 0; i < n; i += 1) {
            if (!used[i] && (pick === -1 || (dist[i] as number) < (dist[pick] as number))) {
                pick = i;
            }
        }
        if (pick === -1 || !Number.isFinite(dist[pick] as number)) {
            break;
        }
        used[pick] = true;
        const x = pick % w;
        const y = Math.floor(pick / w);
        for (const [dx, dy] of DIRECTIONS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
                continue;
            }
            const ni = idx(nx, ny);
            const c = Math.hypot(dx, dy) * interp((x + nx) / 2, (y + ny) / 2);
            if ((dist[pick] as number) + c < (dist[ni] as number)) {
                dist[ni] = (dist[pick] as number) + c;
                parent[ni] = pick;
            }
        }
    }
    const pathNodes = new Set<string>();
    let cursor = idx(gx, gy);
    if (!Number.isFinite(dist[cursor] as number)) {
        return { cost: -1, pathNodes };
    }
    while (cursor !== -1) {
        pathNodes.add(key(cursor % w, Math.floor(cursor / w)));
        cursor = parent[cursor] as number;
    }
    return { cost: dist[idx(gx, gy)] as number, pathNodes };
}

function checkFrames(frames: VisualFrame[], expectedNodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(expectedNodes === 0 ? 1 : expectedNodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Field D Star", () => {
    it("matches an independent interpolated Dijkstra reference on the default grid", () => {
        const input = mod.defaultInput as { costs: number[][]; start: GridPoint; goal: GridPoint };
        const frames = [...mod.run(input)];
        const expectedNodes = input.costs.length * (input.costs[0]?.length ?? 0);
        checkFrames(frames, expectedNodes);

        const expected = reference(input.costs, input.start, input.goal);
        const final = frames[frames.length - 1];
        expect(final?.meta["found"]).toBe(true);
        expect(Number(final?.meta["pathCost"])).toBeCloseTo(expected.cost, 6);

        const actualPath = new Set(
            (final?.entities ?? [])
                .filter((e) => e.state === "path")
                .map((e) => `${String(e.metadata["x"])},${String(e.metadata["y"])}`),
        );
        expect(actualPath.size).toBe(Number(final?.meta["pathLength"]));
        const startKey = `${input.start[0]},${input.start[1]}`;
        const goalKey = `${input.goal[0]},${input.goal[1]}`;
        expect(actualPath.has(startKey)).toBe(true);
        expect(actualPath.has(goalKey)).toBe(true);
        // A real path is a connected chain: interior nodes have two path
        // neighbors and endpoints have one.
        for (const key of actualPath) {
            const [x, y] = key.split(",").map(Number) as [number, number];
            let neighbors = 0;
            for (const [dx, dy] of DIRECTIONS) {
                if (actualPath.has(`${x + dx},${y + dy}`)) {
                    neighbors += 1;
                }
            }
            const endpoint = key === startKey || key === goalKey;
            expect(neighbors).toBeGreaterThanOrEqual(endpoint ? 1 : 2);
        }
    });

    it("agrees with the reference on random terrains, including obstacles", () => {
        for (let t = 0; t < 12; t += 1) {
            const h = 3 + Math.floor(Math.random() * 4);
            const w = 3 + Math.floor(Math.random() * 4);
            const costs: number[][] = [];
            for (let y = 0; y < h; y += 1) {
                const row: number[] = [];
                for (let x = 0; x < w; x += 1) {
                    row.push(Math.random() < 0.3 ? 9 : 1);
                }
                costs.push(row);
            }
            const start: GridPoint = [0, 0];
            const goal: GridPoint = [w - 1, h - 1];
            const frames = [...mod.run({ costs, start, goal })];
            checkFrames(frames, w * h);
            const expected = reference(costs, start, goal);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["pathCost"])).toBeCloseTo(expected.cost, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
