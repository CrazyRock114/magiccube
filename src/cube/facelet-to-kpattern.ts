// 6 面颜色输入 → cubing.js KPattern
//
// 算法：
// 1. 对每个 corner 位置 (slot 0-7) 找 3 个 sticker colors (从对应 face grid)
// 2. 用 3 colors 查表找 piece ID (0-7)
// 3. 用 3 colors 在 3 个 face 上的分布算 orientation
// 4. 同样处理 12 edge + 6 center
// 5. 构造 KPatternData，传给 cubing.js Kociemba solver
//
// Slot 顺序（cubing.js 0.63）：
// CORNER: 0=URF, 1=URB, 2=ULB, 3=UFL, 4=DFR, 5=DFL, 6=DBL, 7=DRB
// EDGE:   0=UF,  1=UR,   2=UB,   3=UL,   4=DF,   5=DR,   6=DB,   7=DL, 8=FR, 9=FL, 10=BR, 11=BL

import { cube3x3x3 } from 'cubing/puzzles'
import { KPattern } from 'cubing/kpuzzle'
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search'
import type { Face } from './state'
import type { FaceColors, SixFaceInput } from './facelet'

// (x, y, z) → grid (col, row) for each face
// 与 state.ts FACE_GRIDS 一致
const FACE_GRID_POS: Record<Face, (x: number, y: number, z: number, h: number) => [number, number]> = {
  U: (x, _y, z, h) => [x + h, h - z],
  D: (x, _y, z, h) => [h - x, h - z],
  R: (_x, y, z, h) => [h - z, h - y],
  L: (_x, y, z, h) => [z + h, h - y],
  F: (x, y, _z, h) => [x + h, h - y],
  B: (x, y, _z, h) => [h - x, h - y],
}

// Corner slot positions (x, y, z) by cubing.js slot index
const CORNER_SLOT_POS: Array<[number, number, number]> = [
  [1, 1, 1],   // 0: URF
  [1, 1, -1],  // 1: URB
  [-1, 1, -1], // 2: ULB
  [-1, 1, 1],  // 3: UFL
  [1, -1, 1],  // 4: DFR
  [-1, -1, 1], // 5: DFL
  [-1, -1, -1],// 6: DBL
  [1, -1, -1], // 7: DRB
]

// Edge slot positions
const EDGE_SLOT_POS: Array<[number, number, number]> = [
  [0, 1, 1],   // 0: UF
  [1, 1, 0],   // 1: UR
  [0, 1, -1],  // 2: UB
  [-1, 1, 0],  // 3: UL
  [0, -1, 1],  // 4: DF
  [1, -1, 0],  // 5: DR
  [0, -1, -1], // 6: DB
  [-1, -1, 0], // 7: DL
  [1, 0, 1],   // 8: FR
  [-1, 0, 1],  // 9: FL
  [1, 0, -1],  // 10: BR
  [-1, 0, -1], // 11: BL
]

// Face → world normal direction
const FACE_NORMAL_DIR: Record<Face, [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
}

// 8 corner pieces: piece ID → 3 sticker colors (in any order)
const CORNER_PIECES: Array<{ colors: Face[] }> = [
  { colors: ['U', 'R', 'F'] },  // 0: URF
  { colors: ['U', 'R', 'B'] },  // 1: URB
  { colors: ['U', 'L', 'B'] },  // 2: ULB
  { colors: ['U', 'F', 'L'] },  // 3: UFL
  { colors: ['D', 'F', 'R'] },  // 4: DFR
  { colors: ['D', 'F', 'L'] },  // 5: DFL
  { colors: ['D', 'L', 'B'] },  // 6: DBL
  { colors: ['D', 'R', 'B'] },  // 7: DRB
]

