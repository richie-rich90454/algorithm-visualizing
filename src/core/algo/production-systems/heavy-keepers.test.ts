/** heavy-keepers.test.ts - Frequent-item guarantee, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./heavy-keepers";
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

describe("Heavy Keepers", () => {
    it("never drops an item whose frequency exceeds n over k", () => {
        const random = rng(424242);
        for (let trial = 0; trial < 200; trial += 1) {
            const k = 2 + Math.floor(random() * 5);
            const length = 5 + Math.floor(random() * 40);
            const alphabet = 2 + Math.floor(random() * 6);
            const stream: number[] = [];
            for (let i = 0; i < length; i += 1) stream.push(Math.floor(random() * alphabet));
            const frames = [...mod.run({ stream, k })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const reported = new Set(meta["reported"] as number[]);
            const exact = new Map((meta["exact"] as string[]).map((entry) => {
                const [key, count] = entry.split(":");
                return [Number(key), Number(count)] as [number, number];
            }));
            const threshold = length / k;
            for (const [key, frequency] of exact) {
                if (frequency > threshold) expect(reported.has(key)).toBe(true);
                expect(frequency).toBe(stream.filter((x) => x === key).length);
            }
            for (const key of reported) expect(exact.has(key)).toBe(true);
            expect(meta["missed"]).toEqual([]);
        }
    });

    it("reports the dominant key on the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const meta = finalMeta(frames);
        expect(meta["reported"]).toContain(1);
        expect(meta["missed"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
