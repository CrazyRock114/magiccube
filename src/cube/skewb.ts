// Skewb state engine + 3D geometry
//
// Skewb 几何：8 个角块，分布在 (sx, sy, sz) where sx,sy,sz ∈ {-1, +1}
// 每个角块有 3 个 sticker（朝 +X/-X/+Y/-Y/+Z/-Z 的面）
// 4 个 move：R / L / U / D
//
// Move 表直接抄自 cubing.js puzzles.skewb.kpuzzle() 的 moveToTransformation 输出。
// 见历史 commit，调试用 probe.mjs 已删。
//
// cubing 的 move.transformationData 格式：
//   permutation[i] = slot i 里的 piece 去到的目标 slot
//   orientationDelta[i] = 在新 slot 里 piece 自旋的角度增量
//     Skewb 角块是 mod 3（每 120° 一步），中心 mod 5（每 72° 一步）

import type { Vec3 } from './quat'

export type SkewbState = {
  // corners[i] = 现在在 slot i 的角块 ID（初始 = i）
  corners: number[]
  // cornerOri[i] = 在 slot i 的角块朝向 mod 3
  cornerOri: number[]
  // centers 同理
  centers: number[]
  centerOri: number[]
}

// 8 个 slot 的位置（cube 顶点）
export const SKEWB_SLOTS: Vec3[] = [
  [-1, -1, -1], // 0
  [-1, -1, +1], // 1
  [-1, +1, -1], // 2
  [-1, +1, +1], // 3
  [+1, -1, -1], // 4
  [+1, -1, +1], // 5
  [+1, +1, -1], // 6
  [+1, +1, +1], // 7
]

// 颜色：标准 WCA 配色
// +X=红, -X=橙, +Y=白, -Y=黄, +Z=绿, -Z=蓝
export const SKEWB_COLORS = ['#ff4444', '#ff8800', '#ffffff', '#ffdd00', '#00cc44', '#0044cc']

// slot i 角块的 3 个 sticker 的世界方向 + 颜色
export function skewbStickerNormals(slotIdx: number): Vec3[] {
  const [sx, sy, sz] = SKEWB_SLOTS[slotIdx]
  return [
    [sx, 0, 0],
    [0, sy, 0],
    [0, 0, sz],
  ]
}

export function skewbStickerColors(slotIdx: number): string[] {
  const [sx, sy, sz] = SKEWB_SLOTS[slotIdx]
  return [
    SKEWB_COLORS[sx > 0 ? 0 : 1],
    SKEWB_COLORS[sy > 0 ? 2 : 3],
    SKEWB_COLORS[sz > 0 ? 4 : 5],
  ]
}

// cubing 的 move tables（直接抄的 kpuzzle 输出）
type MoveTable = { cornerPerm: number[]; cornerDelta: number[]; centerPerm: number[]; centerDelta: number[] }

export const SKEWB_MOVES: Record<string, MoveTable> = {
  R: {
    cornerPerm: [0, 2, 7, 3, 4, 5, 6, 1],
    cornerDelta: [0, 2, 2, 0, 0, 1, 0, 2],
    centerPerm: [0, 2, 5, 3, 4, 1],
    centerDelta: [0, 0, 3, 0, 0, 1],
  },
  L: {
    cornerPerm: [7, 1, 0, 3, 4, 5, 6, 2],
    cornerDelta: [2, 0, 2, 0, 1, 0, 0, 2],
    centerPerm: [4, 1, 0, 3, 2, 5],
    centerDelta: [1, 0, 1, 0, 2, 0],
  },
  U: {
    cornerPerm: [1, 7, 2, 3, 4, 5, 6, 0],
    cornerDelta: [2, 2, 0, 0, 0, 0, 1, 2],
    centerPerm: [0, 1, 2, 5, 3, 4],
    centerDelta: [0, 0, 0, 3, 0, 1],
  },
  D: {
    cornerPerm: [0, 1, 2, 4, 5, 3, 6, 7],
    cornerDelta: [0, 0, 1, 2, 2, 2, 0, 0],
    centerPerm: [2, 0, 1, 3, 4, 5],
    centerDelta: [1, 1, 2, 0, 0, 0],
  },
}

