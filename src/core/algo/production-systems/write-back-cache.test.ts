/**
 * write-back-cache.test.ts - Reference cache simulation and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./write-back-cache";
import type { VisualFrame } from "@/types";

type Op = { op: "read" | "write" | "flush"; addr?: number; value?: number };

function reference(capacity: number, initial: Array<[number, number]>, ops: Op[]) {
  const memory = new Map<number, number>(initial);
  const cache = Array.from({ length: capacity }, () => ({
    addr: -1,
    value: 0,
    dirty: false,
    valid: false,
  }));
  let hits = 0;
  let misses = 0;
  let writebacks = 0;
  let memoryWrites = 0;
  for (const op of ops) {
    if (op.op === "flush") {
      for (const line of cache) {
        if (line.valid && line.dirty) {
          memory.set(line.addr, line.value);
          writebacks += 1;
          memoryWrites += 1;
          line.dirty = false;
        }
      }
      continue;
    }
    const addr = op.addr as number;
    const idx = addr % capacity;
    const line = cache[idx]!;
    if (line.valid && line.addr === addr) {
      hits += 1;
    } else {
      misses += 1;
      if (line.valid && line.dirty) {
        memory.set(line.addr, line.value);
        writebacks += 1;
        memoryWrites += 1;
      }
      cache[idx] = { addr, value: memory.get(addr) ?? 0, dirty: false, valid: true };
    }
    if (op.op === "write") {
      cache[idx]!.value = op.value ?? 0;
      cache[idx]!.dirty = true;
    }
  }
  return { memory, hits, misses, writebacks, memoryWrites };
}

function checkFrames(frames: VisualFrame[], capacity: number, addressCount: number, opCount: number): void {
  expect(frames.length).toBe(opCount + 2);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("grid");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(capacity + addressCount);
    expect(frame.entities.filter((e) => e.metadata.row === 0).length).toBe(capacity);
    expect(frame.entities.filter((e) => e.metadata.row === 1).length).toBe(addressCount);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Write-back cache", () => {
  const input = mod.defaultInput as {
    capacity: number;
    initialMemory: Array<[number, number]>;
    ops: Op[];
  };

  it("matches an independent cache simulation exactly", () => {
    const frames = [...mod.run(input)];
    const addresses = [...new Set([...input.initialMemory.map(([a]) => a), ...input.ops.map((o) => o.addr ?? -1)])]
      .filter((a) => a >= 0)
      .sort((a, b) => a - b);
    checkFrames(frames, input.capacity, addresses.length, input.ops.length);
    const ref = reference(input.capacity, input.initialMemory, input.ops);
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["hits"]).toBe(ref.hits);
    expect(meta?.["misses"]).toBe(ref.misses);
    expect(meta?.["writebacks"]).toBe(ref.writebacks);
    expect(meta?.["memoryWrites"]).toBe(ref.memoryWrites);
    expect(meta?.["addresses"] as number[]).toEqual(addresses);
    const memory = meta?.["memory"] as number[];
    addresses.forEach((addr, i) => {
      expect(memory[i]).toBe(ref.memory.get(addr) ?? 0);
    });
  });

  it("leaves memory equal to applying all writes directly after a flush", () => {
    const frames = [...mod.run(input)];
    const expected = new Map<number, number>(input.initialMemory);
    for (const op of input.ops) {
      if (op.op === "write") expected.set(op.addr as number, op.value as number);
    }
    const meta = frames[frames.length - 1]?.meta;
    const addresses = meta?.["addresses"] as number[];
    const memory = meta?.["memory"] as number[];
    addresses.forEach((addr, i) => {
      expect(memory[i]).toBe(expected.get(addr) ?? 0);
    });
    expect(meta?.["memoryWrites"] as number).toBeLessThan(meta?.["writes"] as number);
  });

  it("writes back only dirty lines when evicting", () => {
    const ops: Op[] = [
      { op: "read", addr: 0 },
      { op: "read", addr: 4 },
      { op: "write", addr: 0, value: 99 },
      { op: "write", addr: 4, value: 88 },
    ];
    const frames = [...mod.run({ capacity: 4, initialMemory: [[0, 0], [4, 0]], ops })];
    const ref = reference(4, [[0, 0], [4, 0]], ops);
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["writebacks"]).toBe(ref.writebacks);
    expect(meta?.["memoryWrites"]).toBe(ref.memoryWrites);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
