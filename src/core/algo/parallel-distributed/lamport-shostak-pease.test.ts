/**
 * lamport-shostak-pease.test.ts - Exhaustive consensus properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lamport-shostak-pease";
import type { VisualFrame } from "@/types";

function patterns(length: number): number[][] {
    const out: number[][] = [];
    for (let mask = 0; mask < 2 ** length; mask += 1) {
        out.push(Array.from({ length }, (_, i) => ((mask >> i) & 1)));
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("LamportShostakPease", () => {
    it("reaches agreement for every initial pattern (exhaustive, n-f odd)", () => {
        const cases = [
            { n: 4, crashed: [3] },
            { n: 5, crashed: [3, 4] },
        ];
        for (const { n, crashed } of cases) {
            const survivorCount = n - crashed.length;
            for (const survivorValues of patterns(survivorCount)) {
                const values: number[] = [];
                let s = 0;
                for (let i = 0; i < n; i += 1) {
                    if (crashed.includes(i)) values.push(0);
                    else values.push(survivorValues[s++]!);
                }
                const frames = [...mod.run({ processes: n, values, crashed })];
                checkFrames(frames);
                const final = frames.at(-1)!;
                const survivors = final.meta["survivors"] as number[];
                expect(survivors.every((v) => v === survivors[0])).toBe(true);
                expect(final.meta["decided"]).toBe(survivors[0]);
            }
        }
    });

    it("preserves validity: uniform survivor inputs decide that value", () => {
        for (const v of [0, 1]) {
            const frames = [...mod.run({ processes: 5, values: [v, v, v, 1 - v, 1 - v], crashed: [3, 4] })];
            expect(frames.at(-1)!.meta["decided"]).toBe(v);
        }
    });

    it("terminates after exactly f+1 rounds plus setup and result", () => {
        for (const crashed of [[], [3], [3, 4]]) {
            const frames = [...mod.run({ processes: 5, values: [1, 0, 1, 0, 1], crashed })];
            checkFrames(frames);
            expect(frames.length).toBe(crashed.length + 1 + 2);
        }
    });

    it("runs cleanly on the default input", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(3 + 2);
        expect(gen.next().done).toBe(true);
    });
});
