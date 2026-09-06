// LBL 7 步 solver（初学者解法）
//
// 贪婪地按 7 步逐步还原。每步有 look-up 算法 + 检测函数：
// 1. 底层十字（手摆 - 找含白 sticker 的 4 个 edge 搬到底层）
// 2. 底层角块（R' D' R D trigger 重复）
// 3. 中层棱（右版 / 左版 URU'R'F'UF / U'L'ULUFU'F'）
// 4. 顶面十字（F R U R' U' F' = Fruruf 重复到 U 面 4 edge 都朝上）
// 5. 顶面定向（Sune / Anti-Sune 重复）
// 6. 顶层角定位（T-perm / A-perm 重复）
// 7. 顶层棱定位（U-perm / H-perm 重复）
//
// 输出：move 字符串数组（用 parseMoves 解析后应用）
// 颜色约定：white = U 色, yellow = D 色（标准 LBL 配色）

import { applyMoveInPlace, cloneCube, newCube, parseMoveToken, type CubeState, type Face } from './state'
import { rotateVec } from './quat'
import type { Vec3 } from './quat'

// --- 已知公式（按层）---

const FRURUF = ['F', 'R', 'U', "R'", "U'", "F'"]
const SUNE = ['R', 'U', "R'", 'U', 'R', 'U2', "R'"]
const ANTI_SUNE = ["L'", "U'", 'L', "U'", "L'", "U2", 'L']
const T_PERM = ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"]
const A_PERM = ["R'", 'F', "R'", 'B2', 'R', "F'", "R'", 'B2', 'R2']
const U_PERM = ['R', "U'", 'R', 'U', 'R', 'U', 'R', "U'", "R'", "U'", 'R2']
const H_PERM = ['R2', 'U2', 'R', 'U2', 'R2', 'U2', 'R2', 'U2', 'R', 'U2', 'R2']
const RIGHT_INSERT = ['U', 'R', "U'", "R'", "U'", "F'", 'U', 'F']
const LEFT_INSERT = ["U'", "L'", 'U', 'L', 'U', 'F', "U'", "F'"]

// --- 检测函数 ---

function stickersFacing(state: CubeState, face: Face): Array<{ pos: Vec3, color: Face }> {
  const target = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] }[face] as Vec3
  const out: Array<{ pos: Vec3, color: Face }> = []
  for (const cu of state.cubies) {
    for (const s of cu.stickers) {
      const wn = rotateVec(cu.ori, s.normal) as Vec3
      if (Math.abs(wn[0] - target[0]) < 0.5 && Math.abs(wn[1] - target[1]) < 0.5 && Math.abs(wn[2] - target[2]) < 0.5) {
        out.push({ pos: cu.pos, color: s.color })
      }
    }
  }
  return out
}

function isDAllWhite(state: CubeState): boolean {
  const ds = stickersFacing(state, 'D')
  if (ds.length !== 9) return false
  return ds.every(s => s.color === 'U')  // U = white
}

function isTopCross(state: CubeState): boolean {
  const us = stickersFacing(state, 'U')
  if (us.length !== 9) return false
  const edges = us.filter(s => Math.abs(s.pos[1] - 1) < 0.5 && Math.abs(Math.abs(s.pos[0]) + Math.abs(s.pos[2]) - 1) < 0.5)
  if (edges.length !== 4) return false
  return edges.every(e => e.color === 'D')  // D = yellow
}

function isTopFace(state: CubeState): boolean {
  const us = stickersFacing(state, 'U')
  if (us.length !== 9) return false
  return us.every(s => s.color === 'D')
}

function isCornersPermuted(state: CubeState): boolean {
  for (const cu of state.cubies) {
    const [x, y, z] = cu.pos
    if (Math.abs(y - 1) < 0.5 && Math.abs(Math.abs(x) - 1) < 0.5 && Math.abs(Math.abs(z) - 1) < 0.5) {
      if (cu.stickers.length !== 3) return false
      for (const s of cu.stickers) {
        const wn = rotateVec(cu.ori, s.normal) as Vec3
        let expected: Face
        if (Math.abs(wn[1] - 1) < 0.5) expected = 'U'
        else if (Math.abs(wn[0]) > 0.5) expected = wn[0] > 0 ? 'R' : 'L'
        else if (Math.abs(wn[2]) > 0.5) expected = wn[2] > 0 ? 'F' : 'B'
        else continue
        if (s.color !== expected) return false
      }
    }
  }
  return true
}

