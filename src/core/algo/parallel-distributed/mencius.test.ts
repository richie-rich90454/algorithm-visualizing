/**
 * mencius.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mencius";
import type { VisualFrame } from "@/types";

interface Command {
    id: string;
    origin: number;
}

/** Independent replay of the round-robin slot assignment. */
function reference(commands: Command[], replicas: number): string[] {
    const queues: Command[][] = Array.from({ length: replicas }, () => []);
    for (const cmd of commands) {
        queues[cmd.origin % replicas]?.push(cmd);
    }
    const decided: string[] = [];
    for (let slot = 0; slot < commands.length * replicas + replicas; slot += 1) {
        const owner = slot % replicas;
        const cmd = queues[owner]?.shift();
        if (cmd) {
            decided.push(cmd.id);
        }
        if (queues.every((queue) => queue.length === 0)) {
            break;
        }
    }
    return decided;
}

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

describe("Mencius Consensus", () => {
    it("agrees on a log that matches an independent reference", () => {
        const input = mod.defaultInput as { replicas: number; commands: Command[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const decided = finalMeta?.["decided"] as string[];
        expect(decided).toEqual(reference(input.commands, input.replicas));
        expect(decided.slice().sort()).toEqual(input.commands.map((cmd) => cmd.id).sort());
        expect(new Set(decided).size).toBe(decided.length);
    });

    it("emits skips for idle owners but never loses a command", () => {
        const commands: Command[] = [
            { id: "x", origin: 0 },
            { id: "y", origin: 0 },
        ];
        const frames = [...mod.run({ replicas: 3, commands })];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["skips"]).toBeGreaterThan(0);
        expect(last?.["decided"]).toEqual(["x", "y"]);
        expect(last?.["committed"]).toBe(2);
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
