/**
 * least-connections-load-balancing.test.ts - Independent greedy simulation, tie rotation, weights, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./least-connections-load-balancing";
import type { VisualFrame } from "@/types";

interface Backend { id: string; weight?: number }
interface Event { type: "request" | "complete"; backend?: string; count?: number }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

/** Independent greedy reference for the chosen sequence and final active counts. */
function reference(backends: Backend[], events: Event[], initial: Record<string, number> = {}): { chosen: string[]; active: number[] } {
    const ids = backends.map((b) => b.id);
    const weights = backends.map((b) => b.weight ?? 1);
    const active = ids.map((id) => Math.max(0, Math.floor(initial[id] ?? 0)));
    const lastChosen = ids.map(() => 0);
    const chosen: string[] = [];
    let sequence = 0;
    for (const event of events) {
        if (event.type === "request") {
            let best = 0;
            for (let i = 1; i < ids.length; i += 1) {
                const score = active[i] / weights[i];
                const bestScore = active[best] / weights[best];
                if (score < bestScore - 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && lastChosen[i] < lastChosen[best])) best = i;
            }
            active[best] += 1;
            lastChosen[best] = ++sequence;
            chosen.push(ids[best]);
        } else {
            const index = ids.indexOf(event.backend ?? "");
            if (index >= 0) active[index] = Math.max(0, active[index] - (event.count ?? 1));
        }
    }
    return { chosen, active };
}

describe("LeastConnectionsLoadBalancing", () => {
    it("assigns exactly like the independent greedy model", () => {
        const input = mod.defaultInput as { backends: Backend[]; events: Event[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const expected = reference(input.backends, input.events);
        expect(meta?.["chosen"]).toEqual(expected.chosen);
        expect(meta?.["active"]).toEqual(expected.active);
        expect(meta?.["chosen"]).toEqual(["a", "b", "c", "b", "a"]);
    });

    it("rotates fairly when all scores tie", () => {
        const backends = [{ id: "x" }, { id: "y" }, { id: "z" }];
        const events: Event[] = Array.from({ length: 3 }, () => ({ type: "request" }));
        const frames = [...mod.run({ backends, events })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["chosen"]).toEqual(["x", "y", "z"]);
    });

    it("uses active connections divided by weight when backends are weighted", () => {
        const backends = [{ id: "small", weight: 1 }, { id: "large", weight: 2 }];
        const events: Event[] = [{ type: "request" }, { type: "request" }];
        const initial = { small: 2, large: 2 };
        const frames = [...mod.run({ backends, events, initialActive: initial })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["chosen"]).toEqual(reference(backends, events, initial).chosen);
        expect(meta?.["chosen"]).toEqual(["large", "large"]);
        const scores = meta?.["scores"] as number[];
        expect(scores[0]).toBeCloseTo(2, 12);
        expect(scores[1]).toBeCloseTo(2, 12);
    });

    it("never lets a completion drive a count below zero", () => {
        const frames = [...mod.run({
            backends: [{ id: "a" }],
            events: [{ type: "complete", backend: "a", count: 5 } as Event],
        })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["active"]).toEqual([0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