export function newSkewbState(): SkewbState {
  return {
    corners: [0, 1, 2, 3, 4, 5, 6, 7],
    cornerOri: [0, 0, 0, 0, 0, 0, 0, 0],
    centers: [0, 1, 2, 3, 4, 5],
    centerOri: [0, 0, 0, 0, 0, 0],
  }
}

function applySingleSkewb(state: SkewbState, base: string): SkewbState {
  const t = SKEWB_MOVES[base]
  if (!t) throw new Error(`unknown Skewb move: ${base}`)
  const newCorners = new Array(8)
  const newCornerOri = new Array(8)
  for (let i = 0; i < 8; i++) {
    newCorners[t.cornerPerm[i]] = state.corners[i]
    newCornerOri[t.cornerPerm[i]] = (state.cornerOri[i] + t.cornerDelta[i] + 3) % 3
  }
  const newCenters = new Array(6)
  const newCenterOri = new Array(6)
  for (let i = 0; i < 6; i++) {
    newCenters[t.centerPerm[i]] = state.centers[i]
    newCenterOri[t.centerPerm[i]] = (state.centerOri[i] + t.centerDelta[i] + 5) % 5
  }
  return { corners: newCorners, cornerOri: newCornerOri, centers: newCenters, centerOri: newCenterOri }
}

export function applySkewbMove(state: SkewbState, move: string): SkewbState {
  const isPrime = move.endsWith("'")
  const base = isPrime ? move.slice(0, -1) : move
  if (!SKEWB_MOVES[base]) throw new Error(`unknown Skewb move: ${move}`)
  let cur = state
  for (let n = 0; n < (isPrime ? 2 : 1); n++) {
    cur = applySingleSkewb(cur, base)
  }
  return cur
}

// 哪些 slot 参与这个 move 的 3-cycle（cornerDelta 非 0 且 cornerPerm 不指向自己）
// 简化为：所有 cornerDelta 非 0 的 slot
export function skewbActiveSlots(move: string): { cornerSlots: number[]; centerSlots: number[] } {
  const isPrime = move.endsWith("'")
  const base = isPrime ? move.slice(0, -1) : move
  const t = SKEWB_MOVES[base]
  if (!t) return { cornerSlots: [], centerSlots: [] }
  return {
    cornerSlots: t.cornerDelta.map((d, i) => (d !== 0 ? i : -1)).filter(i => i >= 0),
    centerSlots: t.centerDelta.map((d, i) => (d !== 0 ? i : -1)).filter(i => i >= 0),
  }
}

// 3-cycle corner slots：从 active slots 里找那些 perm 不指向自己的（即真的在 cycle 里）
export function skewbCycleCornerSlots(move: string): number[] {
  const isPrime = move.endsWith("'")
  const base = isPrime ? move.slice(0, -1) : move
  const t = SKEWB_MOVES[base]
  if (!t) return []
  return t.cornerDelta
    .map((d, i) => (d !== 0 && t.cornerPerm[i] !== i ? i : -1))
    .filter(i => i >= 0)
}

// 3 cycling corner 的重心作为 group rotation 的 pivot
// rotation axis = 垂直于三个点所在平面（且通过 cube center）
export function skewbRotationAxisAndPivot(move: string): { axis: Vec3; pivot: Vec3 } {
  const slots = skewbCycleCornerSlots(move)
  if (slots.length !== 3) return { axis: [0, 1, 0], pivot: [0, 0, 0] }
  const a = SKEWB_SLOTS[slots[0]]
  const b = SKEWB_SLOTS[slots[1]]
  const c = SKEWB_SLOTS[slots[2]]
  // 两个 edge vector
  const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const e2: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  // cross product = plane normal
  const nx = e1[1] * e2[2] - e1[2] * e2[1]
  const ny = e1[2] * e2[0] - e1[0] * e2[2]
  const nz = e1[0] * e2[1] - e1[1] * e2[0]
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
  // pivot = 三点重心
  const pivot: Vec3 = [
    (a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3,
    (a[2] + b[2] + c[2]) / 3,
  ]
  return { axis: [nx / len, ny / len, nz / len], pivot }
}

// 判断是否 solved
export function isSkewbSolved(s: SkewbState): boolean {
  for (let i = 0; i < 8; i++) {
    if (s.corners[i] !== i) return false
    if (s.cornerOri[i] !== 0) return false
  }
  return true
}

// 随机 scramble
export function randomSkewbScramble(length = 12): string {
  const moves = ['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'"]
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
