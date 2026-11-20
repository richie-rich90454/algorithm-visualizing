import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./meta-binary-search";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("bar");
    });
}

describe("Meta Binary Search", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(40);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.meta.found).toBe(false);
    });

    it("matches indexOf on random sorted arrays with duplicates", () => {
        let seed = 2468135;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 200; trial += 1) {
            const n = next() % 20;
            const values = Array.from({ length: n }, () => next() % 9).sort((a, b) => a - b);
            const target = next() % 11;
            const frames = collect({ values, target });
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta.found).toBe(values.includes(target));
            if (values.includes(target)) {
                const index = Number(last.meta.index);
                expect(values[index]).toBe(target);
            }
            const probes = Number(last.meta.comparisons);
            expect(probes).toBeLessThanOrEqual(Math.floor(Math.log2(Math.max(n, 1))) + 2);
        }
    });

    it("handles empty and single-element arrays", () => {
        for (const values of [[], [4]]) {
            for (const target of [4, 5]) {
                const frames = collect({ values, target });
                checkFrames(frames);
                const last = frames[frames.length - 1] as VisualFrame;
                expect(last.meta.found).toBe(values.includes(target));
            }
        }
    });
});
