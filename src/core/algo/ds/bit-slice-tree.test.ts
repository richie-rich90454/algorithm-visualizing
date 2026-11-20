import { describe, expect, it } from "vitest";
import mod from "./bit-slice-tree";

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

function brute(prefixes: Array<[number, number]>, query: number, width: number): [number, number] | null {
    let best: [number, number] | null = null;
    for (const [value, length] of prefixes) {
        const mask = length === 0 ? 0 : (1 << length) - 1;
        if (length === 0 || ((value >>> (width - length)) & mask) === ((query >>> (width - length)) & mask)) {
            if (!best || length > best[1]) best = [value, length];
        }
    }
    return best;
}

describe("Bit-Slice Tree", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta.answer).toBe("18/6");
    });

    it("longest-prefix matches agree with brute force over random inputs", () => {
        const width = 8;
        for (let trial = 0; trial < 60; trial += 1) {
            const slice = [1, 2, 4][Math.floor(Math.random() * 3)] ?? 2;
            const prefixes: Array<[number, number]> = Array.from(
                { length: 8 },
                () => [Math.floor(Math.random() * 256), Math.floor(Math.random() * (width + 1))] as [number, number],
            );
            const query = Math.floor(Math.random() * 256);
            const frames = [...mod.run({ width, slice, prefixes, query })];
            checkFrames(frames);
            const answer = String(frames[frames.length - 1]?.meta.answer);
            const expected = brute(prefixes, query, width);
            expect(answer).toBe(expected ? `${expected[0]}/${expected[1]}` : "none");
        }
    });

    it("every edge references an existing node", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        }
    });
});
