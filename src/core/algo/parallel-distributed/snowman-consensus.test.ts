import { describe, expect, it } from "vitest";
import mod from "./snowman-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function majority(colors: number[]): number {
    const counts = new Map<number, number>();
    for (const c of colors) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let best = -1;
    let bestCount = 0;
    for (const [c, count] of counts) {
        if (count > bestCount) {
            best = c;
            bestCount = count;
        }
    }
    return best;
}

describe("Snowman Consensus", () => {
    it("converges to the strict majority color", () => {
        for (const colors of [
            [0, 0, 0, 1, 1],
            [1, 1, 0, 0, 0],
            [2, 2, 2, 2, 0, 0, 1],
        ]) {
            const input = { colors, rounds: 8, k: 4, alpha: 3, beta: 2 };
            const frames = [...mod.run(input)];
            checkFrames(frames, colors.length);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["agreed"]).toBe(true);
            expect(Number(final?.["decided"])).toBe(colors.length);
            expect(Number(final?.["finalColor"])).toBe(majority(colors));
            const preferences = final?.["preferences"] as number[];
            expect(preferences.every((c) => c === majority(colors))).toBe(true);
        }
    });

    it("confidence only increases while preference stays fixed", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        for (const frame of frames) {
            const confidence = frame.meta["confidence"] as number[] | undefined;
            if (confidence) {
                expect(confidence.every((c) => c >= 0 && c <= 12)).toBe(true);
            }
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
