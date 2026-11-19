/** Correctness, frame shape, and termination checks for Wu line drawing. */
import { describe, expect, it } from "vitest";
import mod from "./wu-antialiased-line";
import type { VisualFrame } from "@/types";

type Pixel = [number, number, number];

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
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        });
    });
}

function pixelsFrom(frame: VisualFrame): Pixel[] {
    return frame.entities.map((e) => e.value as Pixel);
}

describe("Wu Antialiased Line", () => {
    it("emits complementary pixel pairs whose weighted center follows the line", () => {
        const frames = [...mod.run({ from: [0, 0], to: [8, 4] })];
        checkFrames(frames);
        const pixels = pixelsFrom(frames[frames.length - 1]!);
        expect(pixels.length).toBe(18);
        const columns = new Map<number, Pixel[]>();
        for (const p of pixels) {
            const list = columns.get(p[0]) ?? [];
            list.push(p);
            columns.set(p[0], list);
        }
        expect(columns.size).toBe(9);
        for (let x = 0; x <= 8; x += 1) {
            const pair = columns.get(x) ?? [];
            expect(pair.length).toBe(2);
            const sum = pair[0]![2] + pair[1]![2];
            expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
            const weighted = pair[0]![1] * pair[0]![2] + pair[1]![1] * pair[1]![2];
            expect(Math.abs(weighted - x * 0.5)).toBeLessThan(1e-9);
            expect(Math.abs(pair[0]![1] - pair[1]![1])).toBe(1);
        }
    });

    it("handles steep and vertical lines", () => {
        const steep = [...mod.run({ from: [0, 0], to: [4, 8] })];
        checkFrames(steep);
        const steepPixels = pixelsFrom(steep[steep.length - 1]!);
        expect(steepPixels.length).toBe(18);
        const vertical = [...mod.run({ from: [3, 0], to: [3, 4] })];
        checkFrames(vertical);
        const verticalPixels = pixelsFrom(vertical[vertical.length - 1]!);
        expect(verticalPixels.length).toBe(10);
        const byRow = new Map<number, Pixel[]>();
        for (const p of verticalPixels) {
            const list = byRow.get(p[1]) ?? [];
            list.push(p);
            byRow.set(p[1], list);
        }
        expect(byRow.size).toBe(5);
        for (const pair of byRow.values()) {
            expect(pair[0]![2] + pair[1]![2]).toBeCloseTo(1, 9);
            expect(Math.abs(pair[0]![0] - pair[1]![0])).toBe(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
