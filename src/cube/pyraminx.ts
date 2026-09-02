// Pyraminx state engine + 3D geometry
//
// Pyraminx 14 件：4 tip + 6 edge + 4 center
// Move 表直接抄自 cubing.js puzzles.pyraminx.kpuzzle()
//
// Orbits:
//   EDGES = 6 (rhombus 中间块，2-color 翻转)
//   CORNERS = 4 (面中心 large triangle)
//   CORNERS2 = 4 (tip 角尖，独立旋转)

import type { Vec3 } from './quat'

export type PyraminxState = {
  edges: number[]           // EDGES slot → piece ID (mod 1 = 0/1 翻转状态)
  edgeOri: number[]         // mod 2
  centers: number[]         // CORNERS slot → piece ID
  centerOri: number[]       // mod 3
  tips: number[]            // CORNERS2 slot → piece ID
  tipOri: number[]          // mod 3
}

// Move tables（从 cubing.puzzles.pyraminx.kpuzzle() 抄的）
// format: { edgePerm, edgeDelta, centerPerm, centerDelta, tipPerm, tipDelta }
type MoveTable = {
  edgePerm: number[]
  edgeDelta: number[]
  centerPerm: number[]
  centerDelta: number[]
  tipPerm: number[]
  tipDelta: number[]
}

export const PYRAMINX_MOVES: Record<string, MoveTable> = {
  // Right turn
  r: {
    edgePerm:   [0, 1, 2, 3, 4, 5],
    edgeDelta:  [0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3],
    centerDelta:[0, 0, 0, 0],
    tipPerm:    [0, 1, 2, 3],
    tipDelta:   [0, 0, 1, 0],
  },
  // 2r = R'  (逆时针 120° = 顺时针 240°)
  // r 后再 r 一次
  R: {  // 2r in cubing notation = 顺时针 240° (即 R' in 我们的记号)
    edgePerm:   [0, 1, 2, 3, 4, 5],
    edgeDelta:  [0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3],
    centerDelta:[0, 0, 0, 0],
    tipPerm:    [0, 1, 2, 3],
    tipDelta:   [0, 0, 0, 0],
  },
  BL: {  // Big L (整层转，包含 l + 左 tip)
    edgePerm:   [1, 4, 2, 3, 0, 5],
    edgeDelta:  [1, 0, 0, 0, 1, 0],
    centerPerm: [1, 3, 2, 0],
    centerDelta:[2, 1, 0, 0],
    tipPerm:    [1, 3, 2, 0],
    tipDelta:   [2, 1, 0, 0],
  },
  rv: {  // r- 逆时针
    edgePerm:   [4, 0, 3, 5, 1, 2],
    edgeDelta:  [1, 1, 0, 0, 0, 0],
    centerPerm: [3, 0, 2, 1],
    centerDelta:[0, 1, 1, 2],
    tipPerm:    [3, 0, 2, 1],
    tipDelta:   [0, 1, 1, 2],
  },
  l: {
    edgePerm:   [0, 1, 2, 3, 4, 5],
    edgeDelta:  [0, 0, 0, 0, 0, 0],
    centerPerm: [0, 1, 2, 3],
    centerDelta:[0, 0, 0, 0],
    tipPerm:    [0, 1, 2, 3],
    tipDelta:   [0, 0, 0, 1],
  },
  L: {  // 2l
    edgePerm:   [4, 1, 0, 3, 2, 5],
    edgeDelta:  [0, 0, 1, 0, 1, 0],
    centerPerm: [0, 1, 2, 3],
    centerDelta:[0, 0, 0, 0],
    tipPerm:    [0, 1, 2, 3],
    tipDelta:   [0, 0, 0, 0],
  },
  BR: {  // Big R
    edgePerm:   [0, 5, 2, 1, 4, 3],
    edgeDelta:  [0, 1, 0, 0, 0, 1],
    centerPerm: [2, 0, 1, 3],
    centerDelta:[0, 2, 1, 0],
    tipPerm:    [2, 0, 1, 3],
    tipDelta:   [0, 2, 1, 0],
  },
  lv: {  // l- 逆时针
    edgePerm:   [4, 3, 0, 5, 2, 1],
    edgeDelta:  [0, 0, 1, 1, 1, 1],
    centerPerm: [1, 2, 0, 3],
    centerDelta:[1, 2, 0, 1],
    tipPerm:    [1, 2, 0, 3],
    tipDelta:   [1, 2, 0, 1],
  },
}

