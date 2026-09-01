# MagicCube · 图论与魔方教学

交互式魔方 + 图论教学网站。从 2 阶到 4 阶、异形魔方，配套 3D 可视化、单步公式播放、Cayley 图。

## 启动

```bash
pnpm install
pnpm run dev        # http://localhost:5173
pnpm run build      # 产出 dist/
```

## 技术栈

- React 19 + TypeScript + Vite
- Three.js / @react-three/fiber / @react-three/drei — 3D 魔方
- cubejs — 魔方状态和 move 引擎
- d3 — Cayley 图可视化
- Tailwind CSS 3

## 内容

- `/` 首页
- `/3x3` 三阶魔方：单步 + 预设公式 + 自定义
- `/3x3/notation` Singmaster 记号系统（面 / 修饰符 / 双层 / M/S/E）
- `/3x3/algos` CFOP 公式拆解（OLL / PLL / 换位子 / 共轭）
- `/3x3/graph` Cayley 图 BFS + 群论事实
- `/2x2` Pocket Cube
- `/4x4` Revenge（奇偶性问题）
- `/shapes` 异形（Skewb / Pyraminx / Megaminx）

## 关键设计

- 3D 魔方：27 个 cubie，单层旋转用 group 临时包裹做补间动画
- OrbitControls：拖动旋转 + 缩放
- 公式逐步播放：队列 + pendingMove 状态机
- Cayley 图：d3 force simulation，BFS 出 1-3 步子图，可调生成集

## 文件结构

```
src/
  cube/
    state.ts        cubejs 包装
    algorithms.ts   公式库
  components/
    Cube3D.tsx      3D 渲染 + 单层动画 + 2D 展开图
  pages/
    Home.tsx
    Cube3x3.tsx
    Notation.tsx
    AlgorithmViz.tsx
    GraphTheory.tsx
    Cube2x2.tsx
    Cube4x4.tsx
    OtherShapes.tsx
  App.tsx           路由
  main.tsx
  index.css         Tailwind + 自定义
```
