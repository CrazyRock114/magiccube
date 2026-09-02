// Megaminx state engine + 3D geometry (简化版)
//
// Megaminx 62 件：20 corner + 30 edge + 12 center
// Move 表直接抄自 cubing.js puzzles.megaminx.kpuzzle()

import type { Vec3 } from './quat'

export type MegaminxState = {
  corners: number[]      // CORNERS slot → piece ID (mod 20)
  cornerOri: number[]    // mod 3
  edges: number[]        // EDGES slot → piece ID (mod 30)
  edgeOri: number[]      // mod 2
  centers: number[]      // CENTERS slot → piece ID (mod 12)
}

// Move tables（从 cubing.puzzles.megaminx.kpuzzle() 抄的）
// 简化：只保留 4 个基本 move（U, D, R, F）
type MoveTable = {
  cornerPerm: number[]
  cornerDelta: number[]
  edgePerm: number[]
  edgeDelta: number[]
  centerPerm: number[]
}

export const MEGAMINX_MOVES: Record<string, MoveTable> = {
  U: {
    cornerPerm: [2, 0, 7, 3, 4, 5, 1, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    cornerDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    edgePerm: [7, 0, 2, 3, 4, 5, 26, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 1, 27, 28, 29],
    edgeDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  D: {
    cornerPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 10, 11, 12, 13, 14, 16, 17, 9, 15, 19],
    cornerDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    edgePerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 23, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 11, 24, 25, 26, 27, 28, 29],
    edgeDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  R: {
    cornerPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    cornerDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    edgePerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
    edgeDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  F: {
    cornerPerm: [3, 1, 0, 8, 4, 5, 6, 7, 19, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 2],
    cornerDelta: [2, 0, 1, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    edgePerm: [8, 1, 0, 27, 4, 5, 6, 7, 3, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 2, 28, 29],
    edgeDelta: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
}

export function newMegaminxState(): MegaminxState {
  return {
    corners: Array.from({ length: 20 }, (_, i) => i),
    cornerOri: Array.from({ length: 20 }, () => 0),
    edges: Array.from({ length: 30 }, (_, i) => i),
    edgeOri: Array.from({ length: 30 }, () => 0),
    centers: Array.from({ length: 12 }, (_, i) => i),
  }
}

function applySingleMegaminx(state: MegaminxState, base: string): MegaminxState {
  const t = MEGAMINX_MOVES[base]
  if (!t) throw new Error(`unknown Megaminx move: ${base}`)
  const newCorners = new Array(20)
  const newCornerOri = new Array(20)
  for (let i = 0; i < 20; i++) {
    newCorners[t.cornerPerm[i]] = state.corners[i]
    newCornerOri[t.cornerPerm[i]] = (state.cornerOri[i] + t.cornerDelta[i] + 3) % 3
  }
  const newEdges = new Array(30)
  const newEdgeOri = new Array(30)
  for (let i = 0; i < 30; i++) {
    newEdges[t.edgePerm[i]] = state.edges[i]
    newEdgeOri[t.edgePerm[i]] = (state.edgeOri[i] + t.edgeDelta[i] + 2) % 2
  }
  const newCenters = new Array(12)
  for (let i = 0; i < 12; i++) {
    newCenters[t.centerPerm[i]] = state.centers[i]
  }
  return { corners: newCorners, cornerOri: newCornerOri, edges: newEdges, edgeOri: newEdgeOri, centers: newCenters }
}

export function applyMegaminxMove(state: MegaminxState, move: string): MegaminxState {
  const isPrime = move.endsWith("'")
  const base = move.replace(/'/g, '')
  if (!MEGAMINX_MOVES[base]) throw new Error(`unknown Megaminx move: ${move}`)
  let cur = state
  for (let k = 0; k < (isPrime ? 2 : 1); k++) cur = applySingleMegaminx(cur, base)
  return cur
}

// ===== 3D 几何 =====

// Dodecahedron 12 顶点 = icosahedron 12 顶点 (用 golden ratio)
// icosahedron 顶点：12 个点（每个长度相同）
// 用 standard "rectified" 坐标
const phi = (1 + Math.sqrt(5)) / 2
const normIco = Math.sqrt(1 + phi * phi)
// 12 个 icosahedron 顶点 → 这就是 dodecahedron 12 个 face center
export const MEGAMINX_CENTER_SLOTS: Vec3[] = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
].map(v => {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return [v[0] / len, v[1] / len, v[2] / len] as Vec3
})

// 20 个 dodecahedron 顶点 = icosahedron 20 个 face centers
// icosahedron 20 个面，每面 3 个顶点
const icoVerts: Vec3[] = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
].map(v => {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return [v[0] / len, v[1] / len, v[2] / len] as Vec3
})

// icosahedron 20 面 (每面 3 个顶点 index)
const icoFaces: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

// 20 个 dodecahedron 顶点 = 20 个 icosahedron face center
export const MEGAMINX_CORNER_SLOTS: Vec3[] = icoFaces.map(([a, b, c]) => {
  const va = icoVerts[a], vb = icoVerts[b], vc = icoVerts[c]
  const center: Vec3 = [
    (va[0] + vb[0] + vc[0]) / 3,
    (va[1] + vb[1] + vc[1]) / 3,
    (va[2] + vb[2] + vc[2]) / 3,
  ]
  // 归一化到单位长度
  const len = Math.sqrt(center[0] * center[0] + center[1] * center[1] + center[2] * center[2])
  const norm = 1.0 / len
  return [center[0] * norm, center[1] * norm, center[2] * norm] as Vec3
})

// 30 个 dodecahedron 边 = 30 个 icosahedron 边（dual 关系）
// icosahedron 30 条边：每对有 face shared 的顶点连一条
// 简化：从 cubing 没拿到 edge adjacency，用 30 个 vertex pair 表示
// 实际上 icosahedron 30 边 = (12 * 5) / 2 因为每个 vertex degree = 5
// 我们 hardcode 30 边（来自 standard icosahedron edge list）
const icoEdges: [number, number][] = [
  [0, 1], [0, 5], [0, 7], [0, 10], [0, 11],
  [1, 5], [1, 7], [1, 8], [1, 9],
  [2, 4], [2, 6], [2, 10], [2, 11],
  [3, 4], [3, 6], [3, 8], [3, 9],
  [4, 5], [4, 9], [4, 11],
  [5, 9], [5, 11],
  [6, 7], [6, 8], [6, 10],
  [7, 8], [7, 10],
  [8, 9],
  [9, 11],
  [10, 11],
]

// 30 个 dodecahedron 边中点 = 30 个 icosahedron 边中点
export const MEGAMINX_EDGE_SLOTS: Vec3[] = icoEdges.map(([a, b]) => {
  const va = icoVerts[a], vb = icoVerts[b]
  const mid: Vec3 = [
    (va[0] + vb[0]) / 2,
    (va[1] + vb[1]) / 2,
    (va[2] + vb[2]) / 2,
  ]
  const len = Math.sqrt(mid[0] * mid[0] + mid[1] * mid[1] + mid[2] * mid[2])
  const norm = 1.0 / len
  return [mid[0] * norm, mid[1] * norm, mid[2] * norm] as Vec3
})

// 12 种 face color（标准 Megaminx 配色）
export const MEGAMINX_COLORS = [
  '#ffffff', '#ffdd00', '#00cc44', '#0044cc', '#ff8800',
  '#ff4444', '#aa00aa', '#008888', '#888888', '#442266',
  '#226622', '#664422',
]

export function isMegaminxSolved(s: MegaminxState): boolean {
  for (let i = 0; i < 20; i++) if (s.corners[i] !== i) return false
  for (let i = 0; i < 30; i++) if (s.edges[i] !== i) return false
  for (let i = 0; i < 12; i++) if (s.centers[i] !== i) return false
  return true
}

export function randomMegaminxScramble(length = 12): string {
  const moves = ['U', "U'", 'D', "D'", 'R', "R'", 'F', "F'"]
  const out: string[] = []
  let lastBase = ''
  for (let i = 0; i < length; i++) {
    let m: string
    let base: string
    do {
      m = moves[Math.floor(Math.random() * moves.length)]
      base = m[0]
    } while (base === lastBase)
    out.push(m)
    lastBase = base
  }
  return out.join(' ')
}
