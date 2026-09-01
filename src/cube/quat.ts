// 四元数 (x, y, z, w) 工具函数。用于 N×N 魔方的 cubie 旋转。

export type Quat = [number, number, number, number]
export type Vec3 = [number, number, number]

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1]

// 绕单轴旋转 π/2 的四元数
export function quatFromAxisAngle(axis: 'x' | 'y' | 'z', angle: number): Quat {
  const half = angle / 2
  const s = Math.sin(half)
  const c = Math.cos(half)
  switch (axis) {
    case 'x': return [s, 0, 0, c]
    case 'y': return [0, s, 0, c]
    case 'z': return [0, 0, s, c]
  }
}

// 四元数乘法 (a * b)
export function multiplyQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

// 用四元数旋转向量
export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const [x, y, z] = v
  const [qx, qy, qz, qw] = q
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * z - qz * y)
  const ty = 2 * (qz * x - qx * z)
  const tz = 2 * (qx * y - qy * x)
  // v + qw * t + cross(q.xyz, t)
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ]
}

// 旋转 grid position 绕指定轴 (counter-clockwise 90°，从 +axis 方向看)
// R 转动 = 绕 +X 轴 -90° (CW from +X view) = CCW 3 个 quarter
// 这里我们处理 1/2/3 个 90° CCW 增量。
//
// 标准右手定则 (绕 +X 逆时针 90° = +Y 转到 +Z)：
//   (x, y, z) → (x, -z, y)  -- 但这与 R 转动不一致！
//
// R 实际转动：UR (1,1,0) → BR (1,0,-1)。「CW from +X view」 = 绕 +X 轴 -90°：
//   矩阵: (x, y, z) → (x, z, -y)
//
// 我把所有 move 都定义成"绕 +axis 顺时针 quarter"（CW from +axis 视角）：
//   X axis CW: (x, y, z) → (x, z, -y)
//   Y axis CW: (x, y, z) → (-z, y, x)
//   Z axis CW: (x, y, z) → (y, -x, z)
//
// turns 参数是 1/2/3 个 quarter。
export function rotateGrid90(pos: Vec3, axis: 'x' | 'y' | 'z', turns: 1 | 2 | 3): Vec3 {
  const [x, y, z] = pos
  const xi = Math.round(x * 2)
  const yi = Math.round(y * 2)
  const zi = Math.round(z * 2)

  let rxi = xi, ryi = yi, rzi = zi
  for (let t = 0; t < turns; t++) {
    let nx: number, ny: number, nz: number
    switch (axis) {
      // 绕 +X 顺时针 (CW from +X) = (x, z, -y)
      case 'x': nx = rxi; ny = rzi; nz = -ryi; break
      // 绕 +Y 顺时针 (CW from +Y) = (-z, y, x)
      case 'y': nx = -rzi; ny = ryi; nz = rxi; break
      // 绕 +Z 顺时针 (CW from +Z) = (y, -x, z)
      case 'z': nx = ryi; ny = -rxi; nz = rzi; break
    }
    rxi = nx; ryi = ny; rzi = nz
  }
  return [rxi / 2, ryi / 2, rzi / 2]
}

// 把 float position round 到最近的 half-integer (防止累积误差)
export function snapPos(p: Vec3): Vec3 {
  return [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2, Math.round(p[2] * 2) / 2]
}
