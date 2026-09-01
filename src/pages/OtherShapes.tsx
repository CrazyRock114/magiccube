export function OtherShapes() {
  const shapes = [
    {
      name: 'Skewb',
      cn: '斜转魔方',
      size: '~6cm',
      pieces: '~30 个角块（无中心/棱块）',
      states: '约 3 × 10⁷',
      desc: '一个轴上切两刀，所有转动都通过 4 个角块绕对角线旋转。',
      facts: [
        '每个转动影响 4 个角块（4-cycle）',
        '没有棱块和中心，比 2×2 还简单',
        'Skewb = "skew" + "cube"，形状不规则',
        '解法：先找白/黄顶 → 一层层对齐 → 类比 CFOP 但无 PLL',
      ],
      moves: '4 个基本转动：R, U, L, B（每个都是 120° 角块旋转）',
    },
    {
      name: 'Pyraminx',
      cn: '金字塔魔方',
      size: '~10cm',
      pieces: '4 角 + 6 边 + 4 中心 = 14',
      states: '约 7.5 × 10⁸',
      desc: '四面体形状，每个面是三角形。每个面有 9 个 sticker（3×3），但 4 个角 + 6 个棱 = 10 个可动块。',
      facts: [
        '4 个角块独立旋转（互不影响，因为 tetrahedral symmetry）',
        '6 个棱块有"尖/钝"两种状态',
        '角块的 4-cycle 永远能消解（先归位 3 个，剩下 1 个自然归位）',
        '解法：先归位 4 个角（每角一个 L/R 转动），再调 6 个棱（tip 修正）',
      ],
      moves: '4 个基本转动：L, R, U, B（每个转动一个 tip）',
    },
    {
      name: 'Megaminx',
      cn: '五魔方',
      size: '~10cm',
      pieces: '20 角 + 30 边 + 12 中心',
      states: '约 10⁶³',
      desc: '12 面体魔方（dodecahedron），每个面是五边形。相当于 3×3 的"放大版"，但是五角对称。',
      facts: [
        '20 个角块（每角 3 个 sticker，120° 旋转 3 个方向）',
        '30 个棱块（5 × 6）',
        '没有奇偶性问题（角/棱置换必须满足整体约束）',
        '5 倍的 CFOP 算法量',
      ],
      moves: '与 3×3 类似，但因为 5 倍对称，OLL/PLL 各有 ~5 倍数量',
    },
  ]

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/shapes</div>
        <h1 className="h1">异形魔方</h1>
        <p className="lead">标准 3×3 之外，几何变化无穷无尽。这里介绍最常见的三种。</p>
      </header>

      {shapes.map(s => (
        <section key={s.name} className="card">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="h2">{s.name}</h2>
              <div className="text-sm text-cube-muted">{s.cn}</div>
            </div>
            <div className="text-right text-xs text-cube-muted font-mono">
              <div>{s.size}</div>
              <div>{s.pieces}</div>
              <div className="text-cube-accent">{s.states} 状态</div>
            </div>
          </div>

          <p className="text-cube-text/90 leading-relaxed mb-3">{s.desc}</p>

          <div className="mb-3">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-1 font-mono">特征</div>
            <ul className="space-y-1 text-cube-text/90 ml-5 list-disc leading-relaxed text-sm">
              {s.facts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>

          <div className="text-xs text-cube-muted font-mono">
            <b className="text-cube-text">基本转动</b>: {s.moves}
          </div>
        </section>
      ))}

      <section className="card">
        <h2 className="h3 mb-3">更多异形</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
            <div className="font-semibold mb-1">Square-1 (SQ-1)</div>
            <div className="text-xs text-cube-muted">形状变形魔方，能从方变到非方。CFOP 不直接适用。</div>
          </div>
          <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
            <div className="font-semibold mb-1">Gear Cube (齿轮魔方)</div>
            <div className="text-xs text-cube-muted">所有面转动时齿轮咬合，初始看起来复杂实际很简单。</div>
          </div>
          <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
            <div className="font-semibold mb-1">Floppy Cube (1×3)</div>
            <div className="text-xs text-cube-muted">最简单，6 个状态。</div>
          </div>
          <div className="p-3 rounded border border-cube-border bg-cube-bg/50">
            <div className="font-semibold mb-1">5×5, 6×6, 7×7 (专家)</div>
            <div className="text-xs text-cube-muted">同 4×4 思路，更多 parity。</div>
          </div>
        </div>
      </section>
    </div>
  )
}
