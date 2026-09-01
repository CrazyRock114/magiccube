// NxN Rubik's cube state (cubie model).
// 每个 cubie 有 grid position + orientation (quaternion) + stickers。
// 支持 N=2, 3, 4。状态用 mutable-in-place 风格 (caller 做 clone)。

import { IDENTITY_QUAT, multiplyQuat, quatFromAxisAngle, rotateGrid90, snapPos, rotateVec } from './quat'
import type { Quat, Vec3 } from './quat'

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type Axis = 'x' | 'y' | 'z'

export interface Sticker {
  // 这个 sticker 的颜色（不动；stickers 永远属于它所在的 cubie）
  color: Face
  // sticker 在 cubie 局部坐标系中的法线方向
  normal: Vec3
}

export interface Cubie {
  pos: Vec3            // grid 位置
  ori: Quat            // 朝向 (quaternion)
  stickers: Sticker[]  // 在 cubie 局部空间朝外的 sticker 们
}

export interface CubeState {
  size: 2 | 3 | 4
  cubies: Cubie[]
}

export const COLOR_HEX: Record<Face, string> = {
  U: '#f5f5f5', D: '#ffd500', F: '#009b48', B: '#0046ad', L: '#ff5900', R: '#b71234',
}

export const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

// --- 构造 solved state ---

function stickersForPosition(x: number, y: number, z: number, half: number): Sticker[] {
  const stickers: Sticker[] = []
  if (x === half) stickers.push({ color: 'R', normal: [1, 0, 0] })
  if (x === -half) stickers.push({ color: 'L', normal: [-1, 0, 0] })
  if (y === half) stickers.push({ color: 'U', normal: [0, 1, 0] })
  if (y === -half) stickers.push({ color: 'D', normal: [0, -1, 0] })
  if (z === half) stickers.push({ color: 'F', normal: [0, 0, 1] })
  if (z === -half) stickers.push({ color: 'B', normal: [0, 0, -1] })
  return stickers
}

export function solvedCube(size: 2 | 3 | 4): CubeState {
  const cubies: Cubie[] = []
  const half = (size - 1) / 2
  for (let xi = 0; xi < size; xi++) {
    for (let yi = 0; yi < size; yi++) {
      for (let zi = 0; zi < size; zi++) {
        // 内部不可见 cubie 跳过
        if (xi > 0 && xi < size - 1 &&
            yi > 0 && yi < size - 1 &&
            zi > 0 && zi < size - 1) continue
        const x = xi - half
        const y = yi - half
        const z = zi - half
        cubies.push({
          pos: [x, y, z],
          ori: [...IDENTITY_QUAT] as Quat,
          stickers: stickersForPosition(x, y, z, half),
        })
      }
    }
  }
  return { size, cubies }
}

export function newCube(size: 2 | 3 | 4 = 3): CubeState {
  return solvedCube(size)
}

export function cloneCube(c: CubeState): CubeState {
  return {
    size: c.size,
    cubies: c.cubies.map(cu => ({
      pos: [...cu.pos] as Vec3,
      ori: [...cu.ori] as Quat,
      stickers: cu.stickers.map(s => ({ color: s.color, normal: [...s.normal] as Vec3 })),
    })),
  }
}

// --- Move 应用 ---

export interface MoveInfo {
  face: Face
  prime: boolean
  double: boolean
  wide: boolean  // 4x4: 转 2 层
}

export function parseMoveToken(m: string): MoveInfo {
  if (!m) throw new Error('empty move')
  const ch = m[0]
  const faceUpper = ch.toUpperCase() as Face
  if (!'URFDLB'.includes(faceUpper)) throw new Error('unknown face: ' + ch)
  return {
    face: faceUpper,
    prime: m.includes("'"),
    double: m.includes('2'),
    wide: ch === ch.toLowerCase() || m.includes('w'),
  }
}