// 12 edge pieces
const EDGE_PIECES: Array<{ colors: Face[] }> = [
  { colors: ['U', 'F'] },  // 0: UF
  { colors: ['U', 'R'] },  // 1: UR
  { colors: ['U', 'B'] },  // 2: UB
  { colors: ['U', 'L'] },  // 3: UL
  { colors: ['D', 'F'] },  // 4: DF
  { colors: ['D', 'R'] },  // 5: DR
  { colors: ['D', 'B'] },  // 6: DB
  { colors: ['D', 'L'] },  // 7: DL
  { colors: ['F', 'R'] },  // 8: FR
  { colors: ['F', 'L'] },  // 9: FL
  { colors: ['B', 'R'] },  // 10: BR
  { colors: ['B', 'L'] },  // 11: BL
]

// Piece ID lookup by sorted colors
const CORNER_BY_COLORS: Map<string, number> = new Map()
for (let i = 0; i < 8; i++) {
  CORNER_BY_COLORS.set([...CORNER_PIECES[i].colors].sort().join(''), i)
}
const EDGE_BY_COLORS: Map<string, number> = new Map()
for (let i = 0; i < 12; i++) {
  EDGE_BY_COLORS.set([...EDGE_PIECES[i].colors].sort().join(''), i)
}

// 在 cubie position (x, y, z)，找到这个 cubie 朝外的 3 (corner) / 2 (edge) 个面 + 各自 grid 位置
function getCubieStickers(
  pos: [number, number, number],
  input: SixFaceInput,
): Array<{ face: Face; color: Face; faceDir: [number, number, number] }> {
  const [x, y, z] = pos
  const half = 1
  const result: Array<{ face: Face; color: Face; faceDir: [number, number, number] }> = []
  for (const face of ['U', 'D', 'R', 'L', 'F', 'B'] as Face[]) {
    const dir = FACE_NORMAL_DIR[face]
    // Check if this cubie's position aligns with the face's plane
    if (face === 'U' && y !== half) continue
    if (face === 'D' && y !== -half) continue
    if (face === 'R' && x !== half) continue
    if (face === 'L' && x !== -half) continue
    if (face === 'F' && z !== half) continue
    if (face === 'B' && z !== -half) continue
    const [col, row] = FACE_GRID_POS[face](x, y, z, half)
    const colI = Math.round(col)
    const rowI = Math.round(row)
    if (colI < 0 || colI > 2 || rowI < 0 || rowI > 2) continue
    const color = input[face][rowI * 3 + colI]
    result.push({ face, color, faceDir: dir })
  }
  return result
}

// 计算 corner orientation (0/1/2)
// 约定：对于 U-layer corner，orientation 是 U-sticker 的位置:
//   U face = 0, F or L face = 1, R or B face = 2 (具体由 cubing.js 决定)
// 对于 D-layer corner，orientation 类似但 D-sticker 在 D face = 0
// 简化：用 cubing.js 实际 convention: 找 U 或 D 颜色的 sticker 在哪个 face
function cornerOrientation(
  pos: [number, number, number],
  pieceId: number,
  stickers: Array<{ face: Face; color: Face; faceDir: [number, number, number] }>,
): number {
  // pieceId 0-3 are U-layer corners (have U color), 4-7 are D-layer corners (have D color)
  const isULayer = pieceId < 4
  const upColor: Face = isULayer ? 'U' : 'D'
  // Find which face the upColor sticker is on
  const upSticker = stickers.find(s => s.color === upColor)
  if (!upSticker) return 0  // shouldn't happen for valid input
  // orientation = 0 if sticker is on the correct U/D face, else 1 or 2
  if (upSticker.face === upColor) return 0
  // For U-layer corner, if U is on F or R face, it's twisted
  // Use the face to determine orientation
  // cubing.js convention: 0 = solved, 1 = twisted 120° CW, 2 = twisted 240° CW (from U face looking down)
  if (upColor === 'U') {
    if (upSticker.face === 'F') return 1
    if (upSticker.face === 'R') return 2
    if (upSticker.face === 'L') return 2  // could be 1 depending on convention
    if (upSticker.face === 'B') return 1
  } else {
    // D-layer: similar but from D face
    if (upSticker.face === 'F') return 2
    if (upSticker.face === 'R') return 1
    if (upSticker.face === 'L') return 1
    if (upSticker.face === 'B') return 2
  }
  return 0
}

