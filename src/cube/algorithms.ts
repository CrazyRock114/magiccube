// 3x3 算法集（CFOP + 基础 + 异形概念）
export interface Algo {
  name: string
  notation: string
  category: 'OLL' | 'PLL' | 'F2L' | 'basic' | 'commutator' | 'conjugate'
  description: string
  order: number
  group: string
}

export const ALGORITHMS: Algo[] = [
  // Basic
  { name: 'Sexy (R U R\' U\')', notation: "R U R' U'", category: 'basic', description: '六个面最常用的小循环，对角三层+棱块', order: 6, group: '基础' },
  { name: 'Sune', notation: "R U R' U R U2 R'", category: 'OLL', description: '顶面定向最基础 OLL', order: 6, group: 'OLL' },
  { name: 'Anti-Sune', notation: "L' U' L U' L' U2 L", category: 'OLL', description: 'Sune 的对偶', order: 6, group: 'OLL' },
  { name: 'Sune × 3 = Anti-Sune', notation: "R U R' U R U2 R'", category: 'commutator', description: 'Sune 阶为 6，三次后等价于 Anti-Sune', order: 6, group: '群论' },

  // PLL
  { name: 'T-perm', notation: "R U R' U' R' F R2 U' R' U' R U R' F'", category: 'PLL', description: '交换一对棱 + 一对角，自反', order: 2, group: 'PLL' },
  { name: 'Y-perm', notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'", category: 'PLL', description: 'Y 形边循环（4 棱循环 + 1 对角互换）', order: 2, group: 'PLL' },
  { name: 'H-perm', notation: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", category: 'PLL', description: '对侧两棱互换', order: 2, group: 'PLL' },
  { name: 'U-perm (Ub)', notation: "R U' R U R U R U' R' U' R2", category: 'PLL', description: '三棱 3-cycle', order: 3, group: 'PLL' },
  { name: 'A-perm (Ab)', notation: "R U R' U R' F R F' U' R F R' F' R U' R'", category: 'PLL', description: 'A 形顶角 + 边循环', order: 3, group: 'PLL' },
  { name: 'J-perm (Ja)', notation: "R U R' F' R U R' U' R' F R2 U' R'", category: 'PLL', description: 'J 形角循环', order: 3, group: 'PLL' },
  { name: 'R-perm', notation: "R U' R' U' R U R D R' U' R D' R' U2 R'", category: 'PLL', description: 'R 形邻角互换', order: 2, group: 'PLL' },

  // Commutator / Conjugate
  { name: '[R,U] = R U R\' U\'', notation: "R U R' U'", category: 'commutator', description: 'R 与 U 的对易子，6 阶', order: 6, group: '换位子' },
  { name: '[R,U]³ = (R U R\' U\')³ = I', notation: "R U R' U' R U R' U' R U R' U'", category: 'commutator', description: '3 阶循环 = I', order: 1, group: '换位子' },
  { name: 'F R F\' (conjugate)', notation: "F R F'", category: 'conjugate', description: 'F 共轭 R = 把 R 旋转"挪到"其他面', order: 4, group: '共轭' },
  { name: 'F L F\' (conjugate)', notation: "F L F'", category: 'conjugate', description: 'F 共轭 L', order: 4, group: '共轭' },

  // OLL
  { name: 'Cross', notation: "F R U R' U' F'", category: 'OLL', description: 'OLL 21 形之一，十字变顶面', order: 6, group: 'F2L/OLL' },
  { name: 'Anti-Cross', notation: "F R U R' U' R U R' U' R U R' U' F'", category: 'OLL', description: 'Anti-Cross = Sexy × 3', order: 6, group: 'F2L/OLL' },
]

// 2x2 算法（Pocket Cube）
export const ALGORITHMS_2X2: Algo[] = [
  { name: 'Sune (2x2)', notation: "R U R' U R U2 R'", category: 'OLL', description: '2x2 主 OLL', order: 6, group: '2x2 OLL' },
  { name: 'Anti-Sune (2x2)', notation: "R' U' R U' R' U2 R", category: 'OLL', description: '2x2 反向 Sune', order: 6, group: '2x2 OLL' },
  { name: 'T-perm (2x2)', notation: "R U R' U' R' F R2 U' R' U' R U R' F'", category: 'PLL', description: '2x2 等价于相邻角互换', order: 2, group: '2x2 PLL' },
  { name: 'Y-perm (2x2)', notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'", category: 'PLL', description: '2x2 对角互换', order: 2, group: '2x2 PLL' },
  { name: 'Sexy (2x2)', notation: "R U R' U'", category: 'basic', description: '2x2 顶层小循环', order: 6, group: '基础' },
]

// 4x4 特殊（奇偶）
export const ALGORITHMS_4X4: Algo[] = [
  { name: 'Edge pairing (basic)', notation: "R U R' F' R U R' U' R' F R2 U' R'", category: 'basic', description: '4x4 配对基础', order: 3, group: '4x4 配对' },
  { name: 'OLL parity fix', notation: "r U2 r2 U2 r2 U2 r U2", category: 'commutator', description: '4x4 顶层奇偶修正（单边宽转）', order: 2, group: '4x4 奇偶' },
  { name: 'PLL parity fix', notation: "r2 U2 r2 Uw2 r2 Uw2 U2", category: 'commutator', description: '4x4 PLL 奇偶修正（双边宽转）', order: 2, group: '4x4 奇偶' },
]