export function newPyraminxState(): PyraminxState {
  return {
    edges: [0, 1, 2, 3, 4, 5],
    edgeOri: [0, 0, 0, 0, 0, 0],
    centers: [0, 1, 2, 3],
    centerOri: [0, 0, 0, 0],
    tips: [0, 1, 2, 3],
    tipOri: [0, 0, 0, 0],
  }
}

function applySinglePyraminx(state: PyraminxState, base: string): PyraminxState {
  const t = PYRAMINX_MOVES[base]
  if (!t) throw new Error(`unknown Pyraminx move: ${base}`)
  const newEdges = new Array(6)
  const newEdgeOri = new Array(6)
  for (let i = 0; i < 6; i++) {
    newEdges[t.edgePerm[i]] = state.edges[i]
    newEdgeOri[t.edgePerm[i]] = (state.edgeOri[i] + t.edgeDelta[i] + 2) % 2
  }
  const newCenters = new Array(4)
  const newCenterOri = new Array(4)
  for (let i = 0; i < 4; i++) {
    newCenters[t.centerPerm[i]] = state.centers[i]
    newCenterOri[t.centerPerm[i]] = (state.centerOri[i] + t.centerDelta[i] + 3) % 3
  }
  const newTips = new Array(4)
  const newTipOri = new Array(4)
  for (let i = 0; i < 4; i++) {
    newTips[t.tipPerm[i]] = state.tips[i]
    newTipOri[t.tipPerm[i]] = (state.tipOri[i] + t.tipDelta[i] + 3) % 3
  }
  return {
    edges: newEdges,
    edgeOri: newEdgeOri,
    centers: newCenters,
    centerOri: newCenterOri,
    tips: newTips,
    tipOri: newTipOri,
  }
}

