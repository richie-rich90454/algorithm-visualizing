/** visibility-graph-path-planning.test.ts - Independent Dijkstra cross-check, path validity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./visibility-graph-path-planning";
import type { VisualFrame } from "@/types";

type Point = [number, number];

const cross = (o: Point, a: Point, b: Point): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    return ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) && ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0));
}

/** Reference shortest path computed independently. */
function referenceLength(obstacles: Point[][], start: Point, goal: Point): number {
    const nodes = [start, goal, ...obstacles.flat()];
    const obsEdges = obstacles.flatMap((poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length] as Point] as [Point, Point]));
    const n = nodes.length;
    const best = new Array<number>(n).fill(Infinity);
    const done = new Array<boolean>(n).fill(false);
    best[0] = 0;
    for (let it = 0; it < n; it += 1) {
        let u = -1;
        for (let i = 0; i < n; i += 1) if (!done[i] && (u === -1 || best[i] < best[u])) u = i;
        if (u === -1 || best[u] === Infinity) break;
        done[u] = true;
        for (let v = 0; v < n; v += 1) {
            if (done[v] || u === v) continue;
            const a = nodes[u];
            const b = nodes[v];
            let clear = true;
            for (const [c, d] of obsEdges) {
                if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) continue;
                if (intersects(a, b, c, d)) {
                    clear = false;
                    break;
                }
            }
            if (clear && best[u] + dist(a, b) < best[v]) best[v] = best[u] + dist(a, b);
        }
    }
    return best[1];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Visibility Graph Path Planning", () => {
    it("matches an independent shortest-path reference", () => {
        const input = mod.defaultInput as { obstacles: Point[][]; start: Point; goal: Point };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const expected = referenceLength(input.obstacles, input.start, input.goal);
        expect(finalMeta?.["reachable"]).toBe(true);
        expect(Number(finalMeta?.["length"])).toBeCloseTo(expected, 6);
    });

    it("returns a valid path whose edges are all unobstructed", () => {
        const input = mod.defaultInput as { obstacles: Point[][]; start: Point; goal: Point };
        const frames = [...mod.run(input)];
        const path = frames[frames.length - 1]?.meta["path"] as number[];
        expect(path[0]).toBe(0);
        expect(path[path.length - 1]).toBe(1);
        const nodes = [input.start, input.goal, ...input.obstacles.flat()];
        const obsEdges = input.obstacles.flatMap((poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length] as Point] as [Point, Point]));
        let sum = 0;
        for (let i = 0; i + 1 < path.length; i += 1) {
            const a = nodes[path[i] as number] as Point;
            const b = nodes[path[i + 1] as number] as Point;
            for (const [c, d] of obsEdges) {
                if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) continue;
                expect(intersects(a, b, c, d)).toBe(false);
            }
            sum += dist(a, b);
        }
        expect(sum).toBeCloseTo(Number(frames[frames.length - 1]?.meta["length"]), 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
