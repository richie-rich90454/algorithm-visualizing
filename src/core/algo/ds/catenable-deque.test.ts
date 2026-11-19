import { describe, expect, it } from "vitest";
import mod from "./catenable-deque";

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

function brute(left: number[], right: number[], ops: unknown[]): number[] {
    const values = [...left, ...right];
    for (const raw of ops) {
        const op = Array.isArray(raw) ? String(raw[0]) : String(raw);
        const value = Array.isArray(raw) && typeof raw[1] === "number" ? raw[1] : 0;
        if (op === "pushFront") values.unshift(value);
        else if (op === "pushBack") values.push(value);
        else if (op === "popFront") values.shift();
        else if (op === "popBack") values.pop();
    }
    return values;
}

describe("Catenable Deque", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta.values).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("matches a plain-array deque across long random operation streams", () => {
        for (let trial = 0; trial < 50; trial += 1) {
            const left = Array.from({ length: Math.floor(Math.random() * 8) }, () => Math.floor(Math.random() * 100));
            const right = Array.from({ length: Math.floor(Math.random() * 8) }, () => Math.floor(Math.random() * 100));
            const ops: unknown[] = Array.from({ length: 30 }, () => {
                const kind = ["pushFront", "pushBack", "popFront", "popBack"][Math.floor(Math.random() * 4)];
                return kind === "pushFront" || kind === "pushBack"
                    ? [kind, Math.floor(Math.random() * 100)]
                    : [kind];
            });
            const frames = [...mod.run({ left, right, operations: ops })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta.values).toEqual(brute(left, right, ops));
        }
    });

    it("both deques empty still yields well-formed frames", () => {
        const frames = [...mod.run({ left: [], right: [], operations: [["popFront"], ["popBack"]] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta.values).toEqual([]);
    });
});