function isSolved(state: CubeState): boolean {
  for (const cu of state.cubies) {
    for (const s of cu.stickers) {
      const wn = rotateVec(cu.ori, s.normal) as Vec3
      let expected: Face
      if (Math.abs(wn[1] - 1) < 0.5) expected = 'U'
      else if (Math.abs(wn[1] + 1) < 0.5) expected = 'D'
      else if (Math.abs(wn[0] - 1) < 0.5) expected = 'R'
      else if (Math.abs(wn[0] + 1) < 0.5) expected = 'L'
      else if (Math.abs(wn[2] - 1) < 0.5) expected = 'F'
      else if (Math.abs(wn[2] + 1) < 0.5) expected = 'B'
      else continue
      if (s.color !== expected) return false
    }
  }
  return true
}

// --- 工具 ---

function applyMoves(s: CubeState, moves: string[]): void {
  for (const m of moves) {
    try { parseMoveToken(m) } catch (e) { console.warn('bad move', m, e); return }
    applyMoveInPlace(s, m)
  }
}

// --- LBL Step 1: 底层十字（手摆）---

function solveWhiteCrossStep(s: CubeState): string[] {
  // 简化版：找 1 个含白 sticker 的 edge cubie 不在 D 层 → 用 U 转动把它放到顶层正前方 → R 或 L 把它带到 D 层
  // 完整版需要 look-up 8 种 corner cases（白棱在 UF/UB/UL/UR/FL/FR/BL/BR/DL/DR/DF/DB 共 12 个位置）
  // 简化策略：
  //   1. 循环 U 找到 1 个白棱在顶层
  //   2. 决定用 F 或 R（或其他）把它转下去
  //   3. 用 U/D 调整方向让另一面颜色匹配相邻中心
  // 这里实现简化：忽略颜色匹配，只把 4 个白棱都搬到 D 层（颜色匹配交给后续 stage）
  // 实际上：先把 4 个白棱都搬到 D 层（不要求 match center），再 round 2 做颜色匹配

  const moves: string[] = []
  const findWhiteEdgeOnU = (state: CubeState): boolean => {
    const us = stickersFacing(state, 'U')
    for (const s of us) {
      if (s.color !== 'U') continue
      if (Math.abs(Math.abs(s.pos[0]) + Math.abs(s.pos[2]) - 1) < 0.5 && Math.abs(s.pos[1] - 1) < 0.5) {
        return true
      }
    }
    return false
  }
  const findWhiteEdgeOnD = (state: CubeState): number => {
    const ds = stickersFacing(state, 'D')
    let count = 0
    for (const s of ds) {
      if (s.color === 'U' && Math.abs(Math.abs(s.pos[0]) + Math.abs(s.pos[2]) - 1) < 0.5 && Math.abs(s.pos[1] + 1) < 0.5) {
        count++
      }
    }
    return count
  }

  // Round 1: 把所有白棱搬到 D 层（不要求 match）
  for (let i = 0; i < 4; i++) {
    // 找白棱：如果在 D 层 → 跳过（或者用 D' 调整）；如果在 U 层 → 转到 UF → F 把它放下去
    if (findWhiteEdgeOnD(s) >= i + 1) continue  // 已经有 i+1 个白棱在 D 层

    // 找 1 个白棱在 U 层
    if (findWhiteEdgeOnU(s)) {
      // 转动 U 让白棱到 UF 位置
      // 简化：用 U 最多 3 次
      let foundUF = false
      for (let j = 0; j < 4; j++) {
        const us = stickersFacing(s, 'U')
        for (const st of us) {
          if (st.color === 'U' && Math.abs(st.pos[1] - 1) < 0.5 && Math.abs(st.pos[2] - 1) < 0.5) {
            foundUF = true
            break
          }
        }
        if (foundUF) break
        moves.push('U')
        applyMoveInPlace(s, 'U')
      }
      // F 把它放下去
      moves.push('F')
      applyMoveInPlace(s, 'F')
    } else {
      // 白棱在中间层（D 棱已经在 D 层，剩 4 个白棱中的部分还在中层）— 跳过简化（实际 LBL 教学用 F' 把它带上来再 F 放下去）
      // 简化：先转顶层找到，重复 round
      moves.push('U', 'R', "U'", "R'")  // 把中层白棱带上来
      applyMoves(s, ['U', 'R', "U'", "R'"])
    }
  }

  // Round 2: 颜色匹配（简化 - 假设前面已经做完）
  // 实际：检查 D 面 4 个白棱的侧面颜色是否匹配相邻中心
  // 简化：只做 1 轮颜色匹配，失败就 break（用户可能需要手动修）
  return moves
}

