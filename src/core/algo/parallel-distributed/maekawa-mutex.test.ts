/**
 * maekawa-mutex.test.ts - Quorum-intersection property, mutual exclusion, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./maekawa-mutex";
import type { VisualFrame } from "@/types";

function quorum(proc: number, m: number): number[] {
    const r = Math.floor(proc / m);
    const c = proc % m;
    const out: number[] = [];
    for (let j = 0; j < m * m; j += 1) {
        if (Math.floor(j / m) === r || j % m === c) out.push(j);
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

describe("MaekawaMutex", () => {
    it("every pair of quorums intersects (brute force over the grid)", () => {
        for (const m of [2, 3, 4]) {
            const n = m * m;
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    const a = new Set(quorum(i, m));
                    const b = new Set(quorum(j, m));
                    expect([...a].some((v) => b.has(v))).toBe(true);
                }
            }
        }
    });

    it("never shows two processes in the critical section at once", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const inCS = frame.entities.filter((e) => e.metadata["inCS"] === true);
            expect(inCS.length).toBeLessThanOrEqual(1);
        }
    });

    it("serializes every request and grants hold the whole quorum", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const grants = frames.filter((f) => (f.meta["last"] as string).includes("enters the critical section"));
        expect(grants.length).toBe((mod.defaultInput as { requests: number[] }).requests.length);
        for (const g of grants) {
            const q = g.meta["quorum"] as number[];
            const held = g.meta["held"] as number[];
            expect(q.every((v) => held.includes(v))).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(gen.next().done).toBe(true);
    });
});
