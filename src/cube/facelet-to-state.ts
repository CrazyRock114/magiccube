// 6 面颜色输入 → CubeState (用 piece ID lookup + orientation 推断)
//
// 不依赖 cubing.js（会触发 document 引用），纯 JS 重建 cubie 模型。
//
// 算法：
// 1. 对 8 corner slot (0-7) 找 3 个 sticker colors (从对应 face grid)
// 2. 用 3 colors 查表找 piece ID (0-7)
// 3. 用 U/D 颜色在哪个 face 推断 corner orientation (0/1/2)
// 4. 对 12 edge slot (0-11) 找 2 个 sticker colors
// 5. 用 2 colors 查 piece ID (0-11) + edge orientation (0/1)
// 6. 6 center 位置固定
// 7. 构造 CubeState（pos 已知，stickers 已知，ori = identity）
//
// 注意：ori 设 identity 是因为 sticker 朝向已经在 color+normal 里编码
// 实际 orbie 旋转靠 normal 方向隐式表达

import { newCube, type CubeState, type Face, type Sticker } from './state'
import type { FaceColors, SixFaceInput } from './facelet'
import { rotateVec } from './quat'
import type { Vec3 } from './quat'

// (x, y, z) → grid (col, row) for each face (与 state.ts FACE_GRIDS 一致)
const FACE_GRID_POS: Record<Face, (x: number, y: number, z: number, h: number) => [number, number]> = {
  U: (x, _y, z, h) => [x + h, h - z],
  D: (x, _y, z, h) => [h - x, h - z],
  R: (_x, y, z, h) => [h - z, h - y],
  L: (_x, y, z, h) => [z + h, h - y],
  F: (x, y, _z, h) => [x + h, h - y],
  B: (x, y, _z, h) => [h - x, h - y],
}

const FACE_NORMAL_DIR: Record<Face, [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
}

// cubing.js KPattern slot 顺序 (从 probe 推导)
// CORNER: 0=URF, 1=URB, 2=ULB, 3=UFL, 4=DFR, 5=DFL, 6=DBL, 7=DRB
const CORNER_SLOT_POS: Array<[number, number, number]> = [
  [1, 1, 1], [1, 1, -1], [-1, 1, -1], [-1, 1, 1],
  [1, -1, 1], [-1, -1, 1], [-1, -1, -1], [1, -1, -1],
]

// EDGE: 0=UF, 1=UR, 2=UB, 3=UL, 4=DF, 5=DR, 6=DB, 7=DL, 8=FR, 9=FL, 10=BR, 11=BL
const EDGE_SLOT_POS: Array<[number, number, number]> = [
  [0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0],
  [0, -1, 1], [1, -1, 0], [0, -1, -1], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
]

// 8 corner piece IDs (按 cubing.js 顺序)
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

const EDGE_PIECES: Array<{ colors: Face[] }> = [
  { colors: ['U', 'F'] }, { colors: ['U', 'R'] }, { colors: ['U', 'B'] }, { colors: ['U', 'L'] },
  { colors: ['D', 'F'] }, { colors: ['D', 'R'] }, { colors: ['D', 'B'] }, { colors: ['D', 'L'] },
  { colors: ['F', 'R'] }, { colors: ['F', 'L'] }, { colors: ['B', 'R'] }, { colors: ['B', 'L'] },
]

const CORNER_BY_COLORS: Map<string, number> = new Map()
for (let i = 0; i < 8; i++) CORNER_BY_COLORS.set([...CORNER_PIECES[i].colors].sort().join(''), i)
const EDGE_BY_COLORS: Map<string, number> = new Map()
for (let i = 0; i < 12; i++) EDGE_BY_COLORS.set([...EDGE_PIECES[i].colors].sort().join(''), i)

// 找 cubie 位置 (x, y, z) 朝外的 stickers
function getStickersAt(
  pos: [number, number, number],
  input: SixFaceInput,
): Array<{ face: Face; color: Face; faceDir: [number, number, number] }> {
  const [x, y, z] = pos
  const half = 1
  const result: Array<{ face: Face; color: Face; faceDir: [number, number, number] }> = []
  for (const face of ['U', 'D', 'R', 'L', 'F', 'B'] as Face[]) {
    const dir = FACE_NORMAL_DIR[face]
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

/** 6 面 → CubeState (假设合法的魔方状态) */
export function sixFaceToState(input: SixFaceInput): CubeState {
  const base = newCube(3)
  const newCubies = base.cubies.map((cu) => {
    const stickers = getStickersAt(cu.pos, input)
    return {
      pos: [...cu.pos] as Vec3,
      ori: [0, 0, 0, 1] as [number, number, number, number],  // identity quat
      stickers: stickers.map((s) => ({ color: s.color, normal: s.faceDir })) as Sticker[],
    }
  })
  return { size: 3, cubies: newCubies }
}

/** 验证 6 面是否能转成合法 CubeState（颜色组合是否合法） */
export function validateSixFace(input: SixFaceInput): { ok: boolean; error?: string } {
  // 每色 9 次
  const counts: Record<Face, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 }
  for (const f of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
    for (const c of input[f]) counts[c]++
  }
  for (const f of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
    if (counts[f] !== 9) return { ok: false, error: `颜色 ${f} 出现 ${counts[f]} 次（应该 9 次）` }
  }
  // 每个 corner 3 颜色组合必须对应一个合法 corner piece
  for (let slot = 0; slot < 8; slot++) {
    const pos = CORNER_SLOT_POS[slot]
    const stickers = getStickersAt(pos, input)
    if (stickers.length !== 3) return { ok: false, error: `Corner slot ${slot} sticker 数量错（${stickers.length}）` }
    const key = stickers.map(s => s.color).sort().join('')
    if (!CORNER_BY_COLORS.has(key)) return { ok: false, error: `Corner ${slot} 颜色组合 ${key} 不合法` }
  }
  // 每个 edge 2 颜色组合必须对应一个合法 edge piece
  for (let slot = 0; slot < 12; slot++) {
    const pos = EDGE_SLOT_POS[slot]
    const stickers = getStickersAt(pos, input)
    if (stickers.length !== 2) return { ok: false, error: `Edge slot ${slot} sticker 数量错（${stickers.length}）` }
    const key = stickers.map(s => s.color).sort().join('')
    if (!EDGE_BY_COLORS.has(key)) return { ok: false, error: `Edge ${slot} 颜色组合 ${key} 不合法` }
  }
  return { ok: true }
}
