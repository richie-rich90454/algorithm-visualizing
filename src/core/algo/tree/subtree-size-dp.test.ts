/**
 * subtree-size-dp.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./subtree-size-dp";
import type { VisualFrame } from "@/types";

type Parents = Record<string, string | null>;

/** Brute force: a vertex is in the subtree if following parent links reaches the target. */
function bruteSizes(parents: Parents, ids: string[]): number[] {
    return ids.map((target) => {
        let count = 0;
        for (const id of ids) {
            let cursor: string | null | undefined = id;
            let guard = 0;
            while (cursor && guard <= ids.length) {
                if (cursor === target) {
                    count += 1;
                    break;
                }
                cursor = parents[cursor];
                guard += 1;
            }
        }
        return count;
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Subtree Size DP", () => {
    it("computes the correct sizes on the default input", () => {
        const input = mod.defaultInput as { parentMap: Parents; ids: string[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["nodes"]).toEqual(input.ids);
        expect(finalMeta?.["sizes"]).toEqual(bruteSizes(input.parentMap, input.ids));
    });

    it("matches brute force on generated random trees", () => {
        let seed = 11;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 40; t += 1) {
            const n = 1 + (rand() % 9);
            const ids = Array.from({ length: n }, (_, i) => `v${i}`);
            const parents: Parents = { v0: null };
            for (let i = 1; i < n; i += 1) {
                parents[`v${i}`] = `v${rand() % i}`;
            }
            const frames = [...mod.run({ parentMap: parents, ids })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["sizes"]).toEqual(bruteSizes(parents, ids));
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
