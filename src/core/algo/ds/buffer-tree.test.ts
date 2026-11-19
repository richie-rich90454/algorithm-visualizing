import { describe, expect, it } from "vitest";
import mod from "./buffer-tree";

type Frame = ReturnType<typeof mod.run> extends Generator<infer F> ? F : never;

function checkFrames(frames: Frame[]): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 12);
        expect(frame.meta).toBeDefined();
    });
}

function brute(ops: Array<[string, number]>): { keys: number[]; counts: number[] } {
    const counts = new Map<number, number>();
    for (const [type, key] of ops) {
        const current = counts.get(key) ?? 0;
        counts.set(key, type === "insert" ? current + 1 : Math.max(0, current - 1));
    }
    const keys = [...counts.keys()].sort((a, b) => a - b);
    return { keys, counts: keys.map((key) => counts.get(key) ?? 0) };
}

describe("Buffer Tree", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        checkFrames(frames);
    });

    it("batched flushes produce the same counts as direct application", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const ops: Array<[string, number]> = Array.from({ length: 20 }, () => [
                Math.random() < 0.7 ? "insert" : "delete",
                Math.floor(Math.random() * 30),
            ]);
            const frames = [...mod.run({ leaves: 4, bufferSize: 1 + Math.floor(Math.random() * 5), ops })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(final?.meta.keys).toEqual(brute(ops).keys);
            expect(final?.meta.counts).toEqual(brute(ops).counts);
        }
    });

    it("handles an empty update stream", () => {
        const frames = [...mod.run({ ops: [] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta.keys).toEqual([]);
    });
});
