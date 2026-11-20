/** prediction-by-partial-matching.test.ts - Reference probability check and frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./prediction-by-partial-matching";
import type { VisualFrame } from "@/types";

function reference(sequence: string[], order: number) {
    const probabilities: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < sequence.length; i += 1) {
        const model = new Map<string, Map<string, number>>();
        for (let j = 0; j < i; j += 1) {
            for (let d = 1; d <= order; d += 1) {
                if (j < d) continue;
                const ctx = sequence.slice(j - d, j).join("");
                if (!model.has(ctx)) model.set(ctx, new Map());
                const table = model.get(ctx);
                const sym = sequence[j] ?? "";
                table?.set(sym, (table.get(sym) ?? 0) + 1);
            }
        }
        const sym = sequence[i] ?? "";
        let p = 1 / Math.max(1, seen.size + 1);
        for (let d = order; d >= 1; d -= 1) {
            if (i < d) continue;
            const table = model.get(sequence.slice(i - d, i).join(""));
            if (!table) continue;
            const total = [...table.values()].reduce((sum, v) => sum + v, 0);
            if (total === 0) continue;
            const count = table.get(sym) ?? 0;
            p = count > 0 ? count / total : 1 / (total + 1);
            break;
        }
        probabilities.push(p);
        seen.add(sym);
    }
    const totalBits = probabilities.reduce((sum, p) => sum - Math.log2(p), 0);
    return { probabilities, totalBits };
}

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("prediction-by-partial-matching", () => {
    it("matches an independent PPM model on the default input", () => {
        const input = mod.defaultInput as { sequence: string; order: number };
        const sequence = [...input.sequence];
        const frames = [...mod.run(input)];
        checkFrames(frames, sequence.length);
        const expected = reference(sequence, input.order);
        const final = frames[frames.length - 1]?.meta;
        const got = final?.["probabilities"] as number[];
        expect(got.length).toBe(expected.probabilities.length);
        for (let i = 0; i < got.length; i += 1) expect(got[i]).toBeCloseTo(expected.probabilities[i] ?? 0, 10);
        expect(Number(final?.["totalBits"])).toBeCloseTo(expected.totalBits, 10);
    });

    it("keeps probabilities valid and code length monotone", () => {
        const input = { sequence: "mississippi", order: 2 };
        const frames = [...mod.run(input)];
        let previous = 0;
        for (let i = 1; i < frames.length - 1; i += 1) {
            const p = Number(frames[i]?.meta["probability"]);
            const bits = Number(frames[i]?.meta["bits"]);
            expect(p).toBeGreaterThan(0);
            expect(p).toBeLessThanOrEqual(1);
            expect(bits).toBeGreaterThanOrEqual(0);
            previous += bits;
            expect(Number(frames[i]?.meta["totalBits"])).toBeCloseTo(previous, 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