// --- LBL Step 2: 底层角块 ---

function solveCornerStep(s: CubeState): string[] {
  // 找 1 个含白 sticker 的角块不在 D 层（且白不在 D 面）
  // 把它搬到 RUF 位置（白朝 R 或 U 或 F）→ 重复 R' D' R D 直到白朝下

  const moves: string[] = []
  // 简化：先看是否有角块需要修
  const ds = stickersFacing(s, 'D')
  const cornersOnD = ds.filter(s => Math.abs(Math.abs(s.pos[0]) - 1) < 0.5 && Math.abs(Math.abs(s.pos[2]) - 1) < 0.5 && Math.abs(s.pos[1] + 1) < 0.5)
  if (cornersOnD.length === 4 && cornersOnD.every(c => c.color === 'U')) {
    return []  // D 面 4 个角都是白，已经完成
  }

  // 找 1 个白角（白不在 D 面）— 用 U 把白角转到 URF 位置（白朝 R 或 U 或 F）
  // 简化：转 U 最多 3 次，把白角放到 URF 位置
  for (let j = 0; j < 4; j++) {
    const us = stickersFacing(s, 'U')
    let targetCorner = false
    for (const st of us) {
      if (st.color === 'U' && Math.abs(st.pos[0] - 1) < 0.5 && Math.abs(st.pos[2] - 1) < 0.5 && Math.abs(st.pos[1] - 1) < 0.5) {
        targetCorner = true
        break
      }
    }
    if (targetCorner) break
    moves.push('U')
    applyMoveInPlace(s, 'U')
  }
  // R' D' R D 重复直到白朝下（最多 5 次）
  for (let j = 0; j < 5; j++) {
    const dFront = stickersFacing(s, 'D').filter(st => Math.abs(st.pos[0] - 1) < 0.5 && Math.abs(st.pos[2] - 1) < 0.5 && Math.abs(st.pos[1] + 1) < 0.5)
    if (dFront.length === 1 && dFront[0].color === 'U') break
    moves.push("R'", "D'", 'R', 'D')
    applyMoves(s, ["R'", "D'", 'R', 'D'])
  }
  return moves
}

// --- LBL Step 3: 中层棱 ---

function solveMiddleEdgeStep(s: CubeState): string[] | null {
  // 找 1 个非白非黄 edge cubie 在 U 层 → 用 U 转到 UF 或 UB → 用 right/left insert
  const us = stickersFacing(s, 'U')
  let foundEdge: { pos: Vec3, color: Face } | null = null
  for (const st of us) {
    if (st.color === 'U' || st.color === 'D') continue  // 跳过白和黄
    if (Math.abs(Math.abs(st.pos[0]) + Math.abs(st.pos[2]) - 1) < 0.5 && Math.abs(st.pos[1] - 1) < 0.5) {
      // edge cubie 在 U 层（not corner）
      foundEdge = st
      break
    }
  }
  if (!foundEdge) return null  // 没找到（顶层只剩黄棱，跳到 Step 4）

  const moves: string[] = []
  // 简化：直接用 right insert
  for (let j = 0; j < 4; j++) {
    // 检查顶层是否还有非白非黄 edge
    const usNow = stickersFacing(s, 'U')
    let hasEdge = false
    for (const st of usNow) {
      if (st.color !== 'U' && st.color !== 'D') {
        if (Math.abs(Math.abs(st.pos[0]) + Math.abs(st.pos[2]) - 1) < 0.5 && Math.abs(st.pos[1] - 1) < 0.5) {
          hasEdge = true
          break
        }
      }
    }
    if (!hasEdge) break
    moves.push(...RIGHT_INSERT)
    applyMoves(s, RIGHT_INSERT)
  }
  return moves
}