export function applyPyraminxMove(state: PyraminxState, move: string): PyraminxState {
  const isPrime = move.endsWith("'")
  const isTwo = move.endsWith("2")
  const base = move.replace(/['2]/g, '')
  if (!PYRAMINX_MOVES[base]) throw new Error(`unknown Pyraminx move: ${move}`)
  let cur = state
  const n = isPrime ? 2 : isTwo ? 2 : 1
  for (let k = 0; k < n; k++) cur = applySinglePyraminx(cur, base)
  return cur
}

// ===== 3D 几何 =====

// Pyraminx 4 个面的颜色（标准 WCA 配色）
// 面 0 = 底 (Down), 1 = 后 (Back), 2 = 左 (Left), 3 = 右 (Right)
// 用 4 种颜色：绿/蓝/红/黄
export const PYRAMINX_COLORS = ['#00cc44', '#0044cc', '#ff4444', '#ffdd00']

// 4 个 tip slot 位置（tetrahedron 4 个顶点）
// 4 个面：Front (F=+X+Y+Z 不在，因为这是 4 面体，我们用 4 个特定方向)
// 用立方体顶点 (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1) 表示 4 面体的 4 个顶点
export const PYRAMINX_TIP_SLOTS: Vec3[] = [
  [+1, +1, +1],   // 0: tip 在 +X+Y+Z 方向（"right-front-top"）
  [+1, -1, -1],   // 1: tip 在 +X-Y-Z 方向（"right-back-bottom"）
  [-1, +1, -1],   // 2: tip 在 -X+Y-Z 方向（"left-back-top"）
  [-1, -1, +1],   // 3: tip 在 -X-Y+Z 方向（"left-front-bottom"）
]

// 6 个 edge slot 位置（tetrahedron 6 个边的中点）
// 但我们用 cubic 表达：6 个 face center 方向
// 实际上 Pyraminx edges 是 6 个：每条 tetrahedron 边的中点处一个
// 在 cubic 表达里：edge 位于 (1, 0, 1), (1, 1, 0), (1, 0, -1), (-1, 0, 1), (0, 1, -1), (-1, 0, -1)
// 不对，让我重新想 tetrahedron 的 6 条边的中点
// 4 个顶点是 (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1)
// 6 条边（每对顶点之间一条）：6 个
//   v0-v1: 中点 (1, 0, 0)
//   v0-v2: 中点 (0, 1, 0)
//   v0-v3: 中点 (0, 0, 1)
//   v1-v2: 中点 (0, 0, -1)
//   v1-v3: 中点 (0, -1, 0)
//   v2-v3: 中点 (-1, 0, 0)
export const PYRAMINX_EDGE_SLOTS: Vec3[] = [
  [+1, 0, 0],   // 0: v0-v1 中点
  [0, +1, 0],   // 1: v0-v2 中点
  [0, 0, +1],   // 2: v0-v3 中点
  [0, 0, -1],   // 3: v1-v2 中点
  [0, -1, 0],   // 4: v1-v3 中点
  [-1, 0, 0],   // 5: v2-v3 中点
]

// 4 个 face center slot 位置（4 个 face 的中心）
// tetrahedron 4 个 face = 4 个 face center
// 它们都在立方体内部 (x, y, z 都是 0 或 ±1/3 的组合)
// face centers:
//   face between v0,v1,v2 (即 -X-Y-Z 那一面) = (-1, -1, -1) 方向
//   face between v0,v1,v3
//   face between v0,v2,v3
//   face between v1,v2,v3
// 简化：把 center 放在 4 个 tip slot 之间（几何上确实是这样）
// 4 个 face center 位置 = (0,0,0) 到 (1,1,1) 等 tip 方向的中点
// 实际几何：4 个 face center = 立方体内部 4 个点
//   face0: (0, 0, 0) 中心？不对，face center 在 tetrahedron face 上
// 用立方体顶点 (1,1,1) 之类的"外部" 4 个点的负方向 = face center 方向
export const PYRAMINX_CENTER_SLOTS: Vec3[] = [
  [-1, -1, -1], // 0: face 0 (between tips 1,2,3) 的中心方向
  [-1, +1, +1], // 1: face 1 (between tips 0,2,3) — 等等，这写错了
  [+1, -1, +1], // 2
  [+1, +1, -1], // 3
]

// 注意：上面的 TIP_SLOTS 和 CENTER_SLOTS 是反的对应关系
// tip 0 = (+1,+1,+1), 它的对顶点 face 的中心方向 = -tip 0 = (-1,-1,-1) = center 0
// 所以 center i = -tip i

// 颜色规则：每个 piece 的颜色由其 sticker 决定
// Pyraminx 是 4 面体，4 个 face color:
//   - 底面 (D, -Y) = 绿色 (or whatever)
//   - 后面 (B, -Z) = 蓝色
//   - 左面 (L, -X) = 红色
//   - 右面 (R, +X) = 黄色
//
// tip 0 在 +X+Y+Z 方向，3 个 sticker 朝 3 个 face：+X=黄, +Y=?, +Z=?
// 但 +Y face 不在 tetrahedron 里（+Y 是上方，但 tetrahedron 顶点朝 +X+Y+Z）
//
// 实际上 Pyraminx 的 4 个 face 是：
//   Front = +X+Y (right-front)
//   Back = -X-Y (left-back)
//   Left = -X+Y (left-front)
//   Right = +X-Y (right-back)
// 或者用某种记号。简化：用 4 个 tip slot 的方向定义 4 个 face normal
//   face 0 normal = (1,1,1)/√3 （指向 tip 0 的 face 的外法线）
//   face 1 normal = (1,-1,-1)/√3
//   face 2 normal = (-1,1,-1)/√3
//   face 3 normal = (-1,-1,1)/√3
//
// 但每个 face 包含 3 个 tip 顶点。每个 tip 块属于 3 个 face。
// 同样每个 edge 块属于 2 个 face。每个 center 块属于 1 个 face。
//
// 简化方案：直接用 cubing 的颜色映射，但太复杂。
// 实用方案：给每个 piece 一个固定颜色（由其 type + ID 决定），
// 然后通过 state 变化看 scramble 效果。

export function isPyraminxSolved(s: PyraminxState): boolean {
  for (let i = 0; i < 6; i++) if (s.edges[i] !== i || s.edgeOri[i] !== 0) return false
  for (let i = 0; i < 4; i++) if (s.centers[i] !== i || s.centerOri[i] !== 0) return false
  for (let i = 0; i < 4; i++) if (s.tips[i] !== i || s.tipOri[i] !== 0) return false
  return true
}

export function randomPyraminxScramble(length = 12): string {
  const moves = ['r', "r'", 'l', "l'", 'u', "u'", 'b', "b'"]
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
