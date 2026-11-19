/** shamos-hoey.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./shamos-hoey";
import type { VisualFrame } from "@/types";

type Pt = [number, number];
type Seg = [Pt, Pt];

/** Independent O(n^2) intersection test via parametric line solving. */
function bruteIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
    const rx = b[0] - a[0];
    const ry = b[1] - a[1];
    const ux = d[0] - c[0];
    const uy = d[1] - c[1];
    const cross = rx * uy - ry * ux;
    const qx = c[0] - a[0];
    const qy = c[1] - a[1];
    const eps = 1e-9;
    if (Math.abs(cross) < eps) {
        const cross2 = qx * ry - qy * rx;
        if (Math.abs(cross2) > eps) {
            return false;
        }
        const dot = rx * ux + ry * uy;
        const t0 = (qx * rx + qy * ry) / (dot || 1);
        const t1 = ((c[0] - a[0] + ux) * rx + (c[1] - a[1] + uy) * ry) / (dot || 1);
        return Math.max(Math.min(t0, t1), 0) <= Math.min(Math.max(t0, t1), 1);
    }
    const t = (qx * uy - qy * ux) / cross;
    const s = (qx * ry - qy * rx) / cross;
    return t >= -eps && t <= 1 + eps && s >= -eps && s <= 1 + eps;
}

function anyIntersection(segs: Seg[]): boolean {
    for (let i = 0; i < segs.length; i += 1) {
        for (let j = i + 1; j < segs.length; j += 1) {
            const a = segs[i] as Seg;
            const b = segs[j] as Seg;
            if (bruteIntersect(a[0], a[1], b[0], b[1])) {
                return true;
            }
        }
    }
    return false;
}

/** Deterministic general-position segments with distinct integer x endpoints. */
function randomSegments(seed: number, count: number): Seg[] {
    let state = seed >>> 0;
    const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const segs: Seg[] = [];
    for (let i = 0; i < count; i += 1) {
        const x0 = i * 2 + next();
        const x1 = i * 2 + 1 + next();
        segs.push([
            [x0, next() * 10],
            [x1, next() * 10],
        ]);
    }
    return segs;
}

function checkFrames(frames: VisualFrame[], segmentCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    const pc = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(segmentCount * 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(segmentCount);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(pc);
        expect(frame.meta).toBeDefined();
    });
}

describe("Shamos-Hoey intersection detection", () => {
    it("detects the crossing in the default input", () => {
        const input = mod.defaultInput as { segments: Seg[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.segments.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["hasIntersection"]).toBe(true);
        expect(anyIntersection(input.segments)).toBe(true);
        const encoded = Number(finalMeta?.["pair"]);
        const n = input.segments.length;
        const i = Math.floor(encoded / n);
        const j = encoded % n;
        expect(bruteIntersect(input.segments[i]![0], input.segments[i]![1], input.segments[j]![0], input.segments[j]![1])).toBe(true);
    });

    it("agrees with brute force on random general-position sets", () => {
        for (let seed = 1; seed <= 8; seed += 1) {
            const segs = randomSegments(seed, 9);
            const frames = [...mod.run({ segments: segs })];
            const reported = frames[frames.length - 1]?.meta["hasIntersection"];
            expect(reported).toBe(anyIntersection(segs));
        }
    });

    it("reports no crossing for separated segments", () => {
        const segs: Seg[] = [
            [[0, 0], [1, 1]],
            [[2, 0], [3, 1]],
            [[4, 0], [5, 1]],
        ];
        const frames = [...mod.run({ segments: segs })];
        expect(frames[frames.length - 1]?.meta["hasIntersection"]).toBe(false);
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
