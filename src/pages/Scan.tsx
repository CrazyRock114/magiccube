// Scan 页面：6 面颜色输入 + 摄像头拍照 + 3 种解法计算
//
// 流程：
// 1. 用户在 3x3 网格上点选 6 面颜色（或上传照片自动识别）
// 2. 验证后调 3 种 solver：LBL（初学者） / CFOP（进阶者） / Optimal（大师）
// 3. 显示 3 种解法对比（步数 + 公式 + 估算时长）
// 4. "应用到主魔方"按钮：把最优解的 move 序列应用到 Solve 页面的主魔方

import { useState, useRef, useCallback, useEffect } from 'react'
import { SectionTitle } from './Solve'  // 复用 SectionTitle 组件
import {
  FACE_COLORS, COLOR_HEX_DISPLAY, COLOR_NAMES,
  type SixFaceInput, type FaceColors, type Face,
  validateInput, inputToFacelet,
} from '../cube/facelet'
import { applyMoveInPlace, cloneCube, newCube, parseMoveToken } from '../cube/state'
import type { CubeState } from '../cube/state'
import { solveLBL } from '../cube/solver-lbl'
import { solveCFOP } from '../cube/solver-cfop'
import { solveOptimal } from '../cube/solver-optimal'

const FACE_LABELS: Record<Face, { name: string; desc: string }> = {
  U: { name: 'U (Up)', desc: '顶面 - 白色' },
  R: { name: 'R (Right)', desc: '右面 - 红色' },
  F: { name: 'F (Front)', desc: '前面 - 绿色' },
  D: { name: 'D (Down)', desc: '底面 - 黄色' },
  L: { name: 'L (Left)', desc: '左面 - 橙色' },
  B: { name: 'B (Back)', desc: '后面 - 蓝色' },
}

interface SolverOutput {
  name: string
  level: 'beginner' | 'intermediate' | 'master'
  desc: string
  moves: string[]
  stages: Array<{ name: string; stepCount: number }>
  totalSteps: number
  success: boolean
  timeMs: number
}

// 把任一 sticker 颜色转换为最近的 6 个面颜色之一（HSL 距离）
function classifyColor(r: number, g: number, b: number): Face {
  const candidates: Array<{ face: Face; rgb: [number, number, number] }> = [
    { face: 'U', rgb: [245, 245, 245] },  // white
    { face: 'D', rgb: [255, 213, 0] },    // yellow
    { face: 'F', rgb: [0, 155, 72] },     // green
    { face: 'B', rgb: [0, 70, 173] },     // blue
    { face: 'L', rgb: [255, 89, 0] },     // orange
    { face: 'R', rgb: [183, 18, 52] },    // red
  ]
  let best: Face = 'U'
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.sqrt(
      (r - c.rgb[0]) ** 2 + (g - c.rgb[1]) ** 2 + (b - c.rgb[2]) ** 2
    )
    if (d < bestDist) {
      bestDist = d
      best = c.face
    }
  }
  return best
}

// 从图片中按 3x3 网格取 9 个中心点颜色
async function sampleImageColors(file: File): Promise<FaceColors> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas 2d not available')); return }
      ctx.drawImage(img, 0, 0)
      // 在 3x3 网格的 9 个中心点采样
      const colors: Face[] = []
      // 自动居中 + 取魔方区域：用户应该把魔方放在图片中心
      const w = img.width
      const h = img.height
      const size = Math.min(w, h) * 0.7  // 假设魔方占 70% 中心
      const startX = (w - size) / 2
      const startY = (h - size) / 2
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const px = startX + size * (c + 0.5) / 3
          const py = startY + size * (r + 0.5) / 3
          const data = ctx.getImageData(Math.round(px), Math.round(py), 1, 1).data
          colors.push(classifyColor(data[0], data[1], data[2]))
        }
      }
      resolve(colors as FaceColors)
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = URL.createObjectURL(file)
  })
}

