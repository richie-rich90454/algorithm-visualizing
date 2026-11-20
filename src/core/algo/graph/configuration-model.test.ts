import { describe, expect, it } from "vitest";
import mod from "./configuration-model";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
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

describe("Configuration Model", () => {
    it("produces a simple graph whose realized degrees match the stubs", () => {
        const input = mod.defaultInput as { degrees: number[]; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const edges = meta["edges"] as string[];
        const target = meta["target"] as number[];
        const realized = meta["realized"] as number[];
        expect(realized.length).toBe(target.length);
        for (let i = 0; i < target.length; i += 1) {
            expect(realized[i]!).toBeLessThanOrEqual(target[i]!);
        }
        expect(new Set(edges).size).toBe(edges.length);
        const degree = new Map<string, number>();
        for (const edge of edges) {
            const [a, b] = edge.split("-");
            expect(a).not.toBe(b);
            degree.set(a!, (degree.get(a!) ?? 0) + 1);
            degree.set(b!, (degree.get(b!) ?? 0) + 1);
        }
        realized.forEach((value, i) => {
            expect(value).toBe(degree.get(String.fromCharCode(65 + i)) ?? 0);
        });
        expect(realized.reduce((sum, value) => sum + value, 0)).toBe(2 * edges.length);
    });

    it("realizes a graphical sequence exactly and is deterministic", () => {
        const run = (): Record<string, unknown> => [...mod.run({ degrees: [2, 2, 2, 2, 2, 2], seed: 4 })].at(-1)!.meta;
        const a = run();
        const b = run();
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(a["target"]).toEqual([2, 2, 2, 2, 2, 2]);
        expect(a["realized"]).toEqual([2, 2, 2, 2, 2, 2]);
        expect((a["edges"] as string[]).length).toBe(6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
