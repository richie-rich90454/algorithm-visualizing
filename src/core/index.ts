/**
 * index.ts – The algorithm registry.
 *
 * The registry is a central lookup table that maps kebab-case algorithm ids
 * (e.g. `"bubble-sort"`) to their `AlgorithmModule` objects. The sidebar
 * builds its category tree from `getAllAlgorithms()`, and the store resolves
 * a selected id with `getAlgorithm()`.
 *
 * Every algorithm file registers itself here, so this file grows exactly in
 * lockstep with the algorithm library. Keeping registration explicit (rather
 * than glob-importing the folder) keeps the module graph obvious and lets the
 * TypeScript compiler verify every reference at build time.
 */

import type { AlgorithmModule } from "@/types";

// ----------------------------------------------------------------------
// Algorithm registrations.
//
// Every algorithm module registers itself here with a single import + call,
// so the registry grows exactly in lockstep with the algorithm library.
// ----------------------------------------------------------------------

import bubbleSort from "./algo/sort/bubble-sort";
import bucketSort from "./algo/sort/bucket-sort";
import cocktailShakerSort from "./algo/sort/cocktail-shaker-sort";
import combSort from "./algo/sort/comb-sort";
import countingSort from "./algo/sort/counting-sort";
import heapSort from "./algo/sort/heap-sort";
import insertionSort from "./algo/sort/insertion-sort";
import introsort from "./algo/sort/introsort";
import mergeSortBottomUp from "./algo/sort/merge-sort-bottom-up";
import mergeSortTopDown from "./algo/sort/merge-sort-top-down";
import monkeySort from "./algo/sort/monkey-sort";
import patienceSort from "./algo/sort/patience-sort";
import quickSort3Way from "./algo/sort/quick-sort-3-way";
import quickSortHoare from "./algo/sort/quick-sort-hoare";
import quickSortLomuto from "./algo/sort/quick-sort-lomuto";
import radixSortLsd from "./algo/sort/radix-sort-lsd";
import radixSortMsd from "./algo/sort/radix-sort-msd";
import selectionSort from "./algo/sort/selection-sort";
import shellSort from "./algo/sort/shell-sort";
import smoothSort from "./algo/sort/smooth-sort";
import timSort from "./algo/sort/tim-sort";
import linearSearch from "./algo/search/linear-search";
import binarySearchIterative from "./algo/search/binary-search-iterative";
import binarySearchLowerBound from "./algo/search/binary-search-lower-bound";
import binarySearchRecursive from "./algo/search/binary-search-recursive";
import binarySearchUpperBound from "./algo/search/binary-search-upper-bound";
import exponentialSearch from "./algo/search/exponential-search";
import interpolationSearch from "./algo/search/interpolation-search";
import jumpSearch from "./algo/search/jump-search";
import ternarySearch from "./algo/search/ternary-search";
import bfs from "./algo/graph/bfs";
import bidirectionalBfs from "./algo/graph/bidirectional-bfs";
import dfsIterative from "./algo/graph/dfs-iterative";
import dfsRecursive from "./algo/graph/dfs-recursive";
import floodFillBfs from "./algo/graph/flood-fill-bfs";
import floodFillDfs from "./algo/graph/flood-fill-dfs";
import gabowScc from "./algo/graph/gabow-scc";
import hierholzerEulerian from "./algo/graph/hierholzer-eulerian";
import hopcroftKarp from "./algo/flow/hopcroft-karp";
import hungarian from "./algo/flow/hungarian";
import kosarajuScc from "./algo/graph/kosaraju-scc";
import aStar from "./algo/path/a-star";
import bellmanFord from "./algo/path/bellman-ford";
import blossom from "./algo/flow/blossom";
import dijkstraFibonacci from "./algo/path/dijkstra-fibonacci";
import dijkstraHeap from "./algo/path/dijkstra-heap";
import dijkstraMatrix from "./algo/path/dijkstra-matrix";
import floydWarshall from "./algo/path/floyd-warshall";
import johnson from "./algo/path/johnson";
import karpMinimumMeanCycle from "./algo/path/karp-minimum-mean-cycle";
import shortestPathDag from "./algo/path/shortest-path-dag";
import spfa from "./algo/path/spfa";
import kruskal from "./algo/mst/kruskal";
import treeCenter from "./algo/tree/tree-center";
import treeDiameter from "./algo/tree/tree-diameter";
import treeEulerTour from "./algo/tree/tree-euler-tour";
import treeIsomorphism from "./algo/tree/tree-isomorphism";
import lcaBinaryLifting from "./algo/tree/lca-binary-lifting";
import lcaEulerSparse from "./algo/tree/lca-euler-sparse";
import lcaTarjanOffline from "./algo/tree/lca-tarjan-offline";
import centroidDecomposition from "./algo/tree/centroid-decomposition";
import heavyLightDecomposition from "./algo/tree/heavy-light-decomposition";
import rerootingDp from "./algo/tree/rerooting-dp";
import knuthMorrisPratt from "./algo/string/knuth-morris-pratt";
import zAlgorithm from "./algo/string/z-algorithm";
import rabinKarpSingle from "./algo/string/rabin-karp-single";
import rabinKarpDouble from "./algo/string/rabin-karp-double";
import manacher from "./algo/string/manacher";
import suffixArrayDoubling from "./algo/string/suffix-array-doubling";
import suffixArrayDc3 from "./algo/string/suffix-array-dc3";
import lcpKasai from "./algo/string/lcp-kasai";
import suffixAutomaton from "./algo/string/suffix-automaton";
import suffixTreeUkkonen from "./algo/string/suffix-tree-ukkonen";
import ahoCorasick from "./algo/string/aho-corasick";
import eertree from "./algo/string/eertree";
import boyerMoore from "./algo/string/boyer-moore";
import boothMinimalRotation from "./algo/string/booth-minimal-rotation";
import duvalLyndon from "./algo/string/duval-lyndon";
import longestCommonSubstring from "./algo/string/longest-common-substring";
import longestCommonPrefixDp from "./algo/string/longest-common-prefix-dp";
import zAlgorithmOnTree from "./algo/string/z-algorithm-on-tree";
import rollingHash2d from "./algo/string/rolling-hash-2d";
import prefixFunctionAuto from "./algo/string/prefix-function-auto";
import euclidGcd from "./algo/math/euclid-gcd";
import extendedEuclid from "./algo/math/extended-euclid";
import binaryExponentiation from "./algo/math/binary-exponentiation";
import matrixExponentiation from "./algo/math/matrix-exponentiation";
import sieveEratosthenes from "./algo/math/sieve-eratosthenes";
import linearSieve from "./algo/math/linear-sieve";
import millerRabin from "./algo/math/miller-rabin";
import pollardRho from "./algo/math/pollard-rho";
import fermatLittle from "./algo/math/fermat-little";
import eulerTotient from "./algo/math/euler-totient";
import modularInverse from "./algo/math/modular-inverse";
import crtCoprime from "./algo/math/crt-coprime";
import crtGeneralized from "./algo/math/crt-generalized";
import lucasTheorem from "./algo/math/lucas-theorem";
import mobiusInversion from "./algo/math/mobius-inversion";
import gaussianElimination from "./algo/math/gaussian-elimination";
import gaussianEliminationGf2 from "./algo/math/gaussian-elimination-gf2";
import bareissFractionFree from "./algo/math/bareiss-fraction-free";
import tonelliShanks from "./algo/math/tonelli-shanks";
import babyStepGiantStep from "./algo/math/baby-step-giant-step";
import discreteRoot from "./algo/math/discrete-root";
import fftCooleyTukey from "./algo/math/fft-cooley-tukey";
import ntt from "./algo/math/ntt";
import polynomialInversion from "./algo/math/polynomial-inversion";
import polynomialLogExp from "./algo/math/polynomial-log-exp";
import lis from "./algo/dp/lis";
import lcs from "./algo/dp/lcs";
import shortestCommonSupersequence from "./algo/dp/shortest-common-supersequence";
import editDistance from "./algo/dp/edit-distance";
import knapsack01 from "./algo/dp/knapsack-01";
import knapsackComplete from "./algo/dp/knapsack-complete";
import knapsackMultiple from "./algo/dp/knapsack-multiple";
import subsetSum from "./algo/dp/subset-sum";
import bitmaskTsp from "./algo/dp/bitmask-tsp";
import digitDp from "./algo/dp/digit-dp";
import intervalMatrixChain from "./algo/dp/interval-matrix-chain";
import treeDpIndependentSet from "./algo/dp/tree-dp-independent-set";
import treeDpRerooting from "./algo/dp/tree-dp-rerooting";
import dagShortestDp from "./algo/dp/dag-shortest-dp";
import dagLongestDp from "./algo/dp/dag-longest-dp";
import countingDp from "./algo/dp/counting-dp";
import probabilityDp from "./algo/dp/probability-dp";
import divideConquerDp from "./algo/dp/divide-conquer-dp";
import knuthOptimization from "./algo/dp/knuth-optimization";
import aliensTrick from "./algo/dp/aliens-trick";
import monotonicQueueDp from "./algo/dp/monotonic-queue-dp";
import nim from "./algo/game/nim";
import misereNim from "./algo/game/misere-nim";
import spragueGrundy from "./algo/game/sprague-grundy";
import minimax from "./algo/game/minimax";
import alphaBeta from "./algo/game/alpha-beta";
import wythoff from "./algo/game/wythoff";
import dotCrossProduct from "./algo/geo/dot-cross-product";
import segmentIntersection from "./algo/geo/segment-intersection";
import sweepLineSegmentIntersection from "./algo/geo/sweep-line-segment-intersection";
import pointInPolygonRay from "./algo/geo/point-in-polygon-ray";
import pointInPolygonWinding from "./algo/geo/point-in-polygon-winding";
import convexHullGraham from "./algo/geo/convex-hull-graham";
import convexHullMonotone from "./algo/geo/convex-hull-monotone";
import convexHullJarvis from "./algo/geo/convex-hull-jarvis";
import closestPairOfPoints from "./algo/geo/closest-pair-of-points";
import rotatingCalipers from "./algo/geo/rotating-calipers";
import polygonAreaShoelace from "./algo/geo/polygon-area-shoelace";
import minEnclosingCircleWelzl from "./algo/geo/min-enclosing-circle-welzl";
import halfPlaneIntersection from "./algo/geo/half-plane-intersection";
import staticArray from "./algo/ds/static-array";
import dynamicArray from "./algo/ds/dynamic-array";
import singlyLinkedList from "./algo/ds/singly-linked-list";
import doublyLinkedList from "./algo/ds/doubly-linked-list";
import circularLinkedList from "./algo/ds/circular-linked-list";
import skipList from "./algo/ds/skip-list";
import stackArray from "./algo/ds/stack-array";
import stackLinked from "./algo/ds/stack-linked";
import queueArray from "./algo/ds/queue-array";
import queueLinked from "./algo/ds/queue-linked";
import deque from "./algo/ds/deque";
import priorityQueue from "./algo/ds/priority-queue";
import monotonicQueue from "./algo/ds/monotonic-queue";
import monotonicStack from "./algo/ds/monotonic-stack";
import minStack from "./algo/ds/min-stack";
import unrolledLinkedList from "./algo/ds/unrolled-linked-list";
import xorLinkedList from "./algo/ds/xor-linked-list";
import sortedLinkedList from "./algo/ds/sorted-linked-list";
import concurrentQueue from "./algo/ds/concurrent-queue";
import cyclicBuffer from "./algo/ds/cyclic-buffer";
import binaryTree from "./algo/ds/binary-tree";
import bst from "./algo/ds/bst";
import avlTree from "./algo/ds/avl-tree";
import redBlackTree from "./algo/ds/red-black-tree";
import splayTree from "./algo/ds/splay-tree";
import treap from "./algo/ds/treap";
import bTree from "./algo/ds/b-tree";
import bPlusTree from "./algo/ds/b-plus-tree";
import trie from "./algo/ds/trie";
import ternarySearchTrie from "./algo/ds/ternary-search-trie";
import suffixTrie from "./algo/ds/suffix-trie";
import fenwickTree from "./algo/ds/fenwick-tree";
import fenwickTreeRange from "./algo/ds/fenwick-tree-range";
import segmentTreeRecursive from "./algo/ds/segment-tree-recursive";
import segmentTreeIterative from "./algo/ds/segment-tree-iterative";
import segmentTreeLazy from "./algo/ds/segment-tree-lazy";
import persistentSegmentTree from "./algo/ds/persistent-segment-tree";
import dynamicSegmentTree from "./algo/ds/dynamic-segment-tree";
import binaryHeap from "./algo/ds/binary-heap";
import fibonacciHeap from "./algo/ds/fibonacci-heap";
import pairingHeap from "./algo/ds/pairing-heap";
import leftistHeap from "./algo/ds/leftist-heap";
import skewHeap from "./algo/ds/skew-heap";
import binomialHeap from "./algo/ds/binomial-heap";
import daryHeap from "./algo/ds/dary-heap";
import adjacencyMatrix from "./algo/ds/adjacency-matrix";
import adjacencyList from "./algo/ds/adjacency-list";
import edgeList from "./algo/ds/edge-list";
import incidenceMatrix from "./algo/ds/incidence-matrix";
import csr from "./algo/ds/csr";
import hashMapChaining from "./algo/ds/hash-map-chaining";
import hashMapOpen from "./algo/ds/hash-map-open";
import linkedHashMap from "./algo/ds/linked-hash-map";
import hashSet from "./algo/ds/hash-set";
import dsu from "./algo/ds/dsu";
import persistentDsu from "./algo/ds/persistent-dsu";
import kadane from "./algo/special/kadane";
import boruvka from "./algo/mst/boruvka";
import primHeap from "./algo/mst/prim-heap";
import primMatrix from "./algo/mst/prim-matrix";
import secondBestMst from "./algo/mst/second-best-mst";
import fordFulkerson from "./algo/flow/ford-fulkerson";
import edmondsKarp from "./algo/flow/edmonds-karp";
import minCut from "./algo/flow/min-cut";
import minCostMaxFlow from "./algo/flow/min-cost-max-flow";
import boykovKolmogorov from "./algo/flow/boykov-kolmogorov";
import costScaling from "./algo/flow/cost-scaling";
import dinic from "./algo/flow/dinic";
import pushRelabel from "./algo/flow/push-relabel";
import lexicographicBfs from "./algo/graph/lexicographic-bfs";
import tarjanArticulationPoints from "./algo/graph/tarjan-articulation-points";
import tarjanBridges from "./algo/graph/tarjan-bridges";
import tarjanScc from "./algo/graph/tarjan-scc";
import topologicalSortDfs from "./algo/graph/topological-sort-dfs";
import topologicalSortKahn from "./algo/graph/topological-sort-kahn";
register(binarySearchIterative);
register(binarySearchLowerBound);
register(binarySearchRecursive);
register(binarySearchUpperBound);
register(bfs);
register(bidirectionalBfs);
register(dfsIterative);
register(dfsRecursive);
register(aStar);
register(bellmanFord);
register(blossom);
register(dijkstraFibonacci);
register(dijkstraHeap);
register(dijkstraMatrix);
register(floydWarshall);
register(johnson);
register(karpMinimumMeanCycle);
register(kruskal);
register(boruvka);
register(primHeap);
register(primMatrix);
register(secondBestMst);
register(fordFulkerson);
register(edmondsKarp);
register(minCut);
register(minCostMaxFlow);
register(boykovKolmogorov);
register(costScaling);
register(dinic);
register(pushRelabel);
register(shortestPathDag);
register(spfa);
register(treeCenter);
register(treeDiameter);
register(treeEulerTour);
register(treeIsomorphism);
register(lcaBinaryLifting);
register(lcaEulerSparse);
register(lcaTarjanOffline);
register(centroidDecomposition);
register(heavyLightDecomposition);
register(rerootingDp);
register(knuthMorrisPratt);
register(zAlgorithm);
register(rabinKarpSingle);
register(rabinKarpDouble);
register(manacher);
register(suffixArrayDoubling);
register(suffixArrayDc3);
register(lcpKasai);
register(suffixAutomaton);
register(suffixTreeUkkonen);
register(ahoCorasick);
register(eertree);
register(boyerMoore);
register(boothMinimalRotation);
register(duvalLyndon);
register(longestCommonSubstring);
register(longestCommonPrefixDp);
register(zAlgorithmOnTree);
register(rollingHash2d);
register(prefixFunctionAuto);
register(euclidGcd);
register(extendedEuclid);
register(binaryExponentiation);
register(matrixExponentiation);
register(sieveEratosthenes);
register(linearSieve);
register(millerRabin);
register(pollardRho);
register(fermatLittle);
register(eulerTotient);
register(modularInverse);
register(crtCoprime);
register(crtGeneralized);
register(lucasTheorem);
register(mobiusInversion);
register(gaussianElimination);
register(gaussianEliminationGf2);
register(bareissFractionFree);
register(tonelliShanks);
register(babyStepGiantStep);
register(discreteRoot);
register(fftCooleyTukey);
register(ntt);
register(polynomialInversion);
register(polynomialLogExp);
register(lis);
register(lcs);
register(shortestCommonSupersequence);
register(editDistance);
register(knapsack01);
register(knapsackComplete);
register(knapsackMultiple);
register(subsetSum);
register(bitmaskTsp);
register(digitDp);
register(intervalMatrixChain);
register(treeDpIndependentSet);
register(treeDpRerooting);
register(dagShortestDp);
register(dagLongestDp);
register(countingDp);
register(probabilityDp);
register(divideConquerDp);
register(knuthOptimization);
register(aliensTrick);
register(monotonicQueueDp);
register(nim);
register(misereNim);
register(spragueGrundy);
register(minimax);
register(alphaBeta);
register(wythoff);
register(dotCrossProduct);
register(segmentIntersection);
register(sweepLineSegmentIntersection);
register(pointInPolygonRay);
register(pointInPolygonWinding);
register(convexHullGraham);
register(convexHullMonotone);
register(convexHullJarvis);
register(closestPairOfPoints);
register(rotatingCalipers);
register(polygonAreaShoelace);
register(minEnclosingCircleWelzl);
register(halfPlaneIntersection);
register(staticArray);
register(dynamicArray);
register(singlyLinkedList);
register(doublyLinkedList);
register(circularLinkedList);
register(skipList);
register(stackArray);
register(stackLinked);
register(queueArray);
register(queueLinked);
register(deque);
register(priorityQueue);
register(monotonicQueue);
register(monotonicStack);
register(minStack);
register(unrolledLinkedList);
register(xorLinkedList);
register(sortedLinkedList);
register(concurrentQueue);
register(cyclicBuffer);
register(binaryTree);
register(bst);
register(avlTree);
register(redBlackTree);
register(splayTree);
register(treap);
register(bTree);
register(bPlusTree);
register(trie);
register(ternarySearchTrie);
register(suffixTrie);
register(fenwickTree);
register(fenwickTreeRange);
register(segmentTreeRecursive);
register(segmentTreeIterative);
register(segmentTreeLazy);
register(persistentSegmentTree);
register(dynamicSegmentTree);
register(binaryHeap);
register(fibonacciHeap);
register(pairingHeap);
register(leftistHeap);
register(skewHeap);
register(binomialHeap);
register(daryHeap);
register(adjacencyMatrix);
register(adjacencyList);
register(edgeList);
register(incidenceMatrix);
register(csr);
register(hashMapChaining);
register(hashMapOpen);
register(linkedHashMap);
register(hashSet);
register(dsu);
register(persistentDsu);
register(kadane);
register(exponentialSearch);
register(floodFillBfs);
register(floodFillDfs);
register(gabowScc);
register(hierholzerEulerian);
register(hopcroftKarp);
register(hungarian);
register(kosarajuScc);
register(lexicographicBfs);
register(tarjanArticulationPoints);
register(tarjanBridges);
register(tarjanScc);
register(topologicalSortDfs);
register(topologicalSortKahn);
register(interpolationSearch);
register(jumpSearch);
register(ternarySearch);
register(bubbleSort);
register(bucketSort);
register(cocktailShakerSort);
register(combSort);
register(countingSort);
register(heapSort);
register(insertionSort);
register(introsort);
register(mergeSortBottomUp);
register(mergeSortTopDown);
register(monkeySort);
register(patienceSort);
register(quickSort3Way);
register(quickSortHoare);
register(quickSortLomuto);
register(radixSortLsd);
register(radixSortMsd);
register(selectionSort);
register(shellSort);
register(smoothSort);
register(timSort);
register(linearSearch);

/** The one source of truth: id → module. */
const registry = new Map<string, AlgorithmModule>();

/**
 * Insert a module into the registry.
 *
 * @param module The algorithm module to register.
 * @throws When an algorithm with the same id is already registered, so that
 *         duplicate ids are caught at load time rather than silently shadowed.
 */
export function register(module: AlgorithmModule): void {
    if (registry.has(module.id)) {
        throw new Error(`Duplicate algorithm id: ${module.id}`);
    }
    registry.set(module.id, module);
}

/**
 * Look up an algorithm by its kebab-case id.
 *
 * @param id The algorithm identifier, e.g. `"binary-search"`.
 * @returns The matching module, or `null` when unknown.
 */
export function getAlgorithm(id: string): AlgorithmModule | null {
    return registry.get(id) ?? null;
}

/**
 * @returns Every registered algorithm module, in registration order.
 */
export function getAllAlgorithms(): AlgorithmModule[] {
    return [...registry.values()];
}