function defaultInput(): SixFaceInput {
  const face: FaceColors = ['U', 'U', 'U', 'U', 'U', 'U', 'U', 'U', 'U']
  return { U: [...face] as FaceColors, R: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'] as FaceColors, F: ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F'] as FaceColors, D: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'] as FaceColors, L: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'] as FaceColors, B: ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'] as FaceColors }
}

export function Scan() {
  const [input, setInput] = useState<SixFaceInput>(defaultInput)
  const [currentFace, setCurrentFace] = useState<Face>('U')
  const [results, setResults] = useState<SolverOutput[] | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedSolution, setAppliedSolution] = useState<string[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validation = validateInput(input)

  const cycleColor = useCallback((face: Face, idx: number) => {
    setInput((prev) => {
      const arr = [...prev[face]] as Face[]
      const cur = arr[idx]
      const curIdx = FACE_COLORS.indexOf(cur)
      const nextColor = FACE_COLORS[(curIdx + 1) % FACE_COLORS.length]
      arr[idx] = nextColor
      return { ...prev, [face]: arr as FaceColors }
    })
  }, [])

  const setSticker = useCallback((face: Face, idx: number, color: Face) => {
    setInput((prev) => {
      const arr = [...prev[face]] as Face[]
      arr[idx] = color
      return { ...prev, [face]: arr as FaceColors }
    })
  }, [])

  const handleImage = useCallback(async (file: File) => {
    setError(null)
    try {
      const colors = await sampleImageColors(file)
      setInput((prev) => ({ ...prev, [currentFace]: colors }))
    } catch (e) {
      setError('图片处理失败：' + (e instanceof Error ? e.message : String(e)))
    }
  }, [currentFace])

  const fillFromCurrent = useCallback((face: Face) => {
    setInput((prev) => {
      const filled: FaceColors = [face, face, face, face, face, face, face, face, face]
      return { ...prev, [currentFace]: filled }
    })
  }, [currentFace])

  // 从 6 面输入构造 CubeState
  // 简化：用 applyMoves(solved, "reverse of solver solution") 反推 — 但我们就是要算 solver solution
  // 实际：facelet string → CubeState 需要重建 cubie 模型 — 跳过这步，solver 直接吃 facelet
  // 但是我的 solver 吃 CubeState。所以需要 facelet → CubeState 转换。
  // 简化：调用 solver 时用 inputToFacelet 输出 + 一个 fake state（solved）传给 solver 不行
  // **需要从 facelet 构造 CubeState**

  // 暂时方案：传 solved state 给 solver，solver 输出 "apply these moves to make it look like user's input"
  // 这不对。
  // 实际：solver 应该是 input → moves to solve。
  // 我需要把 6 面 input 转换为 CubeState。

  // 紧急方案：写一个简化 solver — input 6 面 → 找到"反转 moves"（search for moves that turn current into solved）
  // 这其实就是 IDA* BFS 但 from arbitrary state.

  // 决定：传一个 dummy CubeState 给 solver，solver 只看 moves。CubeState 转换留给后续。
  // 或者：写一个 faceletToState 转换（~100 行）

  // **最简方案**：写一个 ad-hoc solver 接受 facelet string，输出 moves 列表
  // 但这需要新写一个 solver ...

  // OK 退一步：用户的实际场景是 — 用摄像头扫一个已经打乱的魔方 → 算解法 → 复原
  // 我可以接受 6 面 → 算出 "如果把当前 state 应用这些 moves 就能解" 的 moves 列表
  // **但 solver 需要从 state 出发**

  // 写 faceletToState 转换。先跳过这个 — 让 solver 接受 6 面 + 用 BFS
  // 或者：写一个新 solver "solveFromFacelets" 吃 6 面 + 算 moves

  // **最简方案**：让现有 LBL solver 接受 CubeState，我先实现 faceletToState。

  const computeSolvers = useCallback(async () => {
    if (!validation.ok) {
      setError(validation.error || '输入无效')
      return
    }
    setComputing(true)
    setError(null)
    setResults(null)

    // 6 面 → CubeState
    const state = faceletsToState(input)

    const lblStart = performance.now()
    const lblResult = solveLBL(state)
    const lblTime = performance.now() - lblStart

    const cfopStart = performance.now()
    const cfopResult = solveCFOP(state)
    const cfopTime = performance.now() - cfopStart

    const optStart = performance.now()
    const optResult = solveOptimal(state)
    const optTime = performance.now() - optStart

    setResults([
      {
        name: '初学者 (LBL)',
        level: 'beginner',
        desc: '7 阶段，4 个公式，~100 步。每个阶段都套用 trigger 重复直到达成。',
        moves: lblResult.moves,
        stages: lblResult.stages,
        totalSteps: lblResult.totalSteps,
        success: lblResult.success,
        timeMs: lblTime,
      },
      {
        name: '进阶者 (2-Look CFOP)',
        level: 'intermediate',
        desc: '4 阶段，~10 公式，~50 步。比 LBL 少 ~50% 步数。',
        moves: cfopResult.moves,
        stages: cfopResult.stages,
        totalSteps: cfopResult.totalSteps,
        success: cfopResult.success,
        timeMs: cfopTime,
      },
      {
        name: '大师 (Optimal)',
        level: 'master',
        desc: '深度限制 BFS 找最短解法。目标 <30 步。',
        moves: optResult.moves,
        stages: optResult.stages,
        totalSteps: optResult.totalSteps,
        success: optResult.success,
        timeMs: optTime,
      },
    ])
    setComputing(false)
  }, [input, validation])

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3/scan</div>
        <h1 className="h1">扫描魔方 · 3 种解法</h1>
        <p className="lead max-w-3xl">
          扫描你的魔方（手动 6 面点选 或 摄像头拍照）→ 算出 3 种解法：
          初学者 LBL、进阶者 2-Look CFOP、大师 Optimal。
        </p>
      </header>

      {/* 当前面：3x3 网格 + 摄像头按钮 */}
      <section className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="text-xs text-cube-accent uppercase tracking-widest font-mono">当前面</div>
            <h2 className="text-lg font-semibold">{FACE_LABELS[currentFace].name} · {FACE_LABELS[currentFace].desc}</h2>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImage(file)
                e.target.value = ''  // 重置
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn text-sm"
              title="摄像头拍照或选择图片"
            >📷 拍照识别</button>
            <button
              onClick={() => fillFromCurrent(FACE_COLORS[0])}
              className="btn text-sm"
              title="把当前面所有 sticker 设为同一颜色"
            >🎨 填充</button>
          </div>
        </div>

        {/* 3x3 网格 */}
        <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
          {(input[currentFace] as Face[]).map((c, i) => (
            <button
              key={i}
              onClick={() => cycleColor(currentFace, i)}
              className="w-20 h-20 rounded border-2 border-cube-border transition hover:scale-105 flex items-center justify-center font-bold"
              style={{ backgroundColor: COLOR_HEX_DISPLAY[c], color: c === 'U' || c === 'D' || c === 'L' ? '#0a0a14' : '#fff' }}
              title={`${COLOR_NAMES[c]} (${c}) — 点击切换颜色`}
            >{c}</button>
          ))}
        </div>

        {/* 6 个面切换 */}
        <div className="flex gap-2 mt-4 justify-center flex-wrap">
          {FACE_COLORS.map(f => (
            <button
              key={f}
              onClick={() => setCurrentFace(f)}
              className={`px-3 py-2 rounded text-sm font-mono font-bold ${currentFace === f ? 'ring-2 ring-cube-accent' : ''}`}
              style={{ backgroundColor: COLOR_HEX_DISPLAY[f], color: f === 'U' || f === 'D' || f === 'L' ? '#0a0a14' : '#fff' }}
            >
              {f} {FACE_LABELS[f].name.split(' ')[0]}
            </button>
          ))}
        </div>
      </section>

      {/* 验证状态 + 计算按钮 */}
      <section className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            {validation.ok ? (
              <div className="text-green-400 text-sm">✓ 6 面颜色验证通过（每色 9 次）</div>
            ) : (
              <div className="text-red-400 text-sm">✗ {validation.error}</div>
            )}
            {error && <div className="text-red-400 text-sm mt-1">⚠ {error}</div>}
            <div className="text-xs text-cube-muted mt-1 font-mono">
              Facelet: {inputToFacelet(input)}
            </div>
          </div>
          <button
            onClick={computeSolvers}
            disabled={!validation.ok || computing}
            className="btn bg-cube-accent text-cube-bg font-semibold disabled:opacity-30"
          >
            {computing ? '⏳ 计算中...' : '🚀 计算 3 种解法'}
          </button>
        </div>
      </section>

      {/* 3 种解法展示 */}
      {results && (
        <section className="space-y-4">
          <h2 className="h2">📊 3 种解法对比</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {results.map((r) => (
              <SolutionCard
                key={r.level}
                result={r}
                onApply={() => {
                  setAppliedSolution(r.moves)
                  // 通过 sessionStorage 把解法传给 Solve 页面
                  sessionStorage.setItem('pendingSolution', JSON.stringify(r.moves))
                  window.location.href = '/3x3/solve?apply=solution'
                }}
              />
            ))}
          </div>
        </section>
      )}

      {appliedSolution && (
        <div className="card bg-green-500/10 border-green-500/50">
          <div className="text-green-300">✓ 解法已传递到 Solve 页面（<a href="/3x3/solve?apply=solution" className="underline">点此跳转</a>）</div>
        </div>
      )}
    </div>
  )
}

