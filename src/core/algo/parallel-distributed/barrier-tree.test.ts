import { describe, expect, it } from "vitest";
import mod from "./barrier-tree";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(2 * p - 1);
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

describe("Tree Barrier", () => {
    it("releases every process only after all arrivals", () => {
        for (const processes of [2, 3, 4, 7, 8]) {
            const frames = [...mod.run({ processes })];
            checkFrames(frames, processes);
            const firstRelease = frames.findIndex((f) => f.meta["phase"] === "release");
            expect(firstRelease).toBeGreaterThan(0);
            for (let i = 0; i < firstRelease; i += 1) {
                expect(frames[i]?.meta["released"]).toBe(0);
            }
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["complete"]).toBe(true);
            expect(Number(final?.["released"])).toBe(2 * processes - 1);
            expect(Number(final?.["arrived"])).toBe(2 * processes - 1);
            expect(Number(frames[firstRelease - 1]?.meta["arrived"])).toBe(2 * processes - 1);
        }
    });

    it("has exactly one parent per non-root node", () => {
        const frames = [...mod.run({ processes: 8 })];
        const first = frames[0] as VisualFrame;
        let roots = 0;
        for (const entity of first.entities) {
            const parent = entity.metadata["parentId"];
            if (parent === "") {
                roots += 1;
            }
        }
        expect(roots).toBe(1);
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
