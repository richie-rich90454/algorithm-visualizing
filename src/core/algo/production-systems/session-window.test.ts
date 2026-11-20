/** session-window.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./session-window";
import type { VisualFrame } from "@/types";

type Event = { id: string; time: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function reference(events: Event[], gap: number): string[][] {
    const sorted = events.slice().sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const sessions: string[][] = [];
    let previous: number | null = null;
    for (const event of sorted) {
        if (previous === null || event.time - previous > gap) sessions.push([]);
        sessions[sessions.length - 1]?.push(event.id);
        previous = event.time;
    }
    return sessions;
}

describe("Session Window", () => {
    it("groups the default events into the expected sessions", () => {
        const input = mod.defaultInput as { events: Event[]; gap: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["sessions"]).toEqual(reference(input.events, input.gap));
    });

    it("matches a reference over random event streams", () => {
        let seed = 2024;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const count = 1 + rand(15);
            const events: Event[] = Array.from({ length: count }, (_, i) => ({ id: `e${i}`, time: rand(60) }));
            const gap = rand(10);
            const frames = [...mod.run({ events, gap })];
            const last = frames[frames.length - 1];
            expect(last?.meta["sessions"]).toEqual(reference(events, gap));
            const flat = (last?.meta["sessions"] as string[][]).flat();
            expect(flat.length).toBe(events.length);
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
