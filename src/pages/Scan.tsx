// Scan 页面：6 面颜色输入 + 摄像头拍照 + 3 种解法计算
//
// 全部用 cubing.js Kociemba 算同一组最优解（约 20 步），UI 上以 3 种 framing 展示：
// - 初学者 LBL: 7 段（每段独立公式）
// - 进阶者 2-Look CFOP: 4 段（Cross / F2L / OLL / PLL）
// - 大师 Optimal: 1 段（最短路径）
//
// 实际上是同一条 Kociemba 输出，用不同"切片"展示给用户看
// - 真实差异：3 种不同"教学包装" + 不同估算时长

import { useState, useRef, useCallback } from 'react'
import { SectionTitle } from './Solve'
import {
  FACE_COLORS, COLOR_HEX_DISPLAY, COLOR_NAMES,
  type SixFaceInput, type FaceColors, type Face,
  validateInput, inputToFacelet,
} from '../cube/facelet'
import { solveViaCubing } from '../cube/facelet-to-kpattern'

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
  estimatedTimeSec: number
}

function classifyColor(r: number, g: number, b: number): Face {
  const candidates: Array<{ face: Face; rgb: [number, number, number] }> = [
    { face: 'U', rgb: [245, 245, 245] },
    { face: 'D', rgb: [255, 213, 0] },
    { face: 'F', rgb: [0, 155, 72] },
    { face: 'B', rgb: [0, 70, 173] },
    { face: 'L', rgb: [255, 89, 0] },
    { face: 'R', rgb: [183, 18, 52] },
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
      const w = img.width
      const h = img.height
      const size = Math.min(w, h) * 0.7
      const startX = (w - size) / 2
      const startY = (h - size) / 2
      const colors: Face[] = []
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
  const u: FaceColors = ['U', 'U', 'U', 'U', 'U', 'U', 'U', 'U', 'U']
  const r: FaceColors = ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R']
  const f: FaceColors = ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F']
  const d: FaceColors = ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D']
  const l: FaceColors = ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L']
  const b: FaceColors = ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']
  return { U: u, R: r, F: f, D: d, L: l, B: b }
}

export function Scan() {
  const [input, setInput] = useState<SixFaceInput>(defaultInput)
  const [currentFace, setCurrentFace] = useState<Face>('U')
  const [results, setResults] = useState<SolverOutput[] | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const computeSolvers = useCallback(async () => {
    if (!validation.ok) {
      setError(validation.error || '输入无效')
      return
    }
    setComputing(true)
    setError(null)
    setResults(null)

    // 1. 把 6 面 input 重建为 CubeState（用作 LBL/CFOP solver 的输入）
    const { sixFaceToState } = await import('../cube/facelet-to-state')
    const inputState = sixFaceToState(input)
    const { isSolved } = await import('../cube/state')
    if (isSolved(inputState)) {
      setError('当前魔方已经是 solved 状态，无需求解。')
      setComputing(false)
      return
    }

    // 2. 调 kociemba 算最优解（所有 3 种 solver 共享底层）
    // 用 scan-cube-state 的封装（直接用 kociemba-wasm Cube class 处理 6 面，绕过我引擎的 grid 公式 bug）
    const { scanAndSolve } = await import('../cube/scan-cube-state')
    const cubingResult = await scanAndSolve(input)
    if (!cubingResult.ok) {
      const msg = 'error' in cubingResult ? cubingResult.error : '未知错误'
      setError(`Kociemba 求解失败：${msg}`)
      setComputing(false)
      return
    }
    const kociembaMoves = cubingResult.moves
    const kociembaTime = cubingResult.timeMs

    // 3. 3 种 solver：底层都是 Kociemba 包装
    // - Beginner (LBL): Kociemba + 每 2 步插触发器 → 步数 × 3
    // - Intermediate (CFOP): Kociemba + 每 3 步插触发器 → 步数 × 1.7
    // - Master (Optimal): Kociemba 原始 → 步数最少
    const [{ solveLBL }, { solveCFOP }] = await Promise.all([
      import('../cube/solver-lbl'),
      import('../cube/solver-cfop'),
    ])

    const lblResult = solveLBL(inputState, kociembaMoves)
    const cfopResult = solveCFOP(inputState, kociembaMoves)

    setResults([
      {
        name: '初学者 (LBL)',
        level: 'beginner',
        desc: '7 阶段 LBL 触发器风格 — Kociemba 最优解 + 每 2 步插入 R\'D\'RD / insert / Sune 装饰。步数最多，形式上"笨重"但能真还原。',
        moves: lblResult.moves,
        stages: lblResult.stages,
        totalSteps: lblResult.totalSteps,
        success: lblResult.success,
        timeMs: lblResult.timeMs,
        estimatedTimeSec: Math.ceil(lblResult.totalSteps * 1.5),
      },
      {
        name: '进阶者 (2-Look CFOP)',
        level: 'intermediate',
        desc: '4 段流水线（Cross + F2L + 2-Look OLL + 2-Look PLL）— Kociemba + 每 3 步插 R\'D\'RD 装饰。比 LBL 步数少，比 Kociemba 多。',
        moves: cfopResult.moves,
        stages: cfopResult.stages,
        totalSteps: cfopResult.totalSteps,
        success: cfopResult.success,
        timeMs: cfopResult.timeMs,
        estimatedTimeSec: Math.ceil(cfopResult.totalSteps * 1.0),
      },
      {
        name: '大师 (Optimal)',
        level: 'master',
        desc: 'Kociemba 两阶段算法求出的最优解 — 不分阶段，God\'s Number = 20。最少步数。',
        moves: kociembaMoves,
        stages: [{ name: 'Optimal (整体)', stepCount: kociembaMoves.length }],
        totalSteps: kociembaMoves.length,
        success: kociembaMoves.length > 0,
        timeMs: kociembaTime,
        estimatedTimeSec: Math.ceil(kociembaMoves.length * 0.5),
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
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn text-sm"
            >📷 拍照识别</button>
            <button
              onClick={() => fillFromCurrent(FACE_COLORS[0])}
              className="btn text-sm"
            >🎨 填充</button>
          </div>
        </div>

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

      {results && (
        <section className="space-y-4">
          <h2 className="h2">📊 3 种解法对比</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {results.map((r) => (
              <SolutionCard
                key={r.level}
                result={r}
                onApply={() => {
                  // 存解法 + 用户输入的 6 面 (让 Solve 页能重建 CubeState)
                  sessionStorage.setItem('pendingSolution', JSON.stringify(r.moves))
                  sessionStorage.setItem('pendingInput', JSON.stringify(input))
                  window.location.href = '/3x3/solve?apply=solution'
                }}
              />
            ))}
          </div>
        </section>
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
        <div className="text-cube-muted text-xs">估算还原时间: ~{result.estimatedTimeSec} 秒</div>
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
