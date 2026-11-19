import { describe, expect, it } from "vitest";
import mod from "./b-star-tree";

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

describe("B* Tree", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        checkFrames(frames);
    });

    it("stores every inserted key and never exceeds the node capacity", () => {
        for (let trial = 0; trial < 20; trial += 1) {
            const keys = Array.from({ length: 18 }, () => Math.floor(Math.random() * 1000));
            const frames = [...mod.run({ keys, query: keys[0] ?? 0 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            const maxKeys = Number(final?.meta.maxKeys);
            for (const node of final?.entities ?? []) {
                expect(Number(node.value)).toBeLessThanOrEqual(maxKeys);
            }
            for (const key of keys) {
                const found = [...mod.run({ keys, query: key })].at(-1)?.meta.found;
                expect(found, `key ${key} should be present`).toBe(true);
            }
        }
    });

    it("keeps every key findable in a larger multi-level tree", () => {
        const keys = Array.from({ length: 60 }, (_, i) => i * 7 + 3);
        for (const key of keys) {
            const found = [...mod.run({ keys, query: key })].at(-1)?.meta.found;
            expect(found, `key ${key} should be present`).toBe(true);
        }
        const absent = [...mod.run({ keys, query: 6 })].at(-1)?.meta.found;
        expect(absent).toBe(false);
    });

    it("search reports presence for a stored key and absence for a far-away key", () => {
        const keys = [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 2, 1, 8, 9, 11];
        const present = [...mod.run({ keys, query: 12 })].at(-1);
        const absent = [...mod.run({ keys, query: 9999 })].at(-1);
        expect(present?.meta.found).toBe(true);
        expect(absent?.meta.found).toBe(false);
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
