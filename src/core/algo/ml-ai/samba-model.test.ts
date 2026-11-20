/**
 * samba-model.test.ts - Independent hybrid-layer recomputation, identity
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { samba } from "./samba-model";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function reference(tokens: number[], layers: number, window: number, decay: number, write: number) {
    let x = tokens.slice();
    const perLayer = [x.slice()];
    for (let l = 0; l < layers; l += 1) {
        const out: number[] = [];
        if (l % 2 === 0) {
            let state = 0;
            for (const v of x) {
                state = decay * state + write * v;
                out.push(state);
            }
        } else {
            for (let i = 0; i < x.length; i += 1) {
                let sum = 0;
                let count = 0;
                for (let j = Math.max(0, i - window + 1); j <= i; j += 1) {
                    sum += x[j];
                    count += 1;
                }
                out.push(sum / count);
            }
        }
        x = out;
        perLayer.push(x.slice());
    }
    return { perLayer, output: x };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("Samba hybrid model", () => {
    it("matches an independent hybrid-layer computation", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const tokens = Array.from({ length: 5 }, (_, i) => ((i * 3 + seed) % 7) / 2 - 1.5);
            const params = { layers: 1 + (seed % 5), window: 1 + (seed % 4), decay: 0.3 + seed / 20, write: 0.7 + seed / 30 };
            const got = samba(tokens, params);
            const ref = reference(tokens, params.layers, params.window, params.decay, params.write);
            expect(got.perLayer).toEqual(ref.perLayer);
            expect(got.output).toEqual(ref.output);
        }
    });

    it("reduces each mixer to the identity at its degenerate setting", () => {
        const tokens = [1, -2, 3, 0.5];
        expect(samba(tokens, { layers: 1, decay: 0, write: 1 }).output).toEqual(tokens);
        // Two layers: SSM identity then a window of one is also the identity.
        expect(samba(tokens, { layers: 2, decay: 0, write: 1, window: 1 }).output).toEqual(tokens);
        expect(samba(tokens, { layers: 4 }).output.length).toBe(tokens.length);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const input = mod.defaultInput as { layers: number };
        expect(frames.length).toBe(2 + input.layers);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
