/** Correctness, frame shape, and termination checks for OPTICS. */
import { describe, expect, it } from "vitest";
import mod from "./optics-clustering";
import type { VisualFrame } from "@/types";

type Pt = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => {
            expect(e.type).toBe("node");
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        });
    });
}

function dist(a: Pt, b: Pt): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function bruteCore(pts: Pt[], eps: number, minPts: number): Array<number | string> {
    return pts.map((p) => {
        const d = pts
            .filter((q) => q !== p)
            .map((q) => dist(p, q))
            .filter((v) => v <= eps + 1e-9)
            .sort((x, y) => x - y);
        if (d.length + 1 < minPts) return "inf";
        return d[minPts - 2] ?? "inf";
    });
}

describe("OPTICS Clustering", () => {
    it("computes core distances matching a brute-force reference", () => {
        const input = mod.defaultInput as { points: Pt[]; eps: number; minPts: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["core"]).toEqual(bruteCore(input.points, input.eps, input.minPts));
    });

    it("returns each point once with justified reachability values", () => {
        const input = mod.defaultInput as { points: Pt[]; eps: number; minPts: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const order = final?.["order"] as number[];
        const reach = final?.["reachability"] as Array<number | string>;
        const core = final?.["core"] as Array<number | string>;
        expect([...order].sort((a, b) => a - b)).toEqual(input.points.map((_, i) => i));
        expect(reach.length).toBe(order.length);
        for (let k = 0; k < order.length; k += 1) {
            const r = reach[k];
            if (typeof r !== "number") continue;
            let justified = false;
            for (let j = 0; j < k; j += 1) {
                const c = core[order[j]!];
                if (typeof c !== "number") continue;
                const candidate = Math.max(c, dist(input.points[order[j]!]!, input.points[order[k]!]!));
                if (Math.abs(candidate - r) < 1e-6) {
                    justified = true;
                    break;
                }
            }
            expect(justified).toBe(true);
        }
    });

    it("handles empty and noisy inputs", () => {
        const empty = [...mod.run({ points: [], eps: 1.5, minPts: 2 })];
        checkFrames(empty);
        expect((empty[empty.length - 1]?.meta["order"] as number[]).length).toBe(0);
        const noise = [...mod.run({ points: [[0, 0], [10, 10]], eps: 1, minPts: 3 })];
        checkFrames(noise);
        const final = noise[noise.length - 1]?.meta;
        expect(final?.["core"]).toEqual(["inf", "inf"]);
        expect((final?.["order"] as number[]).length).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
