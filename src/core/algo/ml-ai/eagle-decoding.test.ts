/** eagle-decoding.test.ts - Branch verification, bonus token, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { makeTargetFromMap, verifyDraftTree } from "./eagle-decoding";
import type { VisualFrame } from "@/types";

type DraftNode = { id: number; parent: number; token: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("EAGLE decoding", () => {
    it("accepts the longest matching branch and appends the target bonus", () => {
        const input = mod.defaultInput as {
            prompt: number[];
            nodes: DraftNode[];
            targetMap: Record<string, number>;
        };
        const lookup = makeTargetFromMap(input.targetMap);
        const result = verifyDraftTree(input.nodes, input.prompt, (ctx) => lookup(ctx, input.prompt.length));
        expect(result.tokens).toEqual([1, 2, 3, 8]);
        expect(result.accepted).toEqual([0, 1, 3, 5]);
        expect(result.bonus).toBe(9);
        expect(result.sequence).toEqual([0, 1, 2, 3, 8, 9]);
        expect(result.visited).toContain(2);
    });

    it("accepts nothing when every draft token is wrong", () => {
        const nodes: DraftNode[] = [{ id: 0, parent: -1, token: 9 }];
        const result = verifyDraftTree(nodes, [0], () => 3);
        expect(result.tokens).toEqual([]);
        expect(result.sequence).toEqual([0, 3]);
    });

    it("chooses the longest among competing branches", () => {
        const nodes: DraftNode[] = [
            { id: 0, parent: -1, token: 1 },
            { id: 1, parent: 0, token: 4 },
            { id: 2, parent: 0, token: 2 },
            { id: 3, parent: 2, token: 5 },
        ];
        const map: Record<string, number> = { "": 1, "1": 2, "1,2": 5, "1,2,5": 7, "1,4": 9 };
        const lookup = makeTargetFromMap(map);
        const result = verifyDraftTree(nodes, [], (ctx) => lookup(ctx, 0));
        expect(result.accepted).toEqual([0, 2, 3]);
        expect(result.bonus).toBe(7);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
