/** warnsdorff-knights-tour.test.ts - Independent greedy reference, tour validity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./warnsdorff-knights-tour";
import type { VisualFrame } from "@/types";

const MOVES: Array<[number, number]> = [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1],
];

/** Independent Warnsdorff reference returning the full tour as strings. */
function referenceTour(n: number, start: [number, number]): string[] {
    const key = (r: number, c: number): string => `${r},${c}`;
    const visited = new Set<string>([key(start[0], start[1])]);
    const path: string[] = [key(start[0], start[1])];
    let [r, c] = start;
    const onward = (pr: number, pc: number): Array<[number, number]> => {
        const out: Array<[number, number]> = [];
        for (const [dr, dc] of MOVES) {
            const nr = pr + dr;
            const nc = pc + dc;
            if (nr >= 0 && nr < n && nc >= 0 && nc < n && !visited.has(key(nr, nc))) {
                out.push([nr, nc]);
            }
        }
        return out;
    };
    while (path.length < n * n) {
        const candidates = onward(r, c);
        if (candidates.length === 0) break;
        candidates.sort((a, b) => {
            const da = onward(a[0], a[1]).length;
            const db = onward(b[0], b[1]).length;
            return da - db || a[0] - b[0] || a[1] - b[1];
        });
        [r, c] = candidates[0] as [number, number];
        visited.add(key(r, c));
        path.push(key(r, c));
    }
    return path;
}

function finalMeta(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const e of frame.edges) {
            expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
            expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Warnsdorff knight's tour", () => {
    it("matches an independent greedy reference on many boards and starts", () => {
        const cases: Array<{ size: number; start: [number, number] }> = [
            { size: 5, start: [0, 0] },
            { size: 5, start: [2, 2] },
            { size: 6, start: [1, 1] },
            { size: 7, start: [0, 0] },
            { size: 4, start: [0, 0] },
        ];
        for (const c of cases) {
            const meta = finalMeta(c);
            const actual = String(meta["path"] ?? "").split("|");
            const expected = referenceTour(c.size, c.start);
            expect(actual).toEqual(expected);
            expect(meta["steps"]).toBe(expected.length);
            expect(meta["complete"]).toBe(expected.length === c.size * c.size);
        }
    });

    it("produces a valid tour whenever the complete flag is set", () => {
        for (const size of [5, 6, 7, 8]) {
            const meta = finalMeta({ size, start: [0, 0] });
            if (meta["complete"] !== true) continue;
            const cells = String(meta["path"] ?? "").split("|").map((s) => s.split(",").map(Number));
            expect(cells.length).toBe(size * size);
            expect(new Set(cells.map((p) => p.join(","))).size).toBe(size * size);
            for (let i = 1; i < cells.length; i += 1) {
                const [pr, pc] = cells[i - 1] as number[];
                const [cr, cc] = cells[i] as number[];
                const legal = MOVES.some(([dr, dc]) => pr + dr === cr && pc + dc === cc);
                expect(legal).toBe(true);
            }
        }
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