function getLayers(state: CubeState, info: MoveInfo): { axis: Axis; layers: number[] } {
  const half = (state.size - 1) / 2
  let axis: Axis
  let outerLayer: number
  switch (info.face) {
    case 'R': axis = 'x'; outerLayer = half; break
    case 'L': axis = 'x'; outerLayer = -half; break
    case 'U': axis = 'y'; outerLayer = half; break
    case 'D': axis = 'y'; outerLayer = -half; break
    case 'F': axis = 'z'; outerLayer = half; break
    case 'B': axis = 'z'; outerLayer = -half; break
  }
  if (info.wide && state.size === 4) {
    const inner = outerLayer > 0 ? outerLayer - 1 : outerLayer + 1
    return { axis, layers: [outerLayer, inner] }
  }
  return { axis, layers: [outerLayer] }
}

function axisIndex(axis: Axis): 0 | 1 | 2 {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2
}

function applyTurn(c: Cubie, axis: Axis, totalTurns: 1 | 2 | 3, angleQuat: Quat): void {
  c.pos = snapPos(rotateGrid90(c.pos, axis, totalTurns))
  c.ori = multiplyQuat(angleQuat, c.ori) as Quat
}

function computeTurn(move: string): { totalTurns: 1 | 2 | 3; angleQuat: Quat } {
  const info = parseMoveToken(move)
  const turns = info.double ? 2 : (info.prime ? 3 : 1)
  let axis: Axis
  switch (info.face) {
    case 'R': case 'L': axis = 'x'; break
    case 'U': case 'D': axis = 'y'; break
    case 'F': case 'B': axis = 'z'; break
  }
  // 对于 R/U/F（normal 在 +axis 方向），CW = 1 quarter
  // 对于 L/D/B（normal 在 -axis 方向），CW = -1 quarter
  // 我们用 rotateGrid90 的"绕 +axis 顺时针"作为基本动作。
  // R: 1 quarter CW around +X
  // L: 1 quarter CW around +X axis 但 L 面是 -X，所以 L = 3 quarter CW around +X = -1 quarter
  // 同理 D/B。
  const negate = info.face === 'L' || info.face === 'D' || info.face === 'B'
  const totalTurns = (negate ? (4 - turns) : turns) as 1 | 2 | 3
  const angle = -Math.PI / 2 * totalTurns
  return { totalTurns, angleQuat: quatFromAxisAngle(axis, angle) }
}

export function applyMove(state: CubeState, move: string): CubeState {
  const info = parseMoveToken(move)
  const { axis, layers } = getLayers(state, info)
  const { totalTurns, angleQuat } = computeTurn(move)
  const axisIdx = axisIndex(axis)

  const newCubies: Cubie[] = []
  for (const cu of state.cubies) {
    if (layers.includes(cu.pos[axisIdx])) {
      const newCu: Cubie = {
        pos: [...cu.pos] as Vec3,
        ori: [...cu.ori] as Quat,
        stickers: cu.stickers,
      }
      applyTurn(newCu, axis, totalTurns, angleQuat)
      newCubies.push(newCu)
    } else {
      newCubies.push(cu)
    }
  }
  return { size: state.size, cubies: newCubies }
}

export function applyMoveInPlace(state: CubeState, move: string): void {
  const info = parseMoveToken(move)
  const { axis, layers } = getLayers(state, info)
  const { totalTurns, angleQuat } = computeTurn(move)
  const axisIdx = axisIndex(axis)
  for (const cu of state.cubies) {
    if (layers.includes(cu.pos[axisIdx])) {
      applyTurn(cu, axis, totalTurns, angleQuat)
    }
  }
}

export function applyMoves(state: CubeState, moves: string): CubeState {
  let cur = state
  for (const m of parseMoves(moves)) cur = applyMove(cur, m)
  return cur
}

export function applyMovesInPlace(state: CubeState, moves: string): void {
  for (const m of parseMoves(moves)) applyMoveInPlace(state, m)
}

// --- 查询 ---

export function parseMoves(notation: string): string[] {
  return notation.trim().split(/\s+/).filter(Boolean)
}

