// 图论与群论视角的魔方教学
// 设计：6 章节渐进式，每章 = 1 概念 + 1 互动 demo + 1 关键洞察
//   1. 什么是"魔方状态"     3D 魔方 + sticker string 实时联动
//   2. 状态空间有多大         2x2/3x3/4x4 规模对比 + BFS 层级计数
//   3. Cayley 图             拖拽 / hover / 边按 move 着色 / 点击看 3D
//   4. 最短路 / God Number   BFS 找路动画 + 距离的群论含义
//   5. 群论直觉             换位子 [A,B] / 共轭 A B A⁻¹ / 公式的阶
//   6. (旧) 关键事实          数据 + 群阶公式（保留作参考）

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { Cube3D } from '../components/Cube3D'
import {
  newCube, applyMoveInPlace, getStickerString, isSolved, cloneCube,
  COLOR_HEX, FACE_ORDER,
} from '../cube/state'
import type { CubeState, Face } from '../cube/state'

// ==================== 通用 helpers ====================

// BFS from solved, 返回每个 state 的距离 + 它在哪个 move 上被首次发现
function bfsFromSolved(
  moves: string[],
  maxDepth: number,
  cubeSize: 2 | 3 | 4 = 3,
): Map<string, { dist: number; state: CubeState; via: string }> {
  const result = new Map<string, { dist: number; state: CubeState; via: string }>()
  const start = newCube(cubeSize)
  const startKey = getStickerString(start)
  result.set(startKey, { dist: 0, state: start, via: '' })
  const queue: Array<{ key: string; state: CubeState }> = [{ key: startKey, state: start }]
  let qi = 0
  while (qi < queue.length) {
    const { key, state } = queue[qi++]
    const d = result.get(key)!.dist
    if (d === maxDepth) continue
    for (const m of moves) {
      const next = cloneCube(state)
      applyMoveInPlace(next, m)
      const nk = getStickerString(next)
      if (!result.has(nk)) {
        result.set(nk, { dist: d + 1, state: next, via: m })
        queue.push({ key: nk, state: next })
      }
    }
  }
  return result
}

// BFS shortest path (from arbitrary A to B)
function bfsPath(from: CubeState, to: CubeState, moves: string[]): string[] {
  const fromKey = getStickerString(from)
  const toKey = getStickerString(to)
  if (fromKey === toKey) return []
  const visited = new Map<string, { prev: string; move: string }>()
  visited.set(fromKey, { prev: '', move: '' })
  const stateByKey = new Map<string, CubeState>()
  stateByKey.set(fromKey, from)
  const queue: string[] = [fromKey]
  let qi = 0
  let found = false
  while (qi < queue.length && !found) {
    const curKey = queue[qi++]
    const cur = stateByKey.get(curKey)!
    for (const m of moves) {
      const next = cloneCube(cur)
      applyMoveInPlace(next, m)
      const nk = getStickerString(next)
      if (!visited.has(nk)) {
        visited.set(nk, { prev: curKey, move: m })
        stateByKey.set(nk, next)
        if (nk === toKey) { found = true; break }
        queue.push(nk)
      }
    }
  }
  if (!found) return []
  const path: string[] = []
  let curKey = toKey
  while (curKey !== fromKey) {
    const p = visited.get(curKey)!
    path.unshift(p.move)
    curKey = p.prev
  }
  return path
}

// Move 文字 → 对应面的颜色
const MOVE_COLORS: Record<string, string> = {
  U: COLOR_HEX.U, "U'": COLOR_HEX.U, U2: COLOR_HEX.U,
  D: COLOR_HEX.D, "D'": COLOR_HEX.D, D2: COLOR_HEX.D,
  R: COLOR_HEX.R, "R'": COLOR_HEX.R, R2: COLOR_HEX.R,
  L: COLOR_HEX.L, "L'": COLOR_HEX.L, L2: COLOR_HEX.L,
  F: COLOR_HEX.F, "F'": COLOR_HEX.F, F2: COLOR_HEX.F,
  B: COLOR_HEX.B, "B'": COLOR_HEX.B, B2: COLOR_HEX.B,
}

// 简化版：只取基础面（去掉 ' 和 2）
const FACE_MOVE_BASES: Record<string, string> = {
  U: 'U', "U'": 'U', U2: 'U',
  D: 'D', "D'": 'D', D2: 'D',
  R: 'R', "R'": 'R', R2: 'R',
  L: 'L', "L'": 'L', L2: 'L',
  F: 'F', "F'": 'F', F2: 'F',
  B: 'B', "B'": 'B', B2: 'B',
}

// ==================== Chapter 容器 ====================

function Chapter({ num, title, lead, children, insight }: {
  num: number; title: string; lead: string; children: React.ReactNode; insight?: string
}) {
  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <div className="text-xs text-cube-accent uppercase tracking-widest font-mono">第 {num} 章</div>
        <h2 className="h2">{title}</h2>
        <p className="lead max-w-3xl">{lead}</p>
      </header>
      <div className="space-y-4">{children}</div>
      {insight && (
        <div className="border-l-2 border-cube-accent bg-cube-accent/5 px-4 py-3 rounded-r text-cube-text/90 italic text-sm">
          💡 {insight}
        </div>
      )}
    </section>
  )
}

// ==================== InteractiveCube：3D 魔方 + 自我控制的 doMove ====================

