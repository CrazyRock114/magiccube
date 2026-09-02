// 异形魔方：Skewb / Pyraminx / Megaminx 的可交互 3D 教学
// 3D 渲染用 cubing.js 的 TwistyPlayer，自带 state engine + 动画
// 三个 section 共享 <PuzzleCard> 组件，避免代码重复

import { useEffect, useRef, useState, useMemo } from 'react'
// @ts-ignore - cubing.js 没有官方 TS 类型声明 for 3rd party use
import { TwistyPlayer } from 'cubing/twisty'

// ==================== 各 puzzle 的 move 集 + 元数据 ====================

type PuzzleSpec = {
  id: 'skewb' | 'pyraminx' | 'megaminx'
  name: string
  cn: string
  size: string
  pieces: string
  states: string
  moves: { token: string; label?: string }[]
  scrambleMoves: string[]
  desc: string
  facts: string[]
  solveHint: string
  godNumber: string
  bgColor: string
}

const SKEWB: PuzzleSpec = {
  id: 'skewb',
  name: 'Skewb',
  cn: '斜转魔方',
  size: '~6cm',
  pieces: '8 角块（无中心/棱块）',
  states: '3.15 × 10⁷',
  godNumber: '11',
  desc: '一个轴上切两刀，所有转动都让 4 个角块绕对角线 120° 旋转。比 2×2 还简单 — 没有棱块，没有中心。',
  facts: [
    '每个转动影响 4 个角块（4-cycle 旋转 120°）',
    '没有棱块和中心，是最简单的"贴纸魔方"',
    '"skew" + "cube"，几何不规则但解法很优雅',
    '解法：先找白/黄顶 → 块对齐 → 类比 CFOP 但只有 4 个面',
  ],
  moves: [
    { token: 'R', label: 'R' }, { token: "R'", label: "R'" },
    { token: 'U', label: 'U' }, { token: "U'", label: "U'" },
    { token: 'L', label: 'L' }, { token: "L'", label: "L'" },
    { token: 'B', label: 'B' }, { token: "B'", label: "B'" },
  ],
  scrambleMoves: ['R', 'R\'', 'U', 'U\'', 'L', 'L\'', 'B', 'B\''],
  solveHint: 'Skewb 的解法核心：归位角块 + 调方向。L R\' L\' R 是经典 3-cycle。',
  bgColor: '#7c5cff',
}

const PYRAMINX: PuzzleSpec = {
  id: 'pyraminx',
  name: 'Pyraminx',
  cn: '金字塔魔方',
  size: '~10cm',
  pieces: '4 tip + 6 edge + 4 center = 14',
  states: '9.33 × 10⁵',
  godNumber: '11',
  desc: '四面体形状，每个面是三角形。4 个 tip（角尖）+ 6 个 edge（边块）+ 4 个 center（面中心）共 14 个可动块。',
  facts: [
    '4 个 tip 独立旋转（tetrahedral 对称性，互不影响）',
    '6 个 edge 有 "tip-up / tip-down" 两种状态',
    '4 个角永远能解（3 个调好后第 4 个自然到位）',
    '解法：先归位 4 个角 → 再调 6 个 edge 朝向',
  ],
  moves: [
    { token: 'R', label: 'R' }, { token: "R'", label: "R'" },
    { token: 'L', label: 'L' }, { token: "L'", label: "L'" },
    { token: 'U', label: 'U' }, { token: "U'", label: "U'" },
    { token: 'B', label: 'B' }, { token: "B'", label: "B'" },
  ],
  scrambleMoves: ['R', 'R\'', 'L', 'L\'', 'U', 'U\'', 'B', 'B\''],
  solveHint: 'Pyraminx 永远能解 — 没有奇偶性约束，4 个角的 3-cycle 自动消解。',
  bgColor: '#009b48',
}