// --- LBL Step 4-7: 已知算法循环 ---

function solveTopCross(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 3; i++) {
    if (isTopCross(s)) break
    moves.push(...FRURUF)
    applyMoves(s, FRURUF)
  }
  return moves
}

function solveTopFace(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 12; i++) {
    if (isTopFace(s)) break
    // 简化：用 Sune 一次（不做 Sune/Anti-Sune 选择）
    moves.push(...SUNE)
    applyMoves(s, SUNE)
  }
  return moves
}

function solveCornersPermuted(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 8; i++) {
    if (isCornersPermuted(s)) break
    // 简化：用 T-perm
    moves.push(...T_PERM)
    applyMoves(s, T_PERM)
  }
  return moves
}

function solveLastLayer(s: CubeState): string[] {
  const moves: string[] = []
  for (let i = 0; i < 4; i++) {
    if (isSolved(s)) break
    // 简化：用 U-perm
    moves.push(...U_PERM)
    applyMoves(s, U_PERM)
  }
  return moves
}

// --- 主入口 ---

export interface SolverResult {
  moves: string[]
  stages: Array<{ name: string; moves: string[]; stepCount: number }>
  totalSteps: number
  success: boolean
}

export function solveLBL(state: CubeState): SolverResult {
  const start = performance.now()
  const s = cloneCube(state)
  const stages: SolverResult['stages'] = []

  // Step 1: 底层十字
  const m1 = solveWhiteCrossStep(s)
  stages.push({ name: 'Step 1 底层十字', moves: m1, stepCount: m1.length })
  if (isSolved(s)) return { moves: m1, stages, totalSteps: m1.length, success: true }

  // Step 2: 底层角块
  const m2: string[] = []
  for (let i = 0; i < 5; i++) {
    if (isDAllWhite(s)) break
    const m = solveCornerStep(s)
    if (m.length === 0) break
    m2.push(...m)
  }
  stages.push({ name: 'Step 2 底层角块', moves: m2, stepCount: m2.length })
  if (isSolved(s)) return { moves: [...m1, ...m2], stages, totalSteps: m1.length + m2.length, success: true }

  // Step 3: 中层棱
  const m3 = solveMiddleEdgeStep(s) || []
  stages.push({ name: 'Step 3 中层棱', moves: m3, stepCount: m3.length })
  if (isSolved(s)) return { moves: [...m1, ...m2, ...m3], stages, totalSteps: m1.length + m2.length + m3.length, success: true }

  // Step 4: 顶面十字
  const m4 = solveTopCross(s)
  stages.push({ name: 'Step 4 顶面十字', moves: m4, stepCount: m4.length })

  // Step 5: 顶面定向
  const m5 = solveTopFace(s)
  stages.push({ name: 'Step 5 顶面定向', moves: m5, stepCount: m5.length })

  // Step 6: 顶层角定位
  const m6 = solveCornersPermuted(s)
  stages.push({ name: 'Step 6 顶层角定位', moves: m6, stepCount: m6.length })

  // Step 7: 顶层棱定位
  const m7 = solveLastLayer(s)
  stages.push({ name: 'Step 7 顶层棱定位', moves: m7, stepCount: m7.length })

  const allMoves = [...m1, ...m2, ...m3, ...m4, ...m5, ...m6, ...m7]
  const success = isSolved(s)
  const timeMs = performance.now() - start
  return { moves: allMoves, stages, totalSteps: allMoves.length, success }
}
