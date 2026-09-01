import { Link } from 'react-router-dom'

export function Home() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">MagicCube Lab</div>
        <h1 className="h1">
          图论与<span className="text-cube-accent">魔方</span>教学
        </h1>
        <p className="lead max-w-3xl">
          从 2 阶到 4 阶、从标准魔方到异形魔方，配套 3D 可视化、单步播放、图论视角（Cayley 图 / 群作用 / 奇偶性）。
          重点拆解 3 阶魔方的多种公式与原理。
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <Card to="/3x3" title="三阶魔方（重点）" desc="完整记号系统 + CFOP 公式可视化 + Cayley 图" color="cube-accent" />
        <Card to="/3x3/notation" title="记号系统" desc="Singmaster 记号、面、层、转动方向" color="green-400" />
        <Card to="/3x3/algos" title="公式拆解" desc="Sune、T-perm、Y-perm、H-perm 等逐步播放" color="yellow-400" />
        <Card to="/3x3/graph" title="图论视角" desc="魔方群 / Cayley 图 / 换位子 / 共轭类" color="purple-400" />
        <Card to="/2x2" title="二阶 Pocket Cube" desc="仅角块，3.7×10⁶ 状态" color="orange-400" />
        <Card to="/4x4" title="四阶 Revenge" desc="奇偶性问题（PLL/OLL parity）" color="red-400" />
        <Card to="/shapes" title="异形魔方" desc="Skewb、Pyraminx、Megaminx 的几何" color="cyan-400" />
      </section>

      <section className="card">
        <h2 className="h2 mb-3">这个网站在做什么</h2>
        <ul className="space-y-2 text-cube-text/90 leading-relaxed">
          <li>· <b>可视化演示</b>：3D 魔方（可拖动视角、缩放），单步动画播放任意公式</li>
          <li>· <b>原理讲解</b>：每个面的转动如何影响其他面，layer 旋转的群论含义</li>
          <li>· <b>3D 视角切换</b>：OrbitControls 自由旋转、缩放</li>
          <li>· <b>图论拆解</b>：魔方所有合法状态 + 18 个基本转动 = Cayley 图上的 BFS/最短路</li>
          <li>· <b>公式教学</b>：CFOP 每个 PLL/OLL 的换位子 / 共轭结构</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">建议学习路径</h2>
        <ol className="space-y-2 text-cube-text/90 list-decimal pl-6 leading-relaxed">
          <li><Link to="/3x3/notation" className="text-cube-accent hover:underline">先学记号</Link> — 不会读 R U R' U' 就没法看公式</li>
          <li>去 <Link to="/3x3" className="text-cube-accent hover:underline">三阶页</Link> 看一个 R 转动影响了哪些块</li>
          <li>在 <Link to="/3x3/algos" className="text-cube-accent hover:underline">公式拆解</Link> 单步播放 Sune / T-perm</li>
          <li>看 <Link to="/3x3/graph" className="text-cube-accent hover:underline">图论视角</Link> 理解为什么 Sune 阶 6、T-perm 阶 2</li>
          <li>对比 <Link to="/2x2" className="text-cube-accent hover:underline">二阶</Link> 和 <Link to="/4x4" className="text-cube-accent hover:underline">四阶</Link>：群论结构变了什么</li>
        </ol>
      </section>
    </div>
  )
}

function Card({ to, title, desc, color }: { to: string; title: string; desc: string; color: string }) {
  return (
    <Link to={to} className="card hover:border-cube-accent/50 transition-colors group">
      <div className={`text-xs uppercase tracking-widest text-${color} mb-1 font-mono`}>{to}</div>
      <div className="text-lg font-semibold mb-1 group-hover:text-cube-accent transition-colors">{title}</div>
      <div className="text-sm text-cube-muted leading-relaxed">{desc}</div>
    </Link>
  )
}