const MEGAMINX: PuzzleSpec = {
  id: 'megaminx',
  name: 'Megaminx',
  cn: '五魔方',
  size: '~10cm',
  pieces: '20 角 + 30 边 + 12 中心',
  states: '~10⁶³',
  godNumber: '~50+',
  desc: '12 面体魔方（dodecahedron），每面是五边形。本质是 3×3 的"放大版" — 但因为 5 倍对称，OLL/PLL 算法各有 ~5 倍。',
  facts: [
    '20 个角（每个 3 个 sticker，3 个方向 120°）',
    '30 个边（5 × 6 = 30）',
    '没有 parity 限制（角/棱置换 + 方向约束自动满足）',
    '5 倍的 CFOP 算法量，是 3×3 进阶的下一个目标',
  ],
  moves: [
    { token: 'R++', label: 'R↻' }, { token: 'R--', label: 'R↺' },
    { token: 'D++', label: 'D↻' }, { token: 'D--', label: 'D↺' },
    { token: 'U', label: 'U' }, { token: "U'", label: "U'" },
    { token: 'F++', label: 'F↻' }, { token: 'F--', label: 'F↺' },
    { token: 'L++', label: 'L↻' }, { token: 'L--', label: 'L↺' },
  ],
  scrambleMoves: ['R++', 'D++', 'U', 'F++', 'L++', 'R--', 'D--', "U'", 'F--', 'L--'],
  solveHint: 'Megaminx 解法和 3×3 类似，但因为 5 倍对称，OLL/PLL 数量更多。先学 3×3 再挑战。',
  bgColor: '#b71234',
}

const PUZZLES = [SKEWB, PYRAMINX, MEGAMINX]

// ==================== 生成 scramble 公式 ====================