export function invertMoveToken(m: string): string {
  if (m.endsWith("'")) return m.slice(0, -1)
  if (m.endsWith('2')) return m
  return m + "'"
}

export function invertMoves(notation: string): string {
  return parseMoves(notation).reverse().map(invertMoveToken).join(' ')
}

export function isSolved(state: CubeState): boolean {
  const solved = solvedCube(state.size)
  // 按位置查：每个 solved 位置上的当前 cubie 必须是 identity ori (q or -q)
  const currentByPos = new Map<string, Cubie>()
  for (const c of state.cubies) {
    currentByPos.set(`${c.pos[0]},${c.pos[1]},${c.pos[2]}`, c)
  }
  for (const sCu of solved.cubies) {
    const cCu = currentByPos.get(`${sCu.pos[0]},${sCu.pos[1]},${sCu.pos[2]}`)
    if (!cCu) return false
    // 四元数 double-cover：q 和 -q 表示同一旋转。identity 可以是 (0,0,0,1) 或 (0,0,0,-1)
    if (Math.abs(cCu.ori[0]) > 0.0001 || Math.abs(cCu.ori[1]) > 0.0001 || Math.abs(cCu.ori[2]) > 0.0001) return false
    if (Math.abs(Math.abs(cCu.ori[3]) - 1) > 0.0001) return false
  }
  return true
}

// --- Sticker string 投影（用于 MiniCube2D） ---

interface FaceGrid {
  face: Face
  normalAxis: Axis
  normalSign: 1 | -1
  position: (x: number, y: number, z: number, half: number) => [number, number]
}

const FACE_GRIDS: Record<Face, FaceGrid> = {
  U: { face: 'U', normalAxis: 'y', normalSign:  1, position: (x, _y, z, h) => [x + h, h - z] },
  D: { face: 'D', normalAxis: 'y', normalSign: -1, position: (x, _y, z, h) => [x + h, z + h] },
  R: { face: 'R', normalAxis: 'x', normalSign:  1, position: (_x, y, z, h) => [h - z, h - y] },
  L: { face: 'L', normalAxis: 'x', normalSign: -1, position: (_x, y, z, h) => [z + h, h - y] },
  F: { face: 'F', normalAxis: 'z', normalSign:  1, position: (x, y, _z, h) => [x + h, h - y] },
  B: { face: 'B', normalAxis: 'z', normalSign: -1, position: (x, y, _z, h) => [h - x, h - y] },
}

export function getStickerString(state: CubeState): string {
  const half = (state.size - 1) / 2
  const size = state.size
  const result: string[] = []
  for (const fg of FACE_ORDER.map(f => FACE_GRIDS[f])) {
    const grid: string[] = new Array(size * size).fill('?')
    const axIdx = axisIndex(fg.normalAxis)
    for (const cu of state.cubies) {
      // cubie 必须真的在该 face 的平面上（否则 sticker 朝外是朝魔方内部）
      if (Math.abs(cu.pos[axIdx] - fg.normalSign * half) >= 0.1) continue
      for (const st of cu.stickers) {
        const worldNormal = rotateVec(cu.ori, st.normal)
        if (Math.abs(worldNormal[axIdx] - fg.normalSign) >= 0.1) continue
        const [col, row] = fg.position(cu.pos[0], cu.pos[1], cu.pos[2], half)
        const colI = Math.round(col)
        const rowI = Math.round(row)
        if (colI < 0 || colI >= size || rowI < 0 || rowI >= size) continue
        grid[rowI * size + colI] = st.color
      }
    }
    result.push(grid.join(''))
  }
  return result.join('')
}

// Legacy compat: 老的 code 还在用 faceOf(s, face)
export function faceOf(s: string, face: Face): string {
  const i = FACE_ORDER.indexOf(face)
  const totalChars = s.length
  const size = Math.sqrt(totalChars / 6)
  return s.slice(i * size * size, (i + 1) * size * size)
}
