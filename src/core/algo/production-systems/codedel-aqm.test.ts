import { describe, expect, it } from "vitest";
import mod from "./codedel-aqm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

interface Packet { arrival: number; service: number }

function bruteForceQueue(packets: Packet[]) {
    const departures: number[] = [];
    let finish = 0;
    for (const packet of packets) {
        finish = Math.max(packet.arrival, finish) + packet.service;
        departures.push(finish);
    }
    return {
        departures,
        sojourns: departures.map((departure, index) => departure - packets[index].arrival),
    };
}

describe("CoDel Active Queue Management", () => {
    it("simulates the FIFO queue exactly and drops only congested packets", () => {
        const input = mod.defaultInput as { packets: Packet[]; target: number; interval: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const expected = bruteForceQueue(input.packets);
        expect(meta?.["departures"]).toEqual(expected.departures);
        expect(meta?.["sojourns"]).toEqual(expected.sojourns);

        const drops = meta?.["drops"] as number[];
        const dropCounts = meta?.["dropCounts"] as number[];
        expect(drops.length).toBeGreaterThan(0);
        expect(dropCounts).toEqual(drops.map((_, index) => index + 1));
        const sojourns = meta?.["sojourns"] as number[];
        for (const index of drops) {
            expect(sojourns[index]).toBeGreaterThan(input.target);
        }
        expect((meta?.["firstAbove"] as number) >= 0).toBe(true);
        const firstDropTime = (meta?.["departures"] as number[])[drops[0]] ?? 0;
        expect(firstDropTime - (meta?.["firstAbove"] as number)).toBeGreaterThanOrEqual(input.interval);
    });

    it("drops nothing when the queue never exceeds the target delay", () => {
        const frames = [...mod.run({
            packets: [
                { arrival: 0, service: 10 }, { arrival: 20, service: 10 },
                { arrival: 40, service: 10 }, { arrival: 60, service: 10 },
            ],
            target: 10,
            interval: 50,
        })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["drops"]).toEqual([]);
        expect(meta?.["droppedCount"]).toBe(0);
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
