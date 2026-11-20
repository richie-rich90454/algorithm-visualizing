import { describe, expect, it } from "vitest";
import mod, { bxValue, morton } from "./bx-tree";

type Frame = ReturnType<typeof mod.run> extends Generator<infer F> ? F : never;
interface Obj { id: number; x: number; y: number; time: number }

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

function brute(objects: Obj[], queryTime: number, rect: number[]): number[] {
    const [minX = 0, minY = 0, maxX = 15, maxY = 15] = rect;
    const latest = new Map<number, Obj>();
    for (const obj of objects) latest.set(obj.id, obj);
    return [...latest.entries()]
        .filter(([, obj]) =>
            obj.time <= queryTime && obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY,
        )
        .map(([id]) => id)
        .sort((a, b) => a - b);
}

describe("Bx-Tree", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        checkFrames(frames);
    });

    it("rectangle queries match a direct scan of the latest object positions", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const objects: Obj[] = Array.from({ length: 12 }, () => ({
                id: Math.floor(Math.random() * 5),
                x: Math.floor(Math.random() * 16),
                y: Math.floor(Math.random() * 16),
                time: Math.floor(Math.random() * 25),
            }));
            const queryTime = Math.floor(Math.random() * 25);
            const rect = [0, 0, 15, 15];
            const frames = [...mod.run({ objects, queryTime, rect })];
            checkFrames(frames);
            const answers = (frames[frames.length - 1]?.meta.resultIds as number[]) ?? [];
            expect(answers).toEqual(brute(objects, queryTime, rect));
        }
    });

    it("Morton codes are a bijection on the 16x16 grid and Bx-values separate time partitions", () => {
        const seen = new Set<number>();
        for (let x = 0; x < 16; x += 1) {
            for (let y = 0; y < 16; y += 1) seen.add(morton(x, y));
        }
        expect(seen.size).toBe(256);
        expect(bxValue(2, 3, 0, 10)).not.toBe(bxValue(2, 3, 10, 10));
    });
});
