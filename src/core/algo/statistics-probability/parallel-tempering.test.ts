/**
 * parallel-tempering.test.ts - Independent swap and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  replicaExchange,
  swapAcceptance,
  temperatureLadder,
} from "./parallel-tempering";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(frame.edges).toEqual([]);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Parallel tempering", () => {
  it("builds a geometric ladder with exact endpoints", () => {
    const ladder = temperatureLadder(0.01, 1, 6);
    expect(ladder[0]).toBeCloseTo(0.01, 12);
    expect(ladder.at(-1)).toBeCloseTo(1, 12);
    for (let i = 1; i < ladder.length; i += 1) {
      expect((ladder[i] as number) / (ladder[i - 1] as number)).toBeCloseTo(
        Math.pow(100, 1 / 5),
        12,
      );
    }
  });

  it("keeps acceptance in range and favors favorable swaps", () => {
    expect(swapAcceptance(1, 0.5, 0.2, 2)).toBeCloseTo(Math.exp(-0.9), 12);
    expect(swapAcceptance(1, 0.5, 2, 0.2)).toBe(1);
    for (const uI of [-3, 0, 4]) {
      for (const uJ of [-2, 1, 5]) {
        const a = swapAcceptance(1, 0.2, uI, uJ);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it("satisfies the swap detailed-balance ratio", () => {
    const betaI = 1.2;
    const betaJ = 0.4;
    const uI = 0.7;
    const uJ = 2.3;
    const forward = swapAcceptance(betaI, betaJ, uI, uJ);
    const reverse = swapAcceptance(betaI, betaJ, uJ, uI);
    const targetRatio = Math.exp((betaI - betaJ) * (uI - uJ));
    expect(forward / reverse).toBeCloseTo(targetRatio, 10);
  });

  it("exchanges energies deterministically with a seed", () => {
    const betas = temperatureLadder(0.1, 1, 4);
    const energies = [3, 2, 1, 0];
    const a = replicaExchange(betas, energies, 6, 17);
    const b = replicaExchange(betas, energies, 6, 17);
    expect(a.energies).toEqual(b.energies);
    expect(a.swaps).toBe(b.swaps);
    expect(a.swaps).toBeGreaterThanOrEqual(0);
    expect(a.swaps).toBeLessThanOrEqual(3 * 6);
    expect([...a.energies].sort((x, y) => x - y)).toEqual([...energies].sort((x, y) => x - y));
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
