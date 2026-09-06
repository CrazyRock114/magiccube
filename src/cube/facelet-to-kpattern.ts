// 6 面颜色输入 → kociemba-wasm 求解
//
// 算法：
// 1. 6 面颜色 → 54 字符 facelet string (U R F D L B 顺序)
// 2. 调 kociemba-wasm (Emscripten WebAssembly) 算最优解
// 3. 返回 solution string 数组
//
// 优势：比 cubing.js 轻量（580KB vs 1MB+），且不会在 import 阶段触发浏览器 API
// 关键：调用 solve() 之前先 await init()，否则 WASM 模块未初始化

import type { Face, CubeState } from './state'
import type { FaceColors, SixFaceInput } from './facelet'

// kociemba-wasm 是 CommonJS 包，**绝对不要**顶层 import — Emscripten runtime 在 Node 端加载会触发浏览器 API 引用
// 用 dynamic import，只在用户点"计算"时才加载

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

let kociembaModule: any = null
let initPromise: Promise<void> | null = null
async function ensureKociembaLoaded() {
  if (!kociembaModule) {
    kociembaModule = await import('kociemba-wasm')
  }
  if (!initPromise) {
    const result = kociembaModule.init()
    if (result && typeof result.then === 'function') {
      initPromise = result.then(() => {})
    } else {
      initPromise = Promise.resolve()
    }
  }
  return initPromise
}

export async function solveViaCubing(input: SixFaceInput): Promise<SolverOutcome> {
  const startTime = performance.now()
  try {
    // 1. 验证 + 转 54 字符
    const colorCounts: Record<Face, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 }
    const faces: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']
    for (const f of faces) {
      for (const c of input[f]) colorCounts[c]++
    }
    for (const f of faces) {
      if (colorCounts[f] !== 9) {
        return { ok: false, error: `颜色 ${f} 出现 ${colorCounts[f]} 次（应该是 9 次）` }
      }
    }
    const facelet = faces.map(f => input[f].join('')).join('')
    if (facelet.length !== 54) {
      return { ok: false, error: `facelet 字符串长度 ${facelet.length}（应该是 54）` }
    }

    // 2. 初始化 WASM（lazy, dynamic import）
    await ensureKociembaLoaded()

    // 3. 求解
    const solveFn = kociembaModule.solve as (m: string) => Promise<string>
    const solutionStr = await solveFn(facelet)
    const trimmed = solutionStr.trim()
    if (!trimmed) {
      return { ok: false, error: 'Kociemba 返回空解法 — 此状态不是合法魔方（颜色组合可能不物理可达）。请检查 6 面输入。' }
    }
    const moves = trimmed.split(/\s+/).filter(Boolean)
    if (moves.length === 0) {
      return { ok: false, error: '解法包含 0 步 — 状态已经是 solved 或不合法。' }
    }

    return { ok: true, moves, timeMs: performance.now() - startTime }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