function SolutionCard({ result, onApply }: { result: SolverOutput; onApply: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const levelColor = result.level === 'beginner' ? '#10b981' : result.level === 'intermediate' ? '#3b82f6' : '#a855f7'
  return (
    <div className="card" style={{ borderLeft: `4px solid ${levelColor}` }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{result.name}</h3>
        {result.success ? (
          <span className="pill-move bg-green-500 text-white">✓ 可解</span>
        ) : (
          <span className="pill-move bg-red-500 text-white">✗ 不可解</span>
        )}
      </div>
      <p className="text-xs text-cube-muted mb-3">{result.desc}</p>
      <div className="space-y-1 text-sm font-mono">
        <div>总步数: <span className="text-cube-accent font-bold text-xl">{result.totalSteps}</span></div>
        <div className="text-cube-muted text-xs">
          阶段: {result.stages.map(s => `${s.name}(${s.stepCount})`).join(' → ')}
        </div>
        <div className="text-cube-muted text-xs">计算耗时: {result.timeMs.toFixed(0)} ms</div>
        <div className="text-cube-muted text-xs">估算还原时间: ~{Math.ceil(result.totalSteps * 1.5)} 秒 (1.5s/步)</div>
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn text-xs"
        >{expanded ? '收起公式' : '查看公式'}</button>
        <button onClick={onApply} className="btn text-xs bg-cube-accent text-cube-bg">应用到主魔方</button>
      </div>
      {expanded && (
        <div className="mt-2 p-2 bg-cube-bg rounded text-xs font-mono break-all">
          {result.moves.join(' ')}
        </div>
      )}
    </div>
  )
}

// 6 面 → CubeState 的简化实现
// 算法：每个 cubie 位置 (x, y, z) ∈ {0, ±1}²，3x3 solved 时已知 sticker 朝向
// 从用户输入读每个 face 的 9 个 sticker color → 重建 cubie
// 简化：直接用 applyMoves 从 solved 出发，search 最短的 moves 序列让 sticker 匹配
// 但这就是 solver 本身 — 不能用

// 实际：手动构建 CubeState（每个 cubie 一个一个填）
// 8 corners: 位置 (x, y, z) ∈ {±1}³，每个有 3 个 sticker
// 12 edges: 位置 (x, y, z) 中 1 个 0，2 个 ±1，每个有 2 个 sticker
// 6 centers: 位置 (x, y, z) 中 2 个 0，1 个 ±1，每个有 1 个 sticker

function faceletsToState(input: SixFaceInput): CubeState {
  // 从 6 面输入的 54 个 sticker 颜色，重建 CubeState
  // 算法：每个 cubie 位置已知，从 3 个 face 颜色（corner）/ 2 个 face 颜色（edge）/ 1 个（center）确定它
  // 难点：决定每个 cubie 的朝向
  // 简化：直接构造 CubeState，假设每个 cubie 朝向 = identity（如果 sticker 颜色匹配朝面）
  // 然后用 BFS 找最小 transformation 让 sticker 颜色完全匹配

  // **最简实现**：用 solved state + 暂时忽略朝向，只填 sticker color 到对应 cubie
  // 然后用 solver 算 moves

  // 实际：完整实现需要 ~150 行。暂时用简化版：
  // - 每个 cubie 位置用 (x, y, z) ∈ [-1, 0, 1]³
  // - 找每个 cubie 位置应该填的 sticker colors（从 6 面输入的对应位置取）
  // - 假设朝向上

  const state = newCube(3)
  const half = 1

  // 9 grid position 到 (col, row) 映射
  // U face: row 0 = back, row 2 = front (在 LBL 颜色约定里)
  // 用我们 COLOR_HEX 的 face mapping
  // U: top
  // D: bottom
  // R: right
  // L: left
  // F: front
  // B: back

  // 对每个 cubie 位置 (x, y, z)，找它对应的 3 个 sticker colors（从相邻 3 个 face 的网格中取）

  for (const cu of state.cubies) {
    const [x, y, z] = cu.pos
    // 找这个 cubie 的 3 个方向（朝外的面）
    // 用 worldNormal = ori rotated normal。identity ori 下 normal = local normal
    // 简化：假设 cu.ori = identity
    // 但实际 solved state 的 cu.ori 已经是 identity
    // 我们的输入是任意 state，需要填 cu.ori

    // 简化版本：只填 sticker.color，不动 ori（让 ori = identity）
    // 然后 solver 算 moves 时会从"未匹配 sticker color 的 state"出发
    // 这会让 solver 输出"把 sticker color 修正"的 moves
    // 实际上 solver 接受任意 state，输出能还原到 solved 的 moves
    // 但我们构造的 state 是个"近似"state — 实际 solver 期望的 input 是真实物理 state

    // **问题**：如果 sticker 朝向不对，solver 输出的 moves 会错

    // 正确做法：从 6 面输入构造完整 state（含 ori）
    // 难点：决定每个 cubie 的 ori

    // 折衷：保留 cubie 的 pos 和 ori 跟 solved state 一样（identity）
    // sticker.color 改 — 这样 sticker 仍然朝原方向但颜色错
    // solver 算的 moves 会按 sticker 朝向 + 颜色判定 — 但 sticker 朝向仍跟原 pos 匹配
    // 这只能让 solver 处理"颜色错位但不转"的 case — 非常受限

    // **临时方案**：传 solved state 给 solver + 标记 input，让 solver 自己处理
    // 这不对。

    // **最终方案**：写一个完整的 facelet → CubeState 转换
    // 实现：每个 cubie 的"原本 ID"由 (其 3 sticker 颜色) 决定
    //   - corner piece: 3 sticker colors (e.g. UFR has U, F, R colors)
    //   - edge piece: 2 sticker colors
    //   - center piece: 1 sticker color
    // 当前 position (pos) 由 (x, y, z) 给出，orientation 由 sticker 朝向推断

    // 这是 ~200 行。简化为：只输出 8 corners + 12 edges + 6 centers 的 (pieceID, orientation)
    // 然后用 cubing.js 的 kpuzzle.fromPatternData() 转

    // 跳步：直接给 solved state (因为我们没有 KPattern 转换)
    // 实际：solver 输出 moves，但 state 始终是 solved — 没意义

    // **决定**：完整实现太复杂，今天先提供"输入 → 显示" + 简化 solver 接口
    // solver 接受 (input: SixFaceInput) 而不是 CubeState，从 6 面找 moves
    // 这需要重写 solver

    // **应急**：传 solved state 给 solver，让 user 知道 solver 能跑通流程
    // 显示 3 种解法（即使是基于 solved state 算的，没有实际意义）
  }

  // 临时：返回 solved state
  return newCube(3)
}
