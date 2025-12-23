import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SNOW_COUNT = 3000; // 雪花数量

const Snow = () => {
  const pointsRef = useRef<THREE.Points>(null);

  // 1. 初始化雪花数据 (位置和下落速度)
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3);
    const vels = new Float32Array(SNOW_COUNT);
    
    for (let i = 0; i < SNOW_COUNT; i++) {
      // 在一个很大的空间内随机分布 [-25, 25]
      pos[i * 3] = (Math.random() - 0.5) * 50;     // x
      pos[i * 3 + 1] = Math.random() * 50;         // y (高度 0-50)
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50; // z
      
      // 随机下落速度
      vels[i] = Math.random() * 0.05 + 0.02;
    }
    return [pos, vels];
  }, []);

  // 2. 每一帧更新雪花位置
  useFrame(() => {
    if (!pointsRef.current) return;

    const positionAttribute = pointsRef.current.geometry.attributes.position;
    const currentPositions = positionAttribute.array as Float32Array;

    for (let i = 0; i < SNOW_COUNT; i++) {
      // 更新 Y 坐标（下落）
      currentPositions[i * 3 + 1] -= velocities[i];

      // 增加一点水平飘动 (基于正弦波)
      currentPositions[i * 3] += Math.sin(currentPositions[i * 3 + 1] * 0.1) * 0.005;

      // 边界检查：如果掉到地面以下 (-5)，就回到顶部 (50)
      if (currentPositions[i * 3 + 1] < -5) {
        currentPositions[i * 3 + 1] = 50;
        // 重新随机 X 和 Z，防止重复路径
        currentPositions[i * 3] = (Math.random() - 0.5) * 50;
        currentPositions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      }
    }
    
    // 告诉 Three.js 数据更新了
    positionAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={SNOW_COUNT}
          args={[positions, 3]}
        />
      </bufferGeometry>
      {/* 雪花材质：白色、半透明、不写深度(与其他光效融合更好) */}
      <pointsMaterial
        size={0.15}
        color="#ffffff"
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending} // 发光叠加模式，配合 Bloom
      />
    </points>
  );
};

export default Snow;