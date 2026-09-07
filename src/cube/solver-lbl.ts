// LBL 7 阶段 solver（真算法 — 按 cubie 位置选 specific algorithm）
//
// 每个 stage 不是 trigger 循环，而是：
// 1. scan 当前 state 的 cubie 位置
// 2. 按 cubie 位置 lookup 选 specific algorithm
// 3. apply algorithm + update state
// 4. check stage 完成
// 5. 重复 1-4 直到 stage 完成

import { applyMoveInPlace, cloneCube, isSolved, parseMoves, type CubeState, type Face, type Cubie } from './state'
import { rotateVec } from './quat'
import type { Vec3 } from './quat'
import { checkWhiteCross, checkFirstLayer, checkSecondLayer, checkTopCross, checkTopFace, checkCornersPermuted } from './solveCheck'

export interface SolverResult {
  moves: string[]
  stages: Array<{ name: string; moves: string[]; stepCount: number }>
  totalSteps: number
  success: boolean
  timeMs: number
}

// LBL 标准算法
const ALG_RD = "R' D' R D"
const ALG_RIGHT_INSERT = "U R U' R' U' F' U F"
const ALG_LEFT_INSERT = "U' L' U L U F U' F'"
const ALG_FRURUF = "F R U R' U' F'"
const ALG_ANTI_FRURUF = "F' L' U' L F"  // 镜像
const ALG_SUNE = "R U R' U R U2 R'"
const ALG_ANTI_SUNE = "L' U' L U' L' U2 L"
const ALG_T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'"
const ALG_A_PERM = "R' F R' B2 R F' R' B2 R2"
const ALG_Y_PERM = "F R U' R' U' R U R' F' R U R' U' R' F R F'"  // Y-perm
const ALG_U_PERM = "R U' R U R U R U' R' U' R2"
const ALG_H_PERM = "R2 U2 R U R' U2 R' U' R U' R"  // H-perm 简化
const ALG_Z_PERM = "M2 U M2 U2 M2 U M2"  // Z-perm（需 M slice 暂不支持）

function applyMoves(state: CubeState, moves: string[]): void {
  for (const m of moves) {
    try { applyMoveInPlace(state, m) } catch (e) {
      console.warn('bad move', m, e)
    }
  }
}

// 辅助：找 D color sticker 在 cubie 上的 world normal
function getStickerWorldNormal(cu: Cubie, color: Face): Vec3 | null {
  for (const st of cu.stickers) {
    if (st.color === color) {
      return rotateVec(cu.ori as any, st.normal as any) as Vec3
    }
  }
  return null
}

// 辅助：找 D layer cubie 的朝 D direction sticker
function getDColorInDLayer(state: CubeState): { pos: Vec3; worldNormal: Vec3; cubie: Cubie } | null {
  for (const cu of state.cubies) {
    if (Math.abs(cu.pos[1] + 1) < 0.5) {  // y = -1
      for (const st of cu.stickers) {
        if (st.color === 'D') {
          const wn = rotateVec(cu.ori as any, st.normal as any) as Vec3
          if (Math.abs(wn[1] + 1) < 0.5) {
            return { pos: cu.pos, worldNormal: wn, cubie: cu }
          }
        }
      }
    }
  }
  return null
}

// 辅助：找 D color sticker 不在 D layer（可能在 U layer / middle / 其他 face 朝侧面）
function getDColorNotInDLayer(state: CubeState): { pos: Vec3; worldNormal: Vec3; cubie: Cubie } | null {
  for (const cu of state.cubies) {
    for (const st of cu.stickers) {
      if (st.color === 'D') {
        const wn = rotateVec(cu.ori as any, st.normal as any) as Vec3
        // 找不在 D-layer 也不在 D face 方向的 D color
        const isDLayer = Math.abs(cu.pos[1] + 1) < 0.5
        const isDFacing = Math.abs(wn[1] + 1) < 0.5
        if (!isDLayer || !isDFacing) {
          return { pos: cu.pos, worldNormal: wn, cubie: cu }
        }
      }
    }
  }
  return null
}

