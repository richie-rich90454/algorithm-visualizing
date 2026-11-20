/** space-saving.test.ts - Estimate bounds, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./space-saving";
import type { VisualFrame } from "@/types";

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("SpaceSaving", () => {
    it("keeps every estimate within n over k of the truth and retains all heavy keys", () => {
        const random = rng(98765);
        for (let trial = 0; trial < 200; trial += 1) {
            const k = 2 + Math.floor(random() * 5);
            const length = 6 + Math.floor(random() * 40);
            const alphabet = 2 + Math.floor(random() * 6);
            const stream: number[] = [];
            for (let i = 0; i < length; i += 1) stream.push(Math.floor(random() * alphabet));
            const frames = [...mod.run({ stream, k })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const exact = new Map((meta["exact"] as string[]).map((entry) => {
                const [key, count] = entry.split(":");
                return [Number(key), Number(count)] as [number, number];
            }));
            const estimates = (meta["estimates"] as string[]).map((entry) => {
                const [key, count] = entry.split(":");
                return [Number(key), Number(count)] as [number, number];
            });
            expect(estimates.length).toBeLessThanOrEqual(k);
            const reported = new Set(estimates.map(([key]) => key));
            for (const [key, estimate] of estimates) {
                const trueCount = exact.get(key) ?? 0;
                expect(estimate).toBeGreaterThanOrEqual(trueCount);
                expect(estimate - trueCount).toBeLessThanOrEqual(Math.floor(length / k));
            }
            for (const [key, frequency] of exact) {
                expect(frequency).toBe(stream.filter((x) => x === key).length);
                if (frequency > length / k) expect(reported.has(key)).toBe(true);
            }
            expect(meta["missing"]).toEqual([]);
            expect(meta["maxError"]).toBeLessThanOrEqual(Math.floor(length / k));
        }
    });

    it("matches exact counts when the stream has few distinct keys", () => {
        const frames = [...mod.run({ stream: [1, 1, 2, 2, 2, 1], k: 4 })];
        const meta = finalMeta(frames);
        expect(meta["estimates"]).toEqual(["1:3", "2:3"]);
        expect(meta["maxError"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
