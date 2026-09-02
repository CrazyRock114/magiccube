// LBL 7 步状态检测函数
//
// 每步独立判断当前 state 是否已达成该步目标。用于 Solve 页 InteractiveStepCard：
// 用户自己操作小魔方，每次 state 变 → 调 checker → 达成 → 解锁下一步。
//
// 坐标系约定：solved state 下，U 面朝 +Y 方向（白），D 面朝 -Y（黄）。
// "白十字"在 LBL 教学里是把 4 个含白面的棱块放到 D 层（白朝下）—— 所以检测是 D 面 4 edge = D 色。
// "黄十字"是 2-look OLL 之前的状态，U 面 4 edge = U 色。

import { rotateVec } from './quat'
import type { Vec3 } from './quat'
import { isSolved } from './state'
import type { CubeState, Face } from './state'

const FACE_NORMAL: Record<Face, Vec3> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

export interface FaceSticker {
  pos: Vec3
  color: Face
}

/** 找到所有 sticker 法线朝某个 face 方向的 sticker（已经转到世界坐标） */
export function stickersFacing(state: CubeState, face: Face): FaceSticker[] {
  const target = FACE_NORMAL[face]
  const out: FaceSticker[] = []
  for (const cu of state.cubies) {
    for (const s of cu.stickers) {
      const wn = rotateVec(cu.ori, s.normal)
      if (
        Math.abs(wn[0] - target[0]) < 0.5 &&
        Math.abs(wn[1] - target[1]) < 0.5 &&
        Math.abs(wn[2] - target[2]) < 0.5
      ) {
        out.push({ pos: cu.pos, color: s.color })
      }
    }
  }
  return out
}

/** Step 1: 底层十字 — D 面 4 个 edge sticker 都是 D 色（白朝下） */
export function checkWhiteCross(state: CubeState): boolean {
  const ds = stickersFacing(state, 'D')
  if (ds.length !== 9) return false
  // 4 个 edge: pos.y = -1, |x|+|z| = 1
  const edges = ds.filter(
    (s) =>
      Math.abs(s.pos[1] + 1) < 0.5 &&
      Math.abs(Math.abs(s.pos[0]) + Math.abs(s.pos[2]) - 1) < 0.5,
  )
  if (edges.length !== 4) return false
  return edges.every((e) => e.color === 'D')
}

/** Step 2: 底层角块 — D 面 9 个 sticker 都是 D 色 */
export function checkFirstLayer(state: CubeState): boolean {
  const ds = stickersFacing(state, 'D')
  if (ds.length !== 9) return false
  return ds.every((s) => s.color === 'D')
}

/** Step 3: 中层棱块 — 4 个中层 edge cubie 在中层 (pos.y=0)，且 sticker 颜色匹配朝向 */
export function checkSecondLayer(state: CubeState): boolean {
  // 中层 edge cubie: pos.y = 0, |x|=1 AND |z|=1（FR/FL/BR/BL 4 个角位置在中层）
  const middleEdges = state.cubies.filter((cu) => {
    const [x, y, z] = cu.pos
    return (
      Math.abs(y) < 0.5 &&
      Math.abs(Math.abs(x) - 1) < 0.5 &&
      Math.abs(Math.abs(z) - 1) < 0.5
    )
  })
  if (middleEdges.length !== 4) return false
  for (const cu of middleEdges) {
    if (cu.stickers.length !== 2) return false
    for (const s of cu.stickers) {
      const wn = rotateVec(cu.ori, s.normal)
      if (Math.abs(wn[0]) > 0.5) {
        const expected: Face = wn[0] > 0 ? 'R' : 'L'
        if (s.color !== expected) return false
      } else if (Math.abs(wn[2]) > 0.5) {
        const expected: Face = wn[2] > 0 ? 'F' : 'B'
        if (s.color !== expected) return false
      }
    }
  }
  return true
}

/** Step 4: 顶面十字 — U 面 4 个 edge sticker 都是 U 色（黄朝上） */
export function checkTopCross(state: CubeState): boolean {
  const us = stickersFacing(state, 'U')
  if (us.length !== 9) return false
  const edges = us.filter(
    (s) =>
      Math.abs(s.pos[1] - 1) < 0.5 &&
      Math.abs(Math.abs(s.pos[0]) + Math.abs(s.pos[2]) - 1) < 0.5,
  )
  if (edges.length !== 4) return false
  return edges.every((e) => e.color === 'U')
}

/** Step 5: 顶面定向 — U 面 9 个 sticker 都是 U 色 */
export function checkTopFace(state: CubeState): boolean {
  const us = stickersFacing(state, 'U')
  if (us.length !== 9) return false
  return us.every((s) => s.color === 'U')
}

/** Step 6: 顶层角定位 — 4 个顶层角块的 3 个 sticker 颜色匹配相邻 3 面（位置 + 朝向都对） */
export function checkCornersPermuted(state: CubeState): boolean {
  // 4 个顶层 corner cubie: pos.y = 1, |x|=1, |z|=1
  const topCorners = state.cubies.filter((cu) => {
    const [x, y, z] = cu.pos
    return (
      Math.abs(y - 1) < 0.5 &&
      Math.abs(Math.abs(x) - 1) < 0.5 &&
      Math.abs(Math.abs(z) - 1) < 0.5
    )
  })
  if (topCorners.length !== 4) return false
  for (const cu of topCorners) {
    if (cu.stickers.length !== 3) return false
    for (const s of cu.stickers) {
      const wn = rotateVec(cu.ori, s.normal)
      if (Math.abs(wn[1] - 1) < 0.5) {
        if (s.color !== 'U') return false
      } else if (Math.abs(wn[0]) > 0.5) {
        const expected: Face = wn[0] > 0 ? 'R' : 'L'
        if (s.color !== expected) return false
      } else if (Math.abs(wn[2]) > 0.5) {
        const expected: Face = wn[2] > 0 ? 'F' : 'B'
        if (s.color !== expected) return false
      }
    }
  }
  return true
}

/** Step 7: 顶层棱定位 + 整魔方还原 — 等价于 solved */
export const checkSolved = isSolved

// 全部检测函数列表，按 Step 顺序
export const LBL_STEPS = [
  { key: 'whiteCross', name: '底层十字', checker: checkWhiteCross, hint: 'D 面 4 个 edge sticker 都是白' },
  { key: 'firstLayer', name: '底层角块', checker: checkFirstLayer, hint: 'D 面 9 个 sticker 全白' },
  { key: 'secondLayer', name: '中层棱块', checker: checkSecondLayer, hint: '4 个中层 edge 在中层且颜色匹配' },
  { key: 'topCross', name: '顶面十字', checker: checkTopCross, hint: 'U 面 4 个 edge 都是黄' },
  { key: 'topFace', name: '顶面定向', checker: checkTopFace, hint: 'U 面 9 个 sticker 全黄' },
  { key: 'cornersPermuted', name: '顶层角定位', checker: checkCornersPermuted, hint: '4 个顶层角位置+朝向都对' },
  { key: 'solved', name: '顶层棱定位', checker: checkSolved, hint: '整魔方还原' },
] as const
