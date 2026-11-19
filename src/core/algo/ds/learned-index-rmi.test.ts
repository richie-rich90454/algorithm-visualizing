import { describe, expect, it } from "vitest";
import mod, { buildRmi, rmiLookup } from "./learned-index-rmi";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(count);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 9);
        expect(frame.meta).toBeDefined();
    });
}

describe("Learned Index (RMI)", () => {
    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as { keys: number[]; buckets: number; query: number };
        const count = new Set(input.keys).size;
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, count);
        const last = frames[frames.length - 1];
        expect(last?.meta["found"]).toBe(input.keys.indexOf(input.query));
        expect(Number(last?.meta["maxError"])).toBeLessThanOrEqual(Number(last?.meta["window"]));
        expect(generator.next().done).toBe(true);
    });

    it("finds every training key and rejects absent keys across randomized trials", () => {
        let seed = 987654;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const count = 3 + rand(28);
            const keys: number[] = [];
            let next = rand(10);
            for (let i = 0; i < count; i += 1) {
                next += 1 + rand(7);
                keys.push(next);
            }
            const buckets = 1 + rand(6);
            const model = buildRmi(keys, buckets);
            const predictions = model.predictions;
            for (let i = 0; i < keys.length; i += 1) {
                expect(Math.abs((predictions[i] ?? 0) - i)).toBeLessThanOrEqual(model.window);
                expect(rmiLookup(model, keys[i] ?? 0)).toBe(i);
            }
            for (let probe = 0; probe < 6; probe += 1) {
                const absent = next + 2 + probe * 3;
                expect(keys).not.toContain(absent);
                expect(rmiLookup(model, absent)).toBe(-1);
            }
        }
    });

    it("handles a single key", () => {
        const model = buildRmi([5], 3);
        expect(rmiLookup(model, 5)).toBe(0);
        expect(rmiLookup(model, 4)).toBe(-1);
        expect(rmiLookup(model, 6)).toBe(-1);
    });
});