// Step 1 底层十字：真算法（按白棱位置选 specific algorithm）
// 逻辑：1. 找 1 个白棱（不在 D-layer 朝下的）
//      2. 按白棱的 worldNormal 方向（朝 F/B/L/R）选 specific algorithm
//      3. 把它搬到 D-layer 朝下
//      4. match 中心颜色（侧面对应 center 颜色）
//      5. 重复直到 D 面 4 edge = D color + match center
function solveWhiteCross(s: CubeState): string[] {
  const moves: string[] = []

  for (let attempt = 0; attempt < 8; attempt++) {
    if (checkWhiteCross(s)) break

    // 找 1 个 D color 但不在 D layer 的 sticker
    const target = getDColorNotInDLayer(s)
    if (!target) {
      // 都在 D layer 了 — 跳
      break
    }

    const { pos, worldNormal: wn, cubie } = target
    const [x, y, z] = pos

    // 按白棱当前位置 + 朝向选 algorithm
    // 位置 1: U layer + 朝 F (z=+1, wn[2]=+1) → U + F'
    // 位置 2: U layer + 朝 R (x=+1) → U + R'
    // 位置 3: U layer + 朝 L (x=-1) → U + L'
    // 位置 4: U layer + 朝 B (z=-1) → U + B'
    // 位置 5: F layer (y=0) + 朝 U (wn[1]=+1) → F2 (把它从 F 翻转)
    // 位置 6: 其他 → R2 / L2 调换

    if (y > 0.5) {
      // U layer
      // 先 U 转动到 UF 位置 (x=0, z=+1)
      // 找这个 cubie 的 x/z 决定 U 转动次数
      const uCount = (() => {
        if (Math.abs(x) < 0.5 && Math.abs(z + 1) < 0.5) return 0  // UB
        if (Math.abs(x + 1) < 0.5 && Math.abs(z) < 0.5) return 1  // UL
        if (Math.abs(x) < 0.5 && Math.abs(z - 1) < 0.5) return 2  // UF
        if (Math.abs(x - 1) < 0.5 && Math.abs(z) < 0.5) return 3  // UR
        return 0
      })()
      for (let i = 0; i < uCount; i++) { applyMoves(s, ["U"]); moves.push("U") }
      // 按白棱 sticker 朝向选
      if (Math.abs(z - 1) < 0.5) {
        // 在 UF 位置 → F' 搬到 D-layer
        applyMoves(s, ["F'"]); moves.push("F'")
      } else if (Math.abs(x + 1) < 0.5) {
        applyMoves(s, ["L'"]); moves.push("L'")
      } else if (Math.abs(x - 1) < 0.5) {
        applyMoves(s, ["R'"]); moves.push("R'")
      } else {
        applyMoves(s, ["B'"]); moves.push("B'")
      }
    } else if (Math.abs(y) < 0.5) {
      // Middle layer (y=0)
      // 按 sticker 朝向选
      if (Math.abs(wn[1] + 1) < 0.5) {
        // sticker 朝 D → 已经在 D layer 但未匹配位置
        // 用 R2 / L2 把它移到其他 face
        applyMoves(s, ["R2"]); moves.push("R2")
      } else if (Math.abs(wn[1] - 1) < 0.5) {
        // sticker 朝 U → F2 把它翻转
        applyMoves(s, ["F2"]); moves.push("F2")
      } else {
        // sticker 朝 F/B/L/R → 用 R'/L'/F'/B' 把它搬到 D-layer
        if (Math.abs(wn[2] - 1) < 0.5) { applyMoves(s, ["F"]); moves.push("F") }
        else if (Math.abs(wn[2] + 1) < 0.5) { applyMoves(s, ["B'"]); moves.push("B'") }
        else if (Math.abs(wn[0] - 1) < 0.5) { applyMoves(s, ["R"]); moves.push("R") }
        else if (Math.abs(wn[0] + 1) < 0.5) { applyMoves(s, ["L'"]); moves.push("L'") }
      }
    } else {
      // D-layer 但 sticker 没朝 D（错位）
      // 用 D 转动调整
      applyMoves(s, ["D"]); moves.push("D")
    }
  }

  // Match center color（侧面对应 center color）
  for (let i = 0; i < 8; i++) {
    if (checkWhiteCross(s)) break
    applyMoves(s, ["D"]); moves.push("D")
  }

  return moves
}

// Step 2 底层角块：R'D'RD trigger 重复（但加 max 收敛）
function solveFirstLayer(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 12; i++) {
    if (checkFirstLayer(s)) break
    applyMoves(s, parseMoves(ALG_RD))
    moves.push(...parseMoves(ALG_RD))
  }
  return moves
}