function randomScramble(moves: string[], len = 12): string {
  const result: string[] = []
  let lastBase = ''
  for (let i = 0; i < len; i++) {
    const m = moves[Math.floor(Math.random() * moves.length)]
    // 简单防连续同面
    const base = m.replace(/[+\-']/g, '').replace(/2/g, '')
    if (base === lastBase) { i--; continue }
    result.push(m)
    lastBase = base
  }
  return result.join(' ')
}

// ==================== PuzzleCard：单个 puzzle 的可交互卡片 ====================

function PuzzleCard({ spec }: { spec: PuzzleSpec }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [alg, setAlg] = useState('')

  // 初始化 TwistyPlayer
  useEffect(() => {
    if (!containerRef.current) return
    const player = new (TwistyPlayer as any)({
      puzzle: spec.id,
      alg,
      background: 'none',
      controlPanel: 'none',
      tempoScale: 0.8,
    })
    containerRef.current.appendChild(player)
    playerRef.current = player
    return () => { player.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id])

  // alg 变化时更新
  useEffect(() => {
    if (playerRef.current) {
      try { playerRef.current.alg = alg } catch (e) { /* 第一次 set 时可能还没 ready */ }
    }
  }, [alg])

  const doMove = (m: string) => {
    setAlg(prev => prev ? prev + ' ' + m : m)
  }
  const undoLast = () => {
    setAlg(prev => {
      const parts = prev.trim().split(/\s+/)
      parts.pop()
      return parts.join(' ')
    })
  }
  const reset = () => setAlg('')
  const scramble = () => setAlg(randomScramble(spec.scrambleMoves))

  return (
    <section className="card">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h2 className="h2" style={{ color: spec.bgColor }}>{spec.name}</h2>
          <div className="text-sm text-cube-muted">{spec.cn}</div>
        </div>
        <div className="text-right text-xs text-cube-muted font-mono space-y-0.5">
          <div>{spec.size} · {spec.pieces}</div>
          <div className="text-cube-accent">{spec.states} 状态</div>
          <div>God Number ≈ {spec.godNumber}</div>
        </div>
      </div>

      <p className="text-cube-text/90 leading-relaxed mb-4 text-sm">{spec.desc}</p>

      <div className="grid lg:grid-cols-[420px_1fr] gap-4">
        {/* 3D 渲染区 */}
        <div className="space-y-2">
          <div
            ref={containerRef}
            className="rounded border border-cube-border bg-cube-bg/50 overflow-hidden"
            style={{ width: '100%', aspectRatio: '1' }}
          />
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-cube-muted font-mono mr-1">操作：</span>
            {spec.moves.map(m => (
              <button
                key={m.token}
                onClick={() => doMove(m.token)}
                className="px-2 py-1 rounded text-xs font-mono font-bold border border-cube-border hover:border-cube-accent hover:text-cube-accent transition-colors"
                title={m.token}
              >{m.label || m.token}</button>
            ))}
            <button
              onClick={undoLast}
              disabled={!alg}
              className="ml-1 px-2 py-1 rounded text-xs text-cube-muted hover:text-cube-text border border-cube-border disabled:opacity-30"
            >↶ 撤销</button>
            <button
              onClick={reset}
              disabled={!alg}
              className="px-2 py-1 rounded text-xs text-cube-muted hover:text-cube-text border border-cube-border disabled:opacity-30"
            >↺ 重置</button>
            <button
              onClick={scramble}
              className="ml-auto px-2 py-1 rounded text-xs font-mono font-semibold text-white transition-colors"
              style={{ background: spec.bgColor }}
            >🎲 打乱</button>
          </div>
        </div>

        {/* 文字说明 */}
        <div className="space-y-3">
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">当前公式</div>
            <div className="bg-cube-bg border border-cube-border rounded px-3 py-2 font-mono text-sm text-cube-text break-all min-h-[2em]">
              {alg || <span className="text-cube-muted/50">（已复原 — 点上面按钮或 🎲 打乱）</span>}
            </div>
            <div className="text-[10px] text-cube-muted/70 mt-1 font-mono">
              {alg ? `${alg.trim().split(/\s+/).length} 步` : '0 步'}
            </div>
          </div>

          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">特征</div>
            <ul className="space-y-1 text-cube-text/90 ml-5 list-disc leading-relaxed text-sm">
              {spec.facts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>

          <div className="border-l-2 pl-3 text-xs text-cube-muted leading-relaxed" style={{ borderColor: spec.bgColor }}>
            💡 <span className="text-cube-text/80">解法提示：</span>{spec.solveHint}
          </div>
        </div>
      </div>
    </section>
  )
}

// ==================== 速查表 ====================

function MoreShapes() {
  return (
    <section className="card">
      <h2 className="h3 mb-3">更多异形（速览）</h2>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
          <div className="font-semibold mb-1">Square-1 (SQ-1)</div>
          <div className="text-xs text-cube-muted">形状能变形（方↔非方），CFOP 不直接适用。有 parity 问题。</div>
        </div>
        <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
          <div className="font-semibold mb-1">Clock 齿轮钟</div>
          <div className="text-xs text-cube-muted">WCA 项目。所有转动是 4 个拨针 + 4 个按钮，状态空间很大。</div>
        </div>
        <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
          <div className="font-semibold mb-1">Floppy Cube (1×3)</div>
          <div className="text-xs text-cube-muted">最简单异形，6 个状态。</div>
        </div>
        <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
          <div className="font-semibold mb-1">5×5, 6×6, 7×7 (专家)</div>
          <div className="text-xs text-cube-muted">同 4×4 思路，更多 parity 情况。</div>
        </div>
      </div>
    </section>
  )
}

// ==================== Main ====================

export function OtherShapes() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/shapes</div>
        <h1 className="h1">异形魔方</h1>
        <p className="lead max-w-3xl">
          标准 3×3 之外的几何变化无穷无尽。这里用 <span className="text-cube-accent font-mono">cubing.js</span> 渲染三种最常见的异形 —
          拖动 3D 视图、点按钮应用单个 move、🎲 打乱看解法。每种 puzzle 的几何、状态数、God Number 都标在右上。
        </p>
        <p className="text-cube-muted text-sm leading-relaxed">
          渲染用的是 <code className="font-mono text-cube-text">cubing/twisty</code> 库（js.cubing.net）— 它内置了所有 WCA 异形的状态引擎、动画和 stickering，所以我们可以专注于"教什么"而不是"怎么画"。
        </p>
      </header>

      {PUZZLES.map(p => <PuzzleCard key={p.id} spec={p} />)}

      <MoreShapes />
    </div>
  )
}
