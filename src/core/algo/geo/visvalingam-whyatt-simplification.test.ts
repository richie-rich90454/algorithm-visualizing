/** Correctness, frame shape, and termination checks for Visvalingam-Whyatt. */
import { describe, expect, it } from "vitest";
import mod from "./visvalingam-whyatt-simplification";
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
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function area(a: Pt, b: Pt, c: Pt): number {
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
}

describe("Visvalingam-Whyatt Simplification", () => {
    it("keeps an ordered subsequence with endpoints and no low-area vertex", () => {
        const input = mod.defaultInput as { polyline: Pt[]; tolerance: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const kept = final?.["kept"] as number[];
        expect(kept[0]).toBe(0);
        expect(kept[kept.length - 1]).toBe(input.polyline.length - 1);
        for (let i = 1; i < kept.length; i += 1) expect(kept[i]!).toBeGreaterThan(kept[i - 1]!);
        for (let i = 1; i < kept.length - 1; i += 1) {
            const a = area(
                input.polyline[kept[i - 1]!]!,
                input.polyline[kept[i]!]!,
                input.polyline[kept[i + 1]!]!,
            );
            expect(a).toBeGreaterThanOrEqual(input.tolerance - 1e-9);
        }
    });

    it("simplifies a wiggly line but preserves a sharp peak", () => {
        const line: Pt[] = [
            [0, 0], [1, 0.05], [2, 0], [3, 0.05], [4, 8], [5, 0.05], [6, 0], [7, 0],
        ];
        const frames = [...mod.run({ polyline: line, tolerance: 0.5 })];
        checkFrames(frames);
        const kept = frames[frames.length - 1]?.meta["kept"] as number[];
        expect(kept).toContain(0);
        expect(kept).toContain(7);
        expect(kept).toContain(4);
        expect(kept.length).toBeLessThan(line.length);
    });

    it("handles degenerate inputs", () => {
        const empty = [...mod.run({ polyline: [], tolerance: 1 })];
        checkFrames(empty);
        const two = [...mod.run({ polyline: [[0, 0], [1, 1]], tolerance: 1 })];
        checkFrames(two);
        expect((two[two.length - 1]?.meta["kept"] as number[]).length).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
