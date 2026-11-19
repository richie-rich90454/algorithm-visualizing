import { describe, expect, it } from "vitest";
import mod from "./b-link-tree";

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

describe("B-Link Tree", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        checkFrames(frames);
    });

    it("linked searches agree with a set membership for random keys and queries", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const keys = Array.from({ length: 25 }, () => Math.floor(Math.random() * 500));
            const queries = Array.from({ length: 12 }, () => Math.floor(Math.random() * 500));
            const frames = [...mod.run({ keys, queries })];
            checkFrames(frames);
            const expected = new Set(keys);
            const answers = new Map<number, boolean>();
            for (const frame of frames) {
                if (typeof frame.meta.found === "boolean" && typeof frame.meta.query === "number") {
                    answers.set(frame.meta.query, frame.meta.found);
                }
            }
            for (const q of queries) {
                expect(answers.has(q)).toBe(true);
                expect(answers.get(q)).toBe(expected.has(q));
            }
        }
    });

    it("every emitted link edge references nodes that exist in the frame", () => {
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