function InteractiveCube({
  size = 3, initial, moves, onStateChange, height = 360,
  cubeId = 'main',
}: {
  size?: 2 | 3
  initial?: CubeState
  moves?: string[]        // 允许的 move 集（按钮显示）
  onStateChange?: (s: CubeState) => void
  height?: number
  cubeId?: string
}) {
  const [cube, setCube] = useState<CubeState>(() => initial ?? newCube(size))
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const currentMoveRef = useRef<string | null>(null)
  const stateRef = useRef<CubeState>(cube)
  stateRef.current = cube

  const allowed = useMemo(() => {
    if (moves) return moves
    // 默认：基础 6 面 + 反
    return size === 2
      ? ['U', "U'", 'R', "R'", 'F', "F'", 'D', "D'", 'L', "L'", 'B', "B'"]
      : ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"]
  }, [moves, size])

  const doMove = (m: string) => {
    if (pendingMove) return
    currentMoveRef.current = m
    setPendingMove(m)
  }
  const onMoveApplied = () => {
    const finished = currentMoveRef.current
    currentMoveRef.current = null
    setPendingMove(null)
    if (finished) {
      setCube(c => {
        const nc = cloneCube(c)
        applyMoveInPlace(nc, finished)
        onStateChange?.(nc)
        return nc
      })
    }
  }
  const reset = () => {
    setCube(initial ?? newCube(size))
    onStateChange?.(initial ?? newCube(size))
  }

  return (
    <div className="space-y-3" data-cube-id={cubeId}>
      <Cube3D
        state={cube}
        pendingMove={pendingMove}
        onMoveApplied={onMoveApplied}
        height={height}
        showControls={true}
      />
      <div className="flex flex-wrap gap-1.5">
        {allowed.map(m => (
          <button
            key={m}
            onClick={() => doMove(m)}
            disabled={!!pendingMove}
            className="px-2.5 py-1 rounded text-xs font-mono font-bold border-2 transition-all hover:scale-105 disabled:opacity-30"
            style={{
              borderColor: MOVE_COLORS[m],
              color: MOVE_COLORS[m],
              background: 'rgba(10, 10, 20, 0.6)',
            }}
          >{m}</button>
        ))}
        <button
          onClick={reset}
          disabled={!!pendingMove}
          className="ml-auto px-2.5 py-1 rounded text-xs text-cube-muted hover:text-cube-text border border-cube-border hover:border-cube-accent disabled:opacity-30"
        >↺ 重置</button>
      </div>
    </div>
  )
}

// ==================== MiniFace：单面缩略图（用于 graph node）====================

function MiniFace({ stickerString, face, size = 3, scale = 1 }: { stickerString: string; face: Face; size?: number; scale?: number }) {
  const i = FACE_ORDER.indexOf(face)
  const f = stickerString.slice(i * size * size, (i + 1) * size * size)
  const cell = size * scale
  return (
    <div
      className="grid gap-[1px]"
      style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}
    >
      {f.split('').map((c, idx) => (
        <div
          key={idx}
          style={{ width: cell, height: cell, backgroundColor: COLOR_HEX[c as Face] }}
          className="rounded-[1px]"
        />
      ))}
    </div>
  )
}

// ==================== Chapter 1：什么是"魔方状态" ====================

function Chapter1() {
  const [cube, setCube] = useState<CubeState>(() => newCube(3))
  const s = getStickerString(cube)
  const solved = getStickerString(newCube(3))
  const isSolvedNow = s === solved

  return (
    <Chapter
      num={1}
      title={'什么是"魔方状态"？'}
      lead="每个时刻魔方上 54 个 sticker 的颜色构成一个状态。状态可以用 54 字符的 sticker string 完整记录 —— 同一字符串 = 同一状态，无论你用什么步骤得到它。"
      insight='核心直觉：sticker string 是状态的"指纹"。两个状态有完全相同的 string，无论你用几步转过去，它们就是同一个状态；没有任何附加信息能区分它们。'
    >
      <div className="card">
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">试试看 — 点下面的按钮转动</div>
            <InteractiveCube
              cubeId="ch1"
              size={3}
              onStateChange={setCube}
              height={340}
            />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">
                Sticker String — 54 字符 · 6 个面
              </div>
              <div className="bg-cube-bg border border-cube-border rounded p-3 font-mono text-sm break-all">
                {s}
              </div>
              <div className="text-[10px] text-cube-muted/70 mt-1 font-mono">
                6 段 × 9 字符 = 54 字符，按 U R F D L B 顺序拼接
              </div>
            </div>

            <div>
              <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">6 个面分别长这样</div>
              <div className="bg-cube-bg border border-cube-border rounded p-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(3, auto)' }}>
                {(['U', 'R', 'F', 'D', 'L', 'B'] as Face[]).map(face => (
                  <div key={face} className="flex flex-col items-center">
                    <div className="text-[9px] text-cube-muted mb-1 font-mono">{face}</div>
                    <MiniFace stickerString={s} face={face} size={3} scale={6} />
                  </div>
                ))}
              </div>
            </div>

            <div className={`text-sm font-mono px-3 py-2 rounded border ${isSolvedNow ? 'border-cube-accent/50 bg-cube-accent/10 text-cube-accent' : 'border-cube-border text-cube-muted'}`}>
              状态: {isSolvedNow ? '已复原 ✓' : '已打乱 — string 跟初始不再一致'}
            </div>
          </div>
        </div>
      </div>
    </Chapter>
  )
}

// ==================== Chapter 2：状态空间有多大 ====================

const N_SIZE_FACTS: Array<{ n: 2 | 3 | 4; total: string; desc: string }> = [
  { n: 2, total: '3,674,160', desc: '3.7 百万 · 约 22 bit' },
  { n: 3, total: '43,252,003,274,489,856,000', desc: '4.3 × 10¹⁹ · 约 65 bit' },
  { n: 4, total: '7,401,208,641,498,492,708,724,517,776,175,225,600,000', desc: '7.4 × 10⁴⁵ · 约 152 bit' },
]

