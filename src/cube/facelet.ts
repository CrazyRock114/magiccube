// 6 面颜色输入工具：手动输入 + 摄像头输入共用
//
// 输入：6 面 × 9 sticker 的颜色 ('U' | 'R' | 'F' | 'D' | 'L' | 'B')
// 输出：CubeState + facelet string (54 chars, U R F D L B 顺序)
//
// 颜色约定：U=white, D=yellow, F=green, B=blue, L=orange, R=red

import { newCube, type CubeState, type Face, applyMoveInPlace, cloneCube, parseMoveToken, getStickerString, FACE_ORDER } from './state'

export type { Face }

export type FaceColors = [Face, Face, Face, Face, Face, Face, Face, Face, Face]  // 3x3 row-major

export interface SixFaceInput {
  U: FaceColors  // top
  R: FaceColors  // right
  F: FaceColors  // front
  D: FaceColors  // bottom
  L: FaceColors  // left
  B: FaceColors  // back
}

export const FACE_COLORS: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

export const COLOR_HEX_DISPLAY: Record<Face, string> = {
  U: '#f5f5f5',  // white
  R: '#b71234',  // red
  F: '#009b48',  // green
  D: '#ffd500',  // yellow
  L: '#ff5900',  // orange
  B: '#0046ad',  // blue
}

export const COLOR_NAMES: Record<Face, string> = {
  U: '白', R: '红', F: '绿', D: '黄', L: '橙', B: '蓝',
}

/** 验证 6 面输入：每种颜色必须出现 9 次 */
export function validateInput(input: SixFaceInput): { ok: boolean; error?: string } {
  const counts: Record<Face, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 }
  for (const f of FACE_COLORS) {
    for (const c of input[f]) {
      counts[c]++
    }
  }
  for (const f of FACE_COLORS) {
    if (counts[f] !== 9) {
      return { ok: false, error: `颜色 ${COLOR_NAMES[f]} 出现 ${counts[f]} 次（应该是 9 次）` }
    }
  }
  return { ok: true }
}

/** 6 面 → 54 字符 facelet string (U R F D L B 顺序) */
export function inputToFacelet(input: SixFaceInput): string {
  return FACE_COLORS.map(f => input[f].join('')).join('')
}

/** CubeState → 6 面（用于从主魔方导入） */
export function stateToFaces(state: CubeState): SixFaceInput {
  // 利用 MiniCube2D 的 getStickerString 输出 54 字符（U R F D L B 顺序）
  // 用 state.ts 里的 getStickerString
  // 这里 inline 实现避免循环依赖
  const half = (state.size - 1) / 2
  const size = state.size
  const result: Record<Face, FaceColors> = {
    U: ['U', 'U', 'U', 'U', 'U', 'U', 'U', 'U', 'U'] as FaceColors,
    R: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'] as FaceColors,
    F: ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F'] as FaceColors,
    D: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'] as FaceColors,
    L: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'] as FaceColors,
    B: ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'] as FaceColors,
  }
  const FACE_GRIDS: Record<Face, { axisIdx: 0 | 1 | 2, normalSign: number, position: (x: number, y: number, z: number, h: number) => [number, number] }> = {
    U: { axisIdx: 1, normalSign: 1, position: (x, _y, z, h) => [x + h, h - z] },
    D: { axisIdx: 1, normalSign: -1, position: (x, _y, z, h) => [h - x, h - z] },
    R: { axisIdx: 0, normalSign: 1, position: (_x, y, z, h) => [h - z, h - y] },
    L: { axisIdx: 0, normalSign: -1, position: (_x, y, z, h) => [z + h, h - y] },
    F: { axisIdx: 2, normalSign: 1, position: (x, y, _z, h) => [x + h, h - y] },
    B: { axisIdx: 2, normalSign: -1, position: (x, y, _z, h) => [h - x, h - y] },
  }
  for (const face of FACE_COLORS) {
    const grid: string[] = new Array(9).fill('?')
    const fg = FACE_GRIDS[face]
    for (const cu of state.cubies) {
      if (Math.abs(cu.pos[fg.axisIdx] - fg.normalSign * half) >= 0.1) continue
      for (const st of cu.stickers) {
        const wn = rotateVec(cu.ori, st.normal) as Vec3
        if (Math.abs(wn[fg.axisIdx] - fg.normalSign) >= 0.1) continue
        const [col, row] = fg.position(cu.pos[0], cu.pos[1], cu.pos[2], half)
        const colI = Math.round(col)
        const rowI = Math.round(row)
        if (colI < 0 || colI >= size || rowI < 0 || rowI >= size) continue
        grid[rowI * size + colI] = st.color
      }
    }
    result[face] = grid as FaceColors
  }
  return result as SixFaceInput
}

/** 6 面 → CubeState（从手动/摄像头输入重建） */
export function faceletsToState(input: SixFaceInput): CubeState {
  // 简化：构造每个 cubie 的 pos + stickers + ori
  // 假设所有 cubie 的 ori = identity（不准确但够用）
  // 更好的做法：从 sticker color 组合推断 piece ID，再从 piece ID 推断 ori
  // 这里用最简版：每个 cubie 位置填它朝外 3 个方向的 sticker（color 来自 input）

  // Face grid mapping (与 state.ts FACE_GRIDS 一致)
  const FACE_GRIDS: Record<Face, { axisIdx: 0 | 1 | 2, normalSign: number, position: (x: number, y: number, z: number, h: number) => [number, number] }> = {
    U: { axisIdx: 1, normalSign: 1, position: (x, _y, z, h) => [x + h, h - z] },
    D: { axisIdx: 1, normalSign: -1, position: (x, _y, z, h) => [h - x, h - z] },
    R: { axisIdx: 0, normalSign: 1, position: (_x, y, z, h) => [h - z, h - y] },
    L: { axisIdx: 0, normalSign: -1, position: (_x, y, z, h) => [z + h, h - y] },
    F: { axisIdx: 2, normalSign: 1, position: (x, y, _z, h) => [x + h, h - y] },
    B: { axisIdx: 2, normalSign: -1, position: (x, y, _z, h) => [h - x, h - y] },
  }
  // Face normal direction in world space
  const FACE_NORMAL: Record<Face, Vec3> = {
    U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
  }

  // 起点：从 solved state 复制结构（26 cubies with correct pos + stickers 结构）
  const baseState = newCube(3)
  const half = 1
  const newCubies: typeof baseState.cubies = []

  for (const cu of baseState.cubies) {
    const [x, y, z] = cu.pos
    const newStickers: { color: Face; normal: Vec3 }[] = []
    // 对每个 face，如果这个 cubie 在 face 平面上（axisIdx == normalSign * half），从 input 取颜色
    for (const face of FACE_COLORS) {
      const fg = FACE_GRIDS[face]
      if (Math.abs(cu.pos[fg.axisIdx] - fg.normalSign * half) >= 0.1) continue
      // 计算这个 cubie 在 face grid 中的 (col, row)
      const [col, row] = fg.position(x, y, z, half)
      const colI = Math.round(col)
      const rowI = Math.round(row)
      if (colI < 0 || colI >= 3 || rowI < 0 || rowI >= 3) continue
      const color = input[face][rowI * 3 + colI] as Face
      // sticker normal = world face normal (假设 ori = identity)
      newStickers.push({ color, normal: FACE_NORMAL[face] })
    }
    newCubies.push({
      pos: [...cu.pos] as Vec3,
      ori: [...cu.ori] as [number, number, number, number],
      stickers: newStickers,
    })
  }

  return { size: 3, cubies: newCubies }
}

import { rotateVec } from './quat'
import type { Vec3 } from './quat'
