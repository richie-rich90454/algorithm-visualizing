import { describe, expect, it } from "vitest";
import mod from "./viceroy-dht";
import type { VisualFrame } from "@/types";

function expectedPath(dimensions: number, source: number, target: number) {
    const path: Array<[number, number]> = [[0, source]];
    let position = source;
    for (let level = 0; level < dimensions; level += 1) {
        if (((position >> level) & 1) !== ((target >> level) & 1)) {
            position ^= 1 << level;
        }
        path.push([level + 1, position]);
    }
    return path;
}

function checkFrames(frames: VisualFrame[], dimensions: number): void {
    const size = 1 << dimensions;
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(size * (dimensions + 1));
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

describe("Viceroy DHT", () => {
    it("routes to the exact target in log N hops", () => {
        for (const input of [
            { dimensions: 1, source: 0, target: 1 },
            { dimensions: 2, source: 1, target: 3 },
            { dimensions: 3, source: 5, target: 2 },
            { dimensions: 3, source: 0, target: 7 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.dimensions);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["complete"]).toBe(true);
            expect(Number(final?.["hops"])).toBe(input.dimensions);
            const path = final?.["path"] as string[];
            expect(path.length).toBe(input.dimensions + 1);
            const expected = expectedPath(input.dimensions, input.source, input.target);
            expected.forEach(([level, position], i) => {
                expect(path[i]).toBe(`v-${level}-${position}`);
            });
            expect(path[path.length - 1]).toBe(`v-${input.dimensions}-${input.target}`);
            expect(frames.length).toBe(input.dimensions + 2);
        }
    });

    it("keeps each hop on a single butterfly level increase", () => {
        const frames = [...mod.run({ dimensions: 3, source: 2, target: 5 })];
        checkFrames(frames, 3);
        for (let i = 1; i < frames.length - 1; i += 1) {
            const hops = Number(frames[i]?.meta["hops"]);
            expect(hops).toBe(i);
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