function Chapter2() {
  const [cubeSize, setCubeSize] = useState<2 | 3>(3)
  const [moveSetKey, setMoveSetKey] = useState<'UR' | 'UDR' | 'URFLD' | 'all'>('UDR')
  const [maxDepth, setMaxDepth] = useState(4)

  const MOVE_OPTIONS: Record<string, { moves: string[]; label: string }> = {
    UR: { moves: ['U', "U'", 'R', "R'"], label: '{U, R} · 2 面 4 步' },
    UDR: { moves: ['U', "U'", 'D', "D'", 'R', "R'"], label: '{U, D, R} · 3 面 6 步' },
    URFLD: { moves: ['U', "U'", 'R', "R'", 'F', "F'", 'L', "L'", 'D', "D'"], label: '{U,R,F,L,D} · 5 面 10 步' },
    all: { moves: ['U', "U'", 'R', "R'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"], label: '6 面 12 步（FTM）' },
  }

  const layerCounts = useMemo(() => {
    const { moves } = MOVE_OPTIONS[moveSetKey]
    const dist = bfsFromSolved(moves, maxDepth, cubeSize)
    const counts = new Array(maxDepth + 1).fill(0)
    for (const v of dist.values()) counts[v.dist]++
    return counts
  }, [cubeSize, moveSetKey, maxDepth])

  const maxCount = Math.max(...layerCounts.slice(1))
  const totalSoFar = layerCounts.reduce((a, b) => a + b, 0)

  return (
    <Chapter
      num={2}
      title="状态空间有多大？"
      lead="魔方的状态数随阶数指数级增长。BFS 从复原态出发，每多走一步就能到达一组新的状态 — 我们来看这些「层」是怎么堆起来的。"
      insight={`在 2×2 上，3 步以内只能摸到 ${cubeSize === 2 ? 50 : 200} 多个状态，离 3.7 百万差得远。在 3×3 上，只用 3 个面 {U,D,R} 4 步能到 ${totalSoFar.toLocaleString()} 个状态 — 还是远小于完整 4.3×10¹⁹。要枚举完整个群，需要更深的 BFS 或代数分解。`}
    >
      <div className="card">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-3 font-mono">/ 不同阶的完整状态数</div>
        <div className="grid md:grid-cols-3 gap-3">
          {N_SIZE_FACTS.map(f => (
            <div key={f.n} className="bg-cube-bg border border-cube-border rounded p-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-2xl font-extrabold text-cube-accent">{f.n}×{f.n}</span>
                <span className="text-[10px] text-cube-muted font-mono">{f.desc.split(' · ')[1]}</span>
              </div>
              <div className="font-mono text-sm">{f.total}</div>
              <div className="text-[10px] text-cube-muted mt-1">{f.desc.split(' · ')[0]}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-cube-muted mt-3 leading-relaxed">
          如果每秒检查 10 亿个状态，要遍历完 2×2 需要 4 毫秒，3×3 需要 1371 年，4×4 需要 10²⁶ 年（远超宇宙年龄 1.4×10¹⁰ 年）。
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">阶数</div>
            <div className="flex gap-1">
              {[2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => { setCubeSize(n as 2 | 3); setMaxDepth(Math.min(maxDepth, n === 2 ? 6 : 4)) }}
                  className={`px-3 py-1 rounded text-sm font-mono ${cubeSize === n ? 'bg-cube-accent text-white' : 'bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text'}`}
                >{n}×{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">生成集</div>
            <select
              value={moveSetKey}
              onChange={e => setMoveSetKey(e.target.value as any)}
              className="bg-cube-bg border border-cube-border rounded px-2 py-1 text-sm text-cube-text"
            >
              {Object.entries(MOVE_OPTIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">
              BFS 深度 <span className="text-cube-accent font-bold ml-1">{maxDepth}</span>
            </div>
            <input
              type="range" min={1} max={cubeSize === 2 ? 6 : 4} value={maxDepth}
              onChange={e => setMaxDepth(parseInt(e.target.value))}
              className="w-full accent-cube-accent"
            />
          </div>
        </div>

        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">
          每层（BFS 距复原态恰好 k 步）的状态数
        </div>
        <div className="space-y-2">
          {layerCounts.map((count, d) => {
            const widthPct = maxCount > 0 ? Math.max(2, (count / maxCount) * 100) : 2
            return (
              <div key={d} className="flex items-center gap-3">
                <div className="w-16 text-right text-cube-muted text-sm font-mono">depth {d}</div>
                <div className="flex-1 h-7 bg-cube-bg border border-cube-border rounded relative overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${widthPct}%`,
                      background: d === 0
                        ? '#7c5cff'
                        : `linear-gradient(90deg, #7c5cff, #b71234)`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 text-xs font-mono">
                    <span className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                      {count.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-24 text-right text-cube-text/80 font-mono text-sm">
                  {d === 0 ? '起点' : `约 ${count.toLocaleString()}`}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-xs text-cube-muted font-mono">
          前 {maxDepth} 步累计：<span className="text-cube-text">{totalSoFar.toLocaleString()}</span> 个状态
        </div>
      </div>
    </Chapter>
  )
}

// ==================== Chapter 3：Cayley 图 ====================

type CayleyNode = { id: string; dist: number; state: CubeState }
type CayleyEdge = { from: string; to: string; move: string }

function Chapter3() {
  const [cubeSize, setCubeSize] = useState<2 | 3>(2)
  const [genSet, setGenSet] = useState<'UR' | 'UDR' | 'URF' | 'all12'>('UR')
  const [bfsDepth, setBfsDepth] = useState(4)
  const [selected, setSelected] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const GEN_OPTIONS: Record<string, { moves: string[]; label: string; maxDepth: number }> = {
    UR: { moves: ['U', "U'", 'R', "R'"], label: '{U, R} · 2 面', maxDepth: 6 },
    UDR: { moves: ['U', "U'", 'D', "D'", 'R', "R'"], label: '{U, D, R} · 3 面', maxDepth: 5 },
    URF: { moves: ['U', "U'", 'R', "R'", 'F', "F'"], label: '{U, R, F} · 3 面', maxDepth: 4 },
    all12: { moves: ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"], label: '全部 6 面 · 12 步', maxDepth: 3 },
  }

  // 算 states + edges (BFS 到指定深度，cap 在子群大小的实际范围)
  const { states, edges } = useMemo(() => {
    const { moves } = GEN_OPTIONS[genSet]
    const cap = Math.min(bfsDepth, GEN_OPTIONS[genSet].maxDepth)
    const dist = bfsFromSolved(moves, cap, cubeSize)
    const ns: CayleyNode[] = []
    for (const [id, v] of dist) ns.push({ id, dist: v.dist, state: v.state })
    const es: CayleyEdge[] = []
    for (const [curKey, v] of dist) {
      if (v.dist >= cap) continue
      for (const m of moves) {
        const next = cloneCube(v.state)
        applyMoveInPlace(next, m)
        const nk = getStickerString(next)
        if (dist.has(nk)) es.push({ from: curKey, to: nk, move: m })
      }
    }
    return { states: ns, edges: es }
  }, [cubeSize, genSet, bfsDepth])

  // 选中的 state
  const selectedNode = useMemo(() => states.find(n => n.id === selected), [states, selected])
  const solvedKey = useMemo(() => getStickerString(newCube(cubeSize)), [cubeSize])

  // 选中节点及其邻居高亮
  const highlight = useMemo(() => {
    if (!selected) return { nodes: new Set<string>(), edgeIdx: new Set<number>() }
    const nodes = new Set<string>([selected])
    const edgeIdx = new Set<number>()
    const sel = states.find(s => s.id === selected)!
    for (const m of GEN_OPTIONS[genSet].moves) {
      const next = cloneCube(sel.state)
      applyMoveInPlace(next, m)
      const nk = getStickerString(next)
      if (states.some(s => s.id === nk)) nodes.add(nk)
    }
    edges.forEach((e, idx) => {
      if (e.from === selected || e.to === selected) edgeIdx.add(idx)
    })
    return { nodes, edgeIdx }
  }, [selected, states, edges, genSet])

  // d3 force simulation + 拖拽
  useEffect(() => {
    if (!svgRef.current || states.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 760
    const height = 520
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height)
    // 缩放/平移
    const g = svg.append('g')
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).on('zoom', e => g.attr('transform', e.transform)) as any)

    const nodes = states.map(n => ({ ...n })) as any[]
    const links = edges.map(e => ({ source: e.from, target: e.to, move: e.move })) as any[]

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(35).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(10))
    // 按 dist 分层：每个 dist 一圈，dist 0 在中心，dist N 在半径 N*100 的环上
    const byDist = new Map<number, any[]>()
    for (const n of nodes) {
      if (!byDist.has(n.dist)) byDist.set(n.dist, [])
      byDist.get(n.dist)!.push(n)
    }
    for (const [d, ns] of byDist) {
      const r = d === 0 ? 0 : d * 80
      ns.forEach((n, i) => {
        const angle = ns.length > 1 ? (i / ns.length) * Math.PI * 2 : 0
        n.x = width / 2 + Math.cos(angle) * r
        n.y = height / 2 + Math.sin(angle) * r
      })
    }

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', (d: any) => MOVE_COLORS[d.move] || '#3a3a4a')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', (d: any) => {
        if (!selected) return 0.55
        return (d.source.id === selected || d.target.id === selected) ? 0.95 : 0.18
      })

    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_, d: any) => setSelected(d.id))

    // drag
    const drag = d3.drag<any, any>()
      .on('start', (event, d: any) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (event, d: any) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d: any) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    node.call(drag as any)

    node.append('circle')
      .attr('r', (d: any) => d.id === solvedKey ? 8 : (d.dist === 0 ? 8 : 5))
      .attr('fill', (d: any) => {
        if (d.id === solvedKey) return '#7c5cff'
        if (selected === d.id) return '#ffd500'
        if (d.dist === 0) return '#7c5cff'
        // 距离渐变
        const palette = ['#009b48', '#ff5900', '#b71234', '#0046ad', '#666']
        return palette[Math.min(d.dist - 1, palette.length - 1)]
      })
      .attr('stroke', (d: any) => highlight.nodes.has(d.id) ? '#ffd500' : '#0a0a14')
      .attr('stroke-width', (d: any) => highlight.nodes.has(d.id) ? 2 : 1)

    node.append('title').text((d: any) => {
      const m = getStickerString(d.state).slice(0, 20)
      return `dist ${d.dist}\n${m}...`
    })

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // 跑一段时间
    for (let i = 0; i < 100; i++) sim.tick()
    sim.alpha(0).stop()
  }, [states, edges, selected, solvedKey, highlight])

  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  return (
    <Chapter
      num={3}
      title="Cayley 图 — 群的几何形状"
      lead="把每个状态画成一个点，把「一步能到」的关系画成一条边 — 这就是 Cayley 图。颜色按面着色：R 红 / U 白 / D 黄 / F 绿 / B 蓝 / L 橙。拖拽节点看结构，滚轮缩放，点击节点看 3D。"
      insight={`Cayley 图是群的几何化：节点数 = 子群阶，边数 ≈ 节点数 × 生成集大小 / 2（去重后）。生成集越小图越稀疏（约束多），越大越稠密（自由度多）。注意 BFS 的「球形」结构 — dist d 的状态在图上呈环状分布。`}
    >
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">阶数</div>
            <div className="flex gap-1">
              {[2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => { setCubeSize(n as 2 | 3); setSelected(null) }}
                  className={`px-3 py-1 rounded text-sm font-mono ${cubeSize === n ? 'bg-cube-accent text-white' : 'bg-cube-bg border border-cube-border text-cube-muted'}`}
                >{n}×{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">生成集</div>
            <div className="flex gap-1">
              {Object.entries(GEN_OPTIONS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => { setGenSet(k as any); setSelected(null); setBfsDepth(Math.min(bfsDepth, v.maxDepth)) }}
                  className={`px-3 py-1 rounded text-sm font-mono ${genSet === k ? 'bg-cube-accent text-white' : 'bg-cube-bg border border-cube-border text-cube-muted'}`}
                >{v.label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">
              BFS 深度 <span className="text-cube-accent font-bold ml-1">{bfsDepth}</span>
              <span className="text-cube-muted/60 ml-2">/ 最大 {GEN_OPTIONS[genSet].maxDepth}</span>
            </div>
            <input
              type="range" min={1} max={GEN_OPTIONS[genSet].maxDepth} value={bfsDepth}
              onChange={e => { setBfsDepth(parseInt(e.target.value)); setSelected(null) }}
              className="w-full accent-cube-accent"
            />
          </div>
          <div className="ml-auto text-sm font-mono text-cube-muted">
            节点 <span className="text-cube-text">{states.length}</span> · 边 <span className="text-cube-text">{edges.length}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          <div className="rounded border border-cube-border bg-cube-bg/50 overflow-hidden">
            <svg ref={svgRef} />
          </div>
          <div className="space-y-3">
            {selectedNode ? (
              <>
                <div className="text-xs text-cube-muted font-mono">
                  选中节点 · dist {selectedNode.dist} · sticker string 前 30:
                </div>
                <div className="bg-cube-bg border border-cube-border rounded p-2 font-mono text-[10px] break-all">
                  {getStickerString(selectedNode.state).slice(0, 30)}…
                </div>
                <Cube3D
                  state={selectedNode.state}
                  height={200}
                  showControls={false}
                />
                <div className="text-xs text-cube-muted">
                  邻接：{(() => {
                    const ns: string[] = []
                    for (const m of GEN_OPTIONS[genSet].moves) {
                      const next = cloneCube(selectedNode.state)
                      applyMoveInPlace(next, m)
                      const nk = getStickerString(next)
                      if (states.some(s => s.id === nk)) ns.push(m)
                    }
                    return ns.join(' ')
                  })()}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-full text-xs text-cube-muted hover:text-cube-text border border-cube-border rounded px-2 py-1"
                >取消选择</button>
              </>
            ) : (
              <div className="text-xs text-cube-muted italic leading-relaxed">
                👆 点击任意节点查看它的 3D 状态和邻接 move。<br/>
                拖拽节点可重新排布；滚轮缩放。<br/>
                紫色 = 复原态（dist 0）；其他颜色按距离渐变。
              </div>
            )}
          </div>
        </div>
      </div>
    </Chapter>
  )
}

// ==================== Chapter 4：最短路 / God Number ====================

function Chapter4() {
  const [genSet, setGenSet] = useState<'UR' | 'UDR' | 'URF' | 'all18'>('URF')
  const [cubeSize] = useState<2 | 3>(2)
  const [fromScramble, setFromScramble] = useState("R U R'")
  const [scrambled, setScrambled] = useState<CubeState | null>(null)
  const [pathAnim, setPathAnim] = useState<{ steps: string[]; cur: CubeState; step: number; playing: boolean } | null>(null)
  const [allNodes, setAllNodes] = useState<Map<string, { dist: number; state: CubeState; via: string }> | null>(null)

  const GEN_OPTIONS: Record<string, { moves: string[]; label: string }> = {
    UR: { moves: ['U', "U'", 'R', "R'"], label: '{U, R} · 2 面' },
    UDR: { moves: ['U', "U'", 'D', "D'", 'R', "R'"], label: '{U, D, R} · 3 面' },
    URF: { moves: ['U', "U'", 'R', "R'", 'F', "F'"], label: '{U, R, F} · 3 面（小心 BFS 可能很大）' },
    all18: { moves: ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"], label: '全部 6 面（仅用于短 scramble）' },
  }

  const scramble = () => {
    const moves = GEN_OPTIONS[genSet].moves
    const list = parseMoveList(fromScramble)
    const c = newCube(cubeSize)
    for (const m of list) applyMoveInPlace(c, m)
    setScrambled(c)
    setPathAnim(null)
    // 算 BFS 找路：cap 深度避免在 large 群上 OOM
    const cap = 12
    const solved = newCube(cubeSize)
    const path = bfsPath(c, solved, moves)
    const dist = bfsFromSolved(moves, Math.max(Math.min(path.length, cap), 4), cubeSize)
    setAllNodes(dist)
    if (path.length === 0) {
      setPathAnim({ steps: [], cur: c, step: 0, playing: false })
    } else {
      setPathAnim({ steps: path, cur: cloneCube(c), step: 0, playing: false })
    }
  }

  // 自动播放
  useEffect(() => {
    if (!pathAnim || !pathAnim.playing) return
    if (pathAnim.step >= pathAnim.steps.length) {
      setPathAnim(p => p ? { ...p, playing: false } : null)
      return
    }
    const t = setTimeout(() => {
      setPathAnim(p => {
        if (!p) return null
        const next = cloneCube(p.cur)
        applyMoveInPlace(next, p.steps[p.step])
        return { ...p, cur: next, step: p.step + 1 }
      })
    }, 350)
    return () => clearTimeout(t)
  }, [pathAnim?.playing, pathAnim?.step])

  const solved = newCube(cubeSize)
  const moves = GEN_OPTIONS[genSet].moves
  const pathLength = pathAnim?.steps.length ?? 0
  const distInGraph = scrambled && allNodes ? allNodes.get(getStickerString(scrambled))?.dist : null

  return (
    <Chapter
      num={4}
      title="最短路 — God Number 的来源"
      lead="在 Cayley 图里从任意状态走到复原态，最短要走几步？这就是 BFS 找路。3×3 的 God Number = 20（face turn metric，FTM），意思是任何打乱状态都能在 20 步内复原，且存在某些状态必须 20 步。"
      insight={'God Number 不是「魔方有 4.3e19 个状态」那么简单的算术 — 而是群 + 选定生成集下的图直径。2×2 的 God Number = 14（FTM）/ 11（QTM），3×3 = 20 / 26，4×4 = 47 / 60，5×5 = 未证。N×N 的 God Number 大致按 N² 增长。'}
    >
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div>
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">生成集</div>
            <select
              value={genSet}
              onChange={e => setGenSet(e.target.value as any)}
              className="bg-cube-bg border border-cube-border rounded px-2 py-1 text-sm text-cube-text"
            >
              {Object.entries(GEN_OPTIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">scramble 公式</div>
            <input
              value={fromScramble}
              onChange={e => setFromScramble(e.target.value)}
              className="w-full bg-cube-bg border border-cube-border rounded px-2 py-1 text-sm font-mono text-cube-text"
              placeholder="例如 R U R' F'"
            />
          </div>
          <button
            onClick={scramble}
            className="btn-primary"
          >打乱 + 找最短路</button>
        </div>

        {scrambled && pathAnim && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-cube-muted font-mono">起点（已打乱）</div>
              <Cube3D state={scrambled} height={200} showControls={false} />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-cube-muted font-mono">
                中间状态 · step {pathAnim.step}/{pathAnim.steps.length}
              </div>
              <Cube3D state={pathAnim.cur} height={200} showControls={false} />
              <div className="flex gap-1">
                <button
                  onClick={() => setPathAnim(p => p ? { ...p, playing: !p.playing } : null)}
                  className="btn text-xs flex-1"
                  disabled={pathAnim.step >= pathAnim.steps.length}
                >{pathAnim.playing ? '⏸ 暂停' : '▶ 播放'}</button>
                <button
                  onClick={() => setPathAnim(p => p ? { ...p, step: 0, cur: cloneCube(scrambled) } : null)}
                  className="btn text-xs"
                >↺ 重置</button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-cube-muted font-mono">终点（复原态）</div>
              <Cube3D state={solved} height={200} showControls={false} />
              <div className="text-sm font-mono bg-cube-bg border border-cube-border rounded p-2 space-y-1">
                <div>
                  实际步数: <span className="text-cube-text font-bold">{pathLength}</span>
                </div>
                <div className="text-xs text-cube-muted">
                  BFS 最短距: <span className="text-cube-text">{distInGraph ?? '?'}</span>
                </div>
                <div className="text-xs text-cube-muted break-all">
                  公式: <span className="text-cube-accent">{pathAnim.steps.join(' ') || '(已是复原态)'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!scrambled && (
          <div className="text-sm text-cube-muted italic py-8 text-center">
            点 "打乱 + 找最短路" 开始 — 会从复原态按你给的公式打乱，然后 BFS 找最短路回来
          </div>
        )}
      </div>
    </Chapter>
  )
}

// 简单 parser（容忍空格 / 单引号 / 2）
function parseMoveList(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean).map(m => {
    const ch = m[0].toUpperCase()
    if (!'URFDLB'.includes(ch)) throw new Error('bad move: ' + m)
    return ch + m.slice(1)
  })
}

// ==================== Chapter 5：群论直觉 ====================

function Chapter5() {
  const [tab, setTab] = useState<'commutator' | 'conjugate' | 'order'>('commutator')

  return (
    <Chapter
      num={5}
      title="群论直觉 — 换位子、共轭、元素的阶"
      lead={'群是带运算的集合，Cayley 图是它的几何。但更重要的是代数结构 — 通过 [A, B] 和 A B A⁻¹ 这种「操作的操作」，你能直接看到群元素之间的关系。'}
      insight="魔方公式的 90% 是这三类结构的组合：换位子（小幅扰动）、共轭（换坐标系）、幂（重复同一个东西）。CFOP 里几乎所有 OLL / PLL 算法都是「对某个子群做换位子再共轭」的结果。"
    >
      <div className="card">
        <div className="flex gap-1 mb-4 border-b border-cube-border">
          {([
            ['commutator', '换位子 [A, B]'],
            ['conjugate', '共轭 A B A⁻¹'],
            ['order', '元素的阶'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-mono -mb-px border-b-2 ${tab === k ? 'border-cube-accent text-cube-text' : 'border-transparent text-cube-muted hover:text-cube-text'}`}
            >{label}</button>
          ))}
        </div>

        {tab === 'commutator' && <CommutatorDemo />}
        {tab === 'conjugate' && <ConjugateDemo />}
        {tab === 'order' && <OrderDemo />}
      </div>
    </Chapter>
  )
}

function CommutatorDemo() {
  const [a, setA] = useState('R')
  const [b, setB] = useState('U')
  const [cube, setCube] = useState<CubeState>(() => newCube(3))
  const [pending, setPending] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  // 换位子公式: A B A' B'
  const sequence = useMemo(() => {
    const ai = invertMoveToken(a)
    const bi = invertMoveToken(b)
    return [a, b, ai, bi]
  }, [a, b])

  const aInv = invertMoveToken(a)
  const bInv = invertMoveToken(b)

  const playFull = () => {
    if (pending) return
    setCube(newCube(3))
    setLog([])
    playSequence(sequence)
  }

  const playSequence = (seq: string[], i = 0) => {
    if (i >= seq.length) return
    setPending(seq[i])
    setLog(log => [...log, seq[i]])
  }

  const onMoveApplied = () => {
    setPending(null)
    setLog(log => {
      const lastMove = log[log.length - 1]
      if (lastMove) {
        setCube(c => {
          const nc = cloneCube(c)
          applyMoveInPlace(nc, lastMove)
          return nc
        })
      }
      return log
    })
    // 继续下一手
    if (log.length < sequence.length) {
      setTimeout(() => playSequence(sequence, log.length), 50)
    }
  }

  // 单步按钮
  const playStep = (m: string) => {
    if (pending) return
    setLog(log => [...log, m])
    setPending(m)
  }

  // 应用 6 次：演示 [R,U]^6 = I
  const applySixTimes = () => {
    if (pending) return
    setCube(newCube(3))
    setLog([])
    const six = []
    for (let k = 0; k < 6; k++) six.push(...sequence)
    setLog(six)
    let i = 0
    const step = () => {
      if (i >= six.length) return
      setPending(six[i++])
    }
    step()
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-cube-muted">
        <span className="font-mono text-cube-text">[A, B] = A B A⁻¹ B⁻¹</span> 衡量 A 和 B 「有多不对易」。如果 [A, B] = I，A 和 B 完美对易 — 几乎所有魔方公式都不是这种情况。
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-cube-muted mb-1 font-mono">A =</div>
          <FacePicker value={a} onChange={setA} />
        </div>
        <div>
          <div className="text-xs text-cube-muted mb-1 font-mono">B =</div>
          <FacePicker value={b} onChange={setB} />
        </div>
        <button onClick={playFull} disabled={!!pending} className="btn-primary">
          ▶ 演示 [A, B]
        </button>
        <button onClick={applySixTimes} disabled={!!pending} className="btn">
          演示 [A, B] × 6
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-cube-muted font-mono mb-1">公式: [{a}, {b}] = {a} {b} {aInv} {bInv}</div>
          <Cube3D state={cube} pendingMove={pending} onMoveApplied={onMoveApplied} height={280} showControls={false} />
        </div>
        <div className="space-y-3">
          <div className="text-xs text-cube-muted font-mono">单步手动</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => playStep(a)} disabled={!!pending} className="px-2 py-1 rounded text-sm font-mono font-bold border-2" style={{ borderColor: MOVE_COLORS[a], color: MOVE_COLORS[a] }}>{a}</button>
            <button onClick={() => playStep(b)} disabled={!!pending} className="px-2 py-1 rounded text-sm font-mono font-bold border-2" style={{ borderColor: MOVE_COLORS[b], color: MOVE_COLORS[b] }}>{b}</button>
            <button onClick={() => playStep(aInv)} disabled={!!pending} className="px-2 py-1 rounded text-sm font-mono font-bold border-2" style={{ borderColor: MOVE_COLORS[aInv], color: MOVE_COLORS[aInv] }}>{aInv}</button>
            <button onClick={() => playStep(bInv)} disabled={!!pending} className="px-2 py-1 rounded text-sm font-mono font-bold border-2" style={{ borderColor: MOVE_COLORS[bInv], color: MOVE_COLORS[bInv] }}>{bInv}</button>
          </div>
          <div className="bg-cube-bg border border-cube-border rounded p-3 text-xs font-mono space-y-1">
            <div className="text-cube-muted">已执行的步骤：</div>
            <div className="text-cube-text break-all min-h-[1.5em]">
              {log.length === 0 ? <span className="text-cube-muted/50">（点上面按钮）</span> : log.join(' ')}
            </div>
            <div className="text-cube-muted">
              状态: {isSolved(cube) ? <span className="text-cube-accent">已复原 ✓</span> : '已打乱'}
            </div>
          </div>
          <div className="text-xs text-cube-muted leading-relaxed border-l-2 border-cube-border pl-3">
            <span className="font-mono text-cube-text">[R, U] = R U R' U'</span> 阶为 6（重复 6 次回到 I）— 几乎只动 5 个 cubie，这就是 Sexy Move 的结构基础。
          </div>
        </div>
      </div>
    </div>
  )
}

function ConjugateDemo() {
  const [a, setA] = useState('F')
  const [b, setB] = useState('R')
  const [cube, setCube] = useState<CubeState>(() => newCube(3))
  const [pending, setPending] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  const aInv = invertMoveToken(a)
  const sequence = [a, b, aInv]

  const playFull = () => {
    if (pending) return
    setCube(newCube(3))
    setLog([])
    let i = 0
    const step = () => {
      if (i >= sequence.length) return
      setLog(log => [...log, sequence[i]])
      setPending(sequence[i++])
    }
    step()
  }

  const onMoveApplied = () => {
    setPending(null)
    setLog(log => {
      const lastMove = log[log.length - 1]
      if (lastMove) {
        setCube(c => {
          const nc = cloneCube(c)
          applyMoveInPlace(nc, lastMove)
          return nc
        })
      }
      return log
    })
    if (log.length < sequence.length) {
      setTimeout(() => {
        setLog(log => [...log, sequence[log.length]])
        setPending(sequence[log.length])
      }, 50)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-cube-muted">
        <span className="font-mono text-cube-text">A B A⁻¹</span> = 在 A 的坐标系里做 B，然后切回原坐标。结果通常是「只动了 B 的几个 cubie，但在不同位置」。
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-cube-muted mb-1 font-mono">A =</div>
          <FacePicker value={a} onChange={setA} />
        </div>
        <div>
          <div className="text-xs text-cube-muted mb-1 font-mono">B =</div>
          <FacePicker value={b} onChange={setB} />
        </div>
        <button onClick={playFull} disabled={!!pending} className="btn-primary">
          ▶ 演示 A B A⁻¹
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-cube-muted font-mono mb-1">公式: {a} {b} {aInv}</div>
          <Cube3D state={cube} pendingMove={pending} onMoveApplied={onMoveApplied} height={280} showControls={false} />
        </div>
        <div className="space-y-3">
          <div className="bg-cube-bg border border-cube-border rounded p-3 text-xs font-mono space-y-1">
            <div className="text-cube-muted">已执行：</div>
            <div className="text-cube-text break-all min-h-[1.5em]">
              {log.length === 0 ? <span className="text-cube-muted/50">（点上面按钮）</span> : log.join(' ')}
            </div>
            <div className="text-cube-muted">
              状态: {isSolved(cube) ? <span className="text-cube-accent">已复原 ✓</span> : '已打乱'}
            </div>
          </div>
          <div className="text-xs text-cube-muted leading-relaxed border-l-2 border-cube-border pl-3">
            经典例子：<span className="font-mono text-cube-text">F R F'</span> = "在 F 面坐标系下的 R 转动" — 它把 R 面映射到了一个新的虚拟面。CFOP 几乎所有 OLL / PLL 都建立在「用共轭在不同区域做同一个基础操作」上。
          </div>
        </div>
      </div>
    </div>
  )
}

function OrderDemo() {
  const presets: { name: string; formula: string; order: number }[] = [
    { name: 'Sune (OLL)', formula: "R U R' U R U2 R'", order: 6 },
    { name: 'Sexy Move', formula: "R U R' U'", order: 6 },
    { name: '[R, U]', formula: "R U R' U'", order: 6 },
    { name: 'T-Perm', formula: "R U R' U' R' F R2 U' R' U' R U R' F'", order: 2 },
    { name: 'Y-Perm', formula: "F R U' R' U' R U R' F' R U R' U' R' F R F'", order: 2 },
    { name: 'H-Perm', formula: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", order: 2 },
    { name: '4-cycle', formula: "R U R' U' D'", order: 24 },
  ]
  const [picked, setPicked] = useState(presets[0])
  const [cube, setCube] = useState<CubeState>(() => newCube(3))
  const [pending, setPending] = useState<string | null>(null)
  const [applied, setApplied] = useState(0)
  const [maxN, setMaxN] = useState(8)

  const sequence = useMemo(() => {
    const moves = picked.formula.trim().split(/\s+/).filter(Boolean)
    const all: string[] = []
    for (let i = 0; i < maxN; i++) all.push(...moves)
    return all
  }, [picked, maxN])

  const playOne = () => {
    if (pending || applied >= sequence.length) return
    setPending(sequence[applied])
  }

  const onMoveApplied = () => {
    setPending(null)
    setCube(c => {
      const nc = cloneCube(c)
      applyMoveInPlace(nc, sequence[applied])
      return nc
    })
    setApplied(n => n + 1)
  }

  const reset = () => {
    setCube(newCube(3))
    setApplied(0)
  }

  const solved = isSolved(cube)
  const moves = picked.formula.trim().split(/\s+/).filter(Boolean)
  const isMultipleOfOrder = applied > 0 && applied % moves.length === 0 && solved

  return (
    <div className="space-y-4">
      <div className="text-sm text-cube-muted">
        群元素的「阶」 = 最小的 n，使得 gⁿ = I。每个 CFOP 公式都是群里的某个元素 — 它的阶就是这个公式重复几次能复原。
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button
            key={p.name}
            onClick={() => { setPicked(p); reset() }}
            className={`px-3 py-1.5 rounded text-xs font-mono ${picked.name === p.name ? 'bg-cube-accent text-white' : 'bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text'}`}
          >
            {p.name} <span className="opacity-60 text-[10px]">×{p.order}</span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <Cube3D state={cube} pendingMove={pending} onMoveApplied={onMoveApplied} height={260} showControls={false} />
          <div className="flex gap-2 mt-2">
            <button onClick={playOne} disabled={!!pending || applied >= sequence.length} className="btn-primary flex-1">
              ▶ 单步 (已 {applied}/{sequence.length})
            </button>
            <button onClick={reset} className="btn">↺ 重置</button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-cube-muted font-mono">公式: <span className="text-cube-text">{picked.formula}</span></div>
          <div className="text-xs text-cube-muted font-mono">阶: <span className="text-cube-accent font-bold">{picked.order}</span></div>
          <div className="bg-cube-bg border border-cube-border rounded p-3 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-cube-muted">已应用 {moves.length} 的倍数：</span>
              <span className="font-mono text-cube-text">{Math.floor(applied / moves.length)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cube-muted">当前状态：</span>
              <span className={solved ? 'text-cube-accent' : 'text-cube-text'}>{solved ? '已复原 ✓' : '未复原'}</span>
            </div>
            {isMultipleOfOrder && (
              <div className="text-cube-accent font-bold text-sm">
                → 已完成 {Math.floor(applied / moves.length)} 次「{picked.name}」循环，状态复原
              </div>
            )}
            <div className="text-cube-muted text-[10px] mt-2">
              试 Sune（阶 6）：点 6 次单步后状态回 I。<br/>
              试 T-Perm（阶 2）：点 2 次单步后状态回 I — 但中间状态把对角块交换了。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FacePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B']
  const variants = ['', "'", '2']
  return (
    <div className="flex gap-1">
      {faces.map(f => (
        <div key={f} className="flex flex-col gap-0.5">
          {variants.map(v => {
            const m = f + v
            return (
              <button
                key={m}
                onClick={() => onChange(m)}
                className={`w-10 h-7 text-xs font-mono font-bold rounded border-2 transition-all ${value === m ? 'scale-105' : 'opacity-60 hover:opacity-100'}`}
                style={{
                  borderColor: MOVE_COLORS[m],
                  color: MOVE_COLORS[m],
                  background: value === m ? `${MOVE_COLORS[m]}22` : 'rgba(10,10,20,0.6)',
                }}
              >{m}</button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function invertMoveToken(m: string): string {
  if (m.endsWith("'")) return m.slice(0, -1)
  if (m.endsWith('2')) return m
  return m + "'"
}

// ==================== Chapter 6：关键事实（参考）====================

function Chapter6() {
  return (
    <Chapter
      num={6}
      title="关键群论事实（速查表）"
      lead="前 5 章是动态的探索 — 这一章是结论性的事实速查。"
    >
      <div className="card">
        <ul className="space-y-2 text-sm text-cube-text/90 leading-relaxed">
          <li>· <b>状态数</b>：3×3 = 43,252,003,274,489,856,000 ≈ 4.3 × 10¹⁹ ≈ 2⁶⁵</li>
          <li>· <b>群阶</b>：|G| = 8! × 3⁷ × 12! × 2¹¹ = 4.3×10¹⁹（角块排列+定向 × 棱块排列+翻转，奇偶约束减半）</li>
          <li>· <b>God Number</b>：2×2 = 11 (QTM) / 14 (FTM)，3×3 = 26 (QTM) / 20 (FTM)，4×4 ≈ 60 (QTM) / 47 (FTM)，5×5 未证</li>
          <li>· <b>基本对易</b>：[F, B] = I，[R, L] = I，[U, D] = I；U/D 与 F/B 不对易</li>
          <li>· <b>对称性</b>：24 个魔方旋转形成 24 阶群，作用在 G 上。轨道数 ≈ 1.8 × 10¹⁸</li>
          <li>· <b>子群</b>：G 本身有 10⁴⁰ 阶以上的子群（Rubik's cube group 是经典群论研究的丰富例子）</li>
        </ul>
      </div>
    </Chapter>
  )
}

// ==================== Main ====================

export function GraphTheory() {
  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3/graph</div>
        <h1 className="h1">图论与群论视角</h1>
        <p className="lead max-w-3xl">
          魔方所有合法状态 + 18 个基本转动 = Cayley 图 — 顶点是状态，边是单步转动。
          整个群结构就藏在这张图里。从最基础的「状态是什么」一路走到「换位子和共轭的代数含义」，6 个章节，由浅入深。
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
          <a href="#ch1" className="px-2 py-1 rounded bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text hover:border-cube-accent">1. 状态</a>
          <a href="#ch2" className="px-2 py-1 rounded bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text hover:border-cube-accent">2. 状态空间</a>
          <a href="#ch3" className="px-2 py-1 rounded bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text hover:border-cube-accent">3. Cayley 图</a>
          <a href="#ch4" className="px-2 py-1 rounded bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text hover:border-cube-accent">4. 最短路</a>
          <a href="#ch5" className="px-2 py-1 rounded bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text hover:border-cube-accent">5. 群论直觉</a>
          <a href="#ch6" className="px-2 py-1 rounded bg-cube-bg border border-cube-border text-cube-muted hover:text-cube-text hover:border-cube-accent">6. 速查</a>
        </div>
      </header>

      <div id="ch1"><Chapter1 /></div>
      <div id="ch2"><Chapter2 /></div>
      <div id="ch3"><Chapter3 /></div>
      <div id="ch4"><Chapter4 /></div>
      <div id="ch5"><Chapter5 /></div>
      <div id="ch6"><Chapter6 /></div>
    </div>
  )
}