// Edge orientation (0/1 = flipped or not)
function edgeOrientation(
  pieceId: number,
  stickers: Array<{ face: Face; color: Face; faceDir: [number, number, number] }>,
): number {
  // For an edge with U/D color, if U/D color is on U/D face → 0, else 1 (flipped)
  const isULayer = pieceId < 4
  const udColor: Face = isULayer ? 'U' : 'D'
  const sticker = stickers.find(s => s.color === udColor)
  if (!sticker) return 0
  return sticker.face === udColor ? 0 : 1
}

export interface SolverSuccess {
  ok: true
  moves: string[]
  timeMs: number
}
export interface SolverFailure {
  ok: false
  error: string
}
export type SolverOutcome = SolverSuccess | SolverFailure

export async function solveViaCubing(input: SixFaceInput): Promise<SolverOutcome> {
  const startTime = performance.now()
  try {
    const cornerPieces: number[] = new Array(8).fill(0)
    const cornerOrientationArr: number[] = new Array(8).fill(0)
    const edgePieces: number[] = new Array(12).fill(0)
    const edgeOrientationArr: number[] = new Array(12).fill(0)
    const centerPieces: number[] = [0, 1, 2, 3, 4, 5]  // U R F D L B (assumed)

    // Process each corner slot
    for (let slot = 0; slot < 8; slot++) {
      const pos = CORNER_SLOT_POS[slot]
      const stickers = getCubieStickers(pos, input)
      if (stickers.length !== 3) {
        return { ok: false, error: `Corner slot ${slot} 找到 ${stickers.length} 个 sticker (期望 3)` }
      }
      const colors = stickers.map(s => s.color)
      const key = [...colors].sort().join('')
      const pieceId = CORNER_BY_COLORS.get(key)
      if (pieceId === undefined) {
        return { ok: false, error: `Corner slot ${slot} 颜色组合 ${key} 不是合法 corner piece` }
      }
      cornerPieces[slot] = pieceId
      cornerOrientationArr[slot] = cornerOrientation(pos, pieceId, stickers)
    }

    // Process each edge slot
    for (let slot = 0; slot < 12; slot++) {
      const pos = EDGE_SLOT_POS[slot]
      const stickers = getCubieStickers(pos, input)
      if (stickers.length !== 2) {
        return { ok: false, error: `Edge slot ${slot} 找到 ${stickers.length} 个 sticker (期望 2)` }
      }
      const colors = stickers.map(s => s.color)
      const key = [...colors].sort().join('')
      const pieceId = EDGE_BY_COLORS.get(key)
      if (pieceId === undefined) {
        return { ok: false, error: `Edge slot ${slot} 颜色组合 ${key} 不是合法 edge piece` }
      }
      edgePieces[slot] = pieceId
      edgeOrientationArr[slot] = edgeOrientation(pieceId, stickers)
    }

    // Construct KPatternData
    const kp = await cube3x3x3.kpuzzle()
    const patternData = {
      CORNERS: {
        pieces: cornerPieces,
        orientation: cornerOrientationArr,
      },
      EDGES: {
        pieces: edgePieces,
        orientation: edgeOrientationArr,
      },
      CENTERS: {
        pieces: centerPieces,
        orientation: [0, 0, 0, 0, 0, 0],
        orientationMod: [1, 1, 1, 1, 1, 1],
      },
    }
    const kpatter = new KPattern(kp, patternData as any)
    const alg = await experimentalSolve3x3x3IgnoringCenters(kpatter)
    const movesStr = alg.toString()
    // Parse moves from alg string
    const moves = movesStr.trim().split(/\s+/).filter(Boolean)
    return { ok: true, moves, timeMs: performance.now() - startTime }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
