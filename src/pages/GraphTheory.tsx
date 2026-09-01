import { useState, useMemo, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { newCube, applyMove, getStickerString, fromStickerString, isSolved, parseMoves } from '../cube/state'

// BFS 出 1-2 步内的 Cayley 子图
function bfs(start: string, depth: number, moves: string[]): Map<string, number> {
  const dist = new Map<string, number>()
  dist.set(start, 0)
  const queue: string[] = [start]
  while (queue.length > 0) {
    const cur = queue.shift()!
    const d = dist.get(cur)!
    if (d === depth) continue
    for (const m of moves) {
      const c = fromStickerString(cur)
      applyMove(c, m)
      const next = getStickerString(c)
      if (!dist.has(next)) {
        dist.set(next, d + 1)
        queue.push(next)
      }
    }
  }
  return dist
}

function findPath(from: string, to: string, moves: string[]): string[] {
  if (from === to) return []
  const visited = new Map<string, { prev: string; move: string }>()
  visited.set(from, { prev: '', move: '' })
  const queue: string[] = [from]
  let found = false
  while (queue.length > 0 && !found) {
    const cur = queue.shift()!
    for (const m of moves) {
      const c = fromStickerString(cur)
      applyMove(c, m)
      const next = getStickerString(c)
      if (!visited.has(next)) {
        visited.set(next, { prev: cur, move: m })
        if (next === to) { found = true; break }
        queue.push(next)
      }
    }
  }
  if (!found) return []
  const path: string[] = []
  let cur = to
  while (cur !== from) {
    const p = visited.get(cur)!
    path.unshift(p.move)
    cur = p.prev
  }
  return path
}

export function GraphTheory() {
  const [depth, setDepth] = useState(1)
  const [moveSet, setMoveSet] = useState<'UDR' | 'UDRLRF' | 'all18'>('UDR')
  const [selected, setSelected] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const MOVES: Record<string, string[]> = {
    'UDR': ['U', "U'", 'D', "D'", 'R', "R'"],
    'UDRLRF': ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'"],
    'all18': ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"],
  }

  const states = useMemo(() => {
    const solved = getStickerString(newCube())
    return bfs(solved, depth, MOVES[moveSet])
  }, [depth, moveSet])

  const edges = useMemo(() => {
    const list: Array<{ from: string; to: string; move: string }> = []
    for (const [s, d] of states) {
      if (d === depth) continue
      for (const m of MOVES[moveSet]) {
        const c = fromStickerString(s)
        applyMove(c, m)
        const t = getStickerString(c)
        if (states.has(t) && s < t) {
          list.push({ from: s, to: t, move: m })
        }
      }
    }
    return list
  }, [states, moveSet, MOVES])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 800
    const height = Math.max(400, 80 + states.size * 3)
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height)

    const nodes = Array.from(states.entries()).map(([id, d]) => ({ id, d }))

    // 力导向布局
    const sim = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(edges.map(e => ({ source: e.from, target: e.to, move: e.move }))).id((d: any) => d.id).distance(40).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-60))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(8))
      .stop()

    for (let i = 0; i < 150; i++) sim.tick()

    const solved = getStickerString(newCube())

    const link = svg.append('g').attr('stroke', '#3a3a4a').attr('stroke-width', 1).selectAll('line')
      .data(edges).join('line')
      .attr('x1', (d: any) => sim.nodes().find((n: any) => n.id === d.from)?.x)
      .attr('y1', (d: any) => sim.nodes().find((n: any) => n.id === d.from)?.y)
      .attr('x2', (d: any) => sim.nodes().find((n: any) => n.id === d.to)?.x)
      .attr('y2', (d: any) => sim.nodes().find((n: any) => n.id === d.to)?.y)
      .attr('stroke', (d: any) => {
        if (selected && (d.from === selected || d.to === selected)) return '#7c5cff'
        return '#3a3a4a'
      })
      .attr('stroke-width', (d: any) => {
        if (selected && (d.from === selected || d.to === selected)) return 3
        return 1
      })

    const node = svg.append('g').selectAll('g')
      .data(nodes).join('g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_, d: any) => setSelected(d.id))

    node.append('circle')
      .attr('r', (d: any) => d.id === solved ? 8 : 5)
      .attr('fill', (d: any) => {
        if (d.id === solved) return '#7c5cff'
        if (selected === d.id) return '#ffd500'
        if (d.d === 0) return '#7c5cff'
        if (d.d === 1) return '#009b48'
        if (d.d === 2) return '#ff5900'
        return '#666'
      })
      .attr('stroke', '#0a0a14')
      .attr('stroke-width', 1)

    node.append('text')
      .text((d: any) => d.d)
      .attr('text-anchor', 'middle')
      .attr('dy', 3)
      .attr('font-size', 8)
      .attr('fill', '#0a0a14')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('pointer-events', 'none')
  }, [states, edges, selected])

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3/graph</div>
        <h1 className="h1">图论视角</h1>
        <p className="lead">
          魔方所有合法状态 + 18 个基本转动 = Cayley 图。顶点 = 状态，边 = 单步转动。
          God Number = 任何状态到复原态的最短距离（3×3 = 20）。
        </p>
      </header>

      <section className="card">
        <h2 className="h3 mb-3">Cayley 子图（从复原态出发的 BFS）</h2>
        <div className="flex gap-3 mb-3 flex-wrap items-center text-sm">
          <label className="flex items-center gap-2">
            步数:
            <input type="range" min="1" max="3" value={depth} onChange={e => setDepth(parseInt(e.target.value))} className="w-32" />
            <span className="font-mono text-cube-accent">{depth}</span>
          </label>
          <label className="flex items-center gap-2">
            生成集:
            <select value={moveSet} onChange={e => setMoveSet(e.target.value as any)} className="bg-cube-bg border border-cube-border rounded px-2 py-1 text-cube-text">
              <option value="UDR">3 个面 (U/D/R) · 6 转动</option>
              <option value="UDRLRF">5 个面 · 10 转动</option>
              <option value="all18">全部 6 面 · 12 转动</option>
            </select>
          </label>
          <div className="text-cube-muted ml-auto">
            节点: <span className="text-cube-text font-mono">{states.size}</span> · 边: <span className="text-cube-text font-mono">{edges.length}</span>
          </div>
        </div>
        <div className="rounded border border-cube-border bg-cube-bg/50 overflow-auto" style={{ maxHeight: 600 }}>
          <svg ref={svgRef} />
        </div>
        <div className="text-xs text-cube-muted mt-2 font-mono">
          紫 = 复原态 (depth 0) · 绿 = depth 1 · 橙 = depth 2 · 灰 = depth 3+ · 点击节点高亮它和它的邻边
        </div>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">关键群论事实（3×3）</h2>
        <ul className="space-y-2 text-cube-text/90 leading-relaxed">
          <li>· <b>状态数</b>：43,252,003,274,489,856,000 ≈ 4.3 × 10¹⁹</li>
          <li>· <b>群阶</b>：|G| = 8! × 3⁷ × 12! × 2¹¹ = 43,252,003,274,489,856,000（角块 8! × 3⁷ + 棱块 12! × 2¹¹，奇偶性约束减半）</li>
          <li>· <b>God Number</b>：20（任何打乱状态可在 ≤ 20 步内复原，最优解的步数上界）</li>
          <li>· <b>每步代价为 1</b>（face turn metric, FTM）。如果用 quarter turn metric（QTM），God Number = 26</li>
          <li>· <b>基本关系</b>：[F, B] = I（前后对易），[R, L] = I，U 与 D 对易，U/D 与 F/B 不对易</li>
          <li>· <b>对称性</b>：群作用在 24 个魔方旋转上。轨道数 = 43e18 / 24 ≈ 1.8e18</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">换位子与共轭（CFOP 公式的代数结构）</h2>
        <p className="text-cube-text/90 leading-relaxed mb-3">
          几乎所有 CFOP 公式都有清楚的代数结构。两种最常见：
        </p>
        <div className="space-y-3">
          <div className="border-l-2 border-cube-accent pl-4">
            <div className="font-mono text-sm mb-1">[A, B] = A B A⁻¹ B⁻¹ （换位子）</div>
            <p className="text-sm text-cube-muted">例：<span className="font-mono">[R, U] = R U R' U'</span>，只动顶面和右面相关的 5 个块，阶 6。</p>
          </div>
          <div className="border-l-2 border-cube-accent pl-4">
            <div className="font-mono text-sm mb-1">A B A⁻¹ （共轭）</div>
            <p className="text-sm text-cube-muted">例：把 R 转动放在 F 框架里执行 = <span className="font-mono">F R F'</span>（"共轭"换坐标系），效果上等同于在另一个面上做一次 R 类的旋转。</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">为什么 T-perm 阶为 2？</h2>
        <p className="text-cube-text/90 leading-relaxed mb-3">
          T-perm = "R U R' U' R' F R2 U' R' U' R U R' F'"。作用：
        </p>
        <ul className="space-y-1 text-cube-text/90 ml-6 list-disc leading-relaxed">
          <li>对角块：交换 UFR ↔ URB（一对 2-cycle，<b>奇置换</b>）</li>
          <li>对棱块：交换 UF ↔ UL（一对 2-cycle，<b>奇置换</b>）</li>
          <li>角块定向和棱块方向：不变</li>
        </ul>
        <p className="text-cube-text/90 leading-relaxed mt-3">
          两个奇置换的合成 = 偶置换，落在魔方群里。所以 T-perm 是合法转动。两次 = 恒等（T-perm 自反）。
        </p>
        <p className="text-cube-text/90 leading-relaxed mt-2 text-sm text-cube-muted">
          群论上：T-perm 在群 G 里阶为 2，它和它的共轭类生成了一个 Klein 四元群 V₄ ⊂ G。
        </p>
      </section>
    </div>
  )
}
