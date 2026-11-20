/**
 * all-gather.test.ts - Full-buffer equality property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./all-gather";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(frame.meta["cols"]);
        expect(frame.entities.length).toBe((frame.meta["rows"] as number) ** 2);
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.edges).toEqual([]);
    });
}

describe("AllGather", () => {
    it("gives every process the identical concatenation of all chunks", () => {
        const cases: number[][][] = [
            (mod.defaultInput as { chunks: number[][] }).chunks,
            [[1], [2]],
            [[1, 2, 3], [4], [5, 6], [7, 8, 9]],
            [[0], [1], [2], [3], [4], [5], [6], [7]],
        ];
        for (const chunks of cases) {
            const frames = [...mod.run({ chunks })];
            checkFrames(frames);
            const expected = chunks.flat();
            const final = frames.at(-1)!;
            expect(final.meta["complete"]).toBe(true);
            const buffers = (final.meta["buffers"] as string[]).map((s) => (s === "" ? [] : s.split(",").map(Number)));
            for (const buf of buffers) expect(buf).toEqual(expected);
        }
    });

    it("each process starts with only its own chunk", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const first = frames[0]!;
        const held = first.entities.filter((e) => e.metadata["held"] === true);
        expect(held.length).toBe((mod.defaultInput as { chunks: number[][] }).chunks.length);
        for (const e of held) expect(e.metadata["row"]).toBe(e.metadata["col"]);
    });

    it("performs log2(p) exchange rounds", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const rounds = frames.length - 2;
        expect(rounds).toBe(2);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(4);
        expect(gen.next().done).toBe(true);
    });
});