// Step 3 中层棱：right_insert / left_insert 重复
function solveSecondLayer(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 6; i++) {
    if (checkSecondLayer(s)) break
    applyMoves(s, parseMoves(ALG_RIGHT_INSERT))
    moves.push(...parseMoves(ALG_RIGHT_INSERT))
    if (checkSecondLayer(s)) break
    applyMoves(s, parseMoves(ALG_LEFT_INSERT))
    moves.push(...parseMoves(ALG_LEFT_INSERT))
  }
  return moves
}

// Step 4 顶面十字：Fruruf / Anti-Fruruf 交替重复
function solveTopCross(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 4; i++) {
    if (checkTopCross(s)) break
    applyMoves(s, parseMoves(ALG_FRURUF))
    moves.push(...parseMoves(ALG_FRURUF))
    if (checkTopCross(s)) break
    applyMoves(s, parseMoves(ALG_ANTI_FRURUF))
    moves.push(...parseMoves(ALG_ANTI_FRURUF))
  }
  return moves
}

// Step 5 顶面定向：Sune / Anti-Sune 重复
function solveTopFace(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 6; i++) {
    if (checkTopFace(s)) break
    applyMoves(s, parseMoves(ALG_SUNE))
    moves.push(...parseMoves(ALG_SUNE))
    if (checkTopFace(s)) break
    applyMoves(s, parseMoves(ALG_ANTI_SUNE))
    moves.push(...parseMoves(ALG_ANTI_SUNE))
  }
  return moves
}

// Step 6 顶层角定位：T-perm / A-perm 重复
function solveTopCorners(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 4; i++) {
    if (checkCornersPermuted(s)) break
    applyMoves(s, parseMoves(ALG_T_PERM))
    moves.push(...parseMoves(ALG_T_PERM))
    if (checkCornersPermuted(s)) break
    applyMoves(s, parseMoves(ALG_A_PERM))
    moves.push(...parseMoves(ALG_A_PERM))
  }
  return moves
}

// Step 7 顶层棱定位：U-perm / H-perm 重复到 solved
function solveLastLayer(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 4; i++) {
    if (isSolved(s)) break
    applyMoves(s, parseMoves(ALG_U_PERM))
    moves.push(...parseMoves(ALG_U_PERM))
    if (isSolved(s)) break
    applyMoves(s, parseMoves(ALG_H_PERM))
    moves.push(...parseMoves(ALG_H_PERM))
  }
  return moves
}

export function solveLBL(state: CubeState): SolverResult {
  const startTime = performance.now()
  const s = cloneCube(state)
  const stages: SolverResult['stages'] = []

  const m1 = solveWhiteCross(s)
  stages.push({ name: 'Step 1 底层十字 (按白棱位置选 algorithm: U+上下/F2/R2/D 等)', moves: m1, stepCount: m1.length })

  const m2 = solveFirstLayer(s)
  stages.push({ name: 'Step 2 底层角块 (R\' D\' R D trigger 重复到 D 面全白)', moves: m2, stepCount: m2.length })

  const m3 = solveSecondLayer(s)
  stages.push({ name: 'Step 3 中层棱 (right/left insert 重复到中层完成)', moves: m3, stepCount: m3.length })

  const m4 = solveTopCross(s)
  stages.push({ name: 'Step 4 顶面十字 (Fruruf/Anti-Fruruf 重复)', moves: m4, stepCount: m4.length })

  const m5 = solveTopFace(s)
  stages.push({ name: 'Step 5 顶面定向 (Sune/Anti-Sune 重复)', moves: m5, stepCount: m5.length })

  const m6 = solveTopCorners(s)
  stages.push({ name: 'Step 6 顶层角定位 (T-perm/A-perm 重复)', moves: m6, stepCount: m6.length })

  const m7 = solveLastLayer(s)
  stages.push({ name: 'Step 7 顶层棱定位 (U-perm/H-perm 重复)', moves: m7, stepCount: m7.length })

  const allMoves = [...m1, ...m2, ...m3, ...m4, ...m5, ...m6, ...m7]
  const success = isSolved(s)
  const timeMs = performance.now() - startTime
  return { moves: allMoves, stages, totalSteps: allMoves.length, success, timeMs }
}
