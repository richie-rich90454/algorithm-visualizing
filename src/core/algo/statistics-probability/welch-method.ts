/**
 * welch-method.ts - Welch's Method for Power Spectral Estimation
 *
 * Welch's method reduces the noise of a periodogram by splitting the signal
 * into overlapping segments, tapering each with a Hann window, computing a
 * periodogram per segment, and averaging those periodograms. Averaging lowers
 * variance at the cost of frequency resolution.
 *
 * Time: O(segments * length^2). Space: O(length).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Symmetric Hann window of the requested length. */
export function hannWindow(length: number): number[] {
  return Array.from({ length }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1))));
}

/** Two-sided periodogram of one real segment, normalized by its length. */
export function periodogram(segment: number[]): number[] {
  const n = segment.length;
  const spectrum: number[] = [];
  for (let k = 0; k < n; k += 1) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t += 1) {
      const angle = (-2 * Math.PI * k * t) / n;
      re += (segment[t] as number) * Math.cos(angle);
      im += (segment[t] as number) * Math.sin(angle);
    }
    spectrum.push((re * re + im * im) / n);
  }
  return spectrum;
}

export interface WelchResult {
  psd: number[];
  segmentPsd: number[][];
  segments: number;
  length: number;
  peakBin: number;
}

/** Average the Hann-windowed periodograms of overlapping segments. */
export function welchPsd(signal: number[], length: number, overlap: number): WelchResult {
  const n = Math.max(4, Math.floor(length));
  const step = Math.max(1, n - Math.max(0, Math.floor(overlap)));
  const window = hannWindow(n);
  const segmentPsd: number[][] = [];
  const psd = new Array<number>(n).fill(0);
  for (let start = 0; start + n <= signal.length; start += step) {
    const tapered = signal.slice(start, start + n).map((value, i) => value * (window[i] as number));
    const spectrum = periodogram(tapered);
    segmentPsd.push(spectrum);
    for (let k = 0; k < n; k += 1) psd[k] = (psd[k] as number) + (spectrum[k] as number);
  }
  const segments = Math.max(1, segmentPsd.length);
  const averaged = psd.map((value) => value / segments);
  let peakBin = 0;
  for (let k = 1; k < averaged.length; k += 1) {
    if ((averaged[k] as number) > (averaged[peakBin] as number)) peakBin = k;
  }
  return { psd: averaged, segmentPsd, segments, length: n, peakBin };
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `bin-${i}`,
    type: "bar" as const,
    label: `bin ${i}: ${value.toFixed(2)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { bin: i, power: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { length?: number; frequency?: number; overlap?: number; noise?: number; seed?: number } | null) ?? {};
  const length = Math.max(8, Math.min(64, Math.floor(Number(task.length ?? 32)) || 32));
  const frequency = Math.max(1, Math.min(length / 2 - 1, Math.floor(Number(task.frequency ?? 6)) || 6));
  const overlap = Math.max(0, Math.min(length - 1, Math.floor(Number(task.overlap ?? length / 2)) || 0));
  const noise = Number(task.noise) >= 0 ? Number(task.noise) : 0.4;
  const seed = Math.floor(Number(task.seed ?? 27)) || 27;

  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const total = length * 6;
  const signal = Array.from(
    { length: total },
    (_, i) => Math.cos((2 * Math.PI * frequency * i) / length) + noise * (random() * 2 - 1),
  );
  const result = welchPsd(signal, length, overlap);
  const half = result.psd.slice(0, length / 2 + 1);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(half, -1),
    edges: [],
    description: `Welch spectral estimate from ${result.segments} overlapping ${length}-point Hann-windowed segments.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { segments: result.segments, length, overlap, frequency },
  };
  index += 1;

  for (let i = 0; i < Math.min(result.segments, 8); i += 1) {
    yield {
      stepNumber: index,
      entities: bars(result.segmentPsd[i]?.slice(0, length / 2 + 1) ?? [], i),
      edges: [],
      description: `Segment ${i}: individual periodogram before averaging.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { segment: i, points: length },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(half, half.length - 1),
    edges: [],
    description: `Averaged periodogram peaks at bin ${result.peakBin}, near the injected frequency ${frequency}.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { peakBin: result.peakBin, frequency, psd: half, segments: result.segments, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "A raw periodogram is noisy: doubling the record length adds points but does not reduce the variance at each frequency. Welch's method trades resolution for stability by chopping the signal into overlapping pieces, tapering each so edges do not leak, and averaging their spectra. The averaged estimate has far less scatter and reveals tones buried in noise.",
    invariants: [
      "Every segment uses the same Hann window and length.",
      "The averaged spectrum is the arithmetic mean of the segment periodograms.",
      "For a real signal the two-sided periodogram is symmetric about zero frequency.",
    ],
    correctness:
      "The discrete Fourier transform of a real sequence satisfies X(n-k) equal to the conjugate of X(k), so the periodogram magnitude is symmetric. Each tapered segment is an unbiased estimate of a smoothed local spectrum, and averaging independent overlapping segments reduces variance roughly by the number of segments. The Hann taper lowers spectral leakage by forcing segment endpoints toward zero, which suppresses the boxcar window's slow side-lobe decay.",
    complexityRationale:
      "A direct periodogram of an L-point segment costs O(L squared); with S segments the total is O(S L squared) time and O(L) space to hold one spectrum at a time plus the averaged result.",
    uses: [
      "Spectrum analyzers and vibration monitoring",
      "Detecting periodic signals in astronomy and physiology",
      "Audio equalization and speech feature extraction",
    ],
    references: [
      "Welch, The Use of Fast Fourier Transform for the Estimation of Power Spectra, 1967",
      "Oppenheim and Schafer, Discrete-Time Signal Processing, Chapter 10",
    ],
    workedExample:
      "A 512-point signal containing a cosine at bin 6 plus noise is split into overlapping 32-point Hann-windowed segments. Each segment periodogram peaks near bin 6, but with scatter. Averaging the segment spectra sharpens the peak at bin 6 and flattens the noisy floor, giving a stable estimate of the tone's power.",
  },
  id: "welch-method",
  name: "Welch Method",
  category: "statistics-probability",
  complexity: { time: "O(segments * length^2)", space: "O(length)" },
  defaultInput: { length: 32, frequency: 6, overlap: 16, noise: 0.4, seed: 27 },
  visualType: "array",
  run,
  pseudocode: [
    "input signal, segment length, and overlap",
    "form a Hann window of the segment length",
    "for each overlapping segment multiply by the window",
    "compute the periodogram of the tapered segment",
    "average all segment periodograms bin by bin",
    "locate the bin with maximum averaged power",
    "done: report the averaged spectrum and peak bin",
  ],
};

export default module;
