import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Star = (props: any) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // [核心修改] 手画一个标准的五角星
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.5; // 外圈半径 (星星的尖)
    const innerRadius = 0.9; // 内圈半径 (星星的凹槽)

    // 从顶部开始画线
    shape.moveTo(0, outerRadius);
    
    // 循环画出 10 个点 (5个尖 + 5个凹)
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      // 计算 x, y 坐标
      const x = Math.sin(angle) * radius;
      const y = Math.cos(angle) * radius;
      shape.lineTo(x, y);
    }
    shape.closePath();

    // 把二维形状挤压成 3D 模型
    const extrudeSettings = {
      steps: 1,
      depth: 0.8,       // 星星的厚度
      bevelEnabled: true, // 启用倒角 (让边缘圆润一点，反光更漂亮)
      bevelThickness: 0.2,
      bevelSize: 0.2,
      bevelSegments: 8, // 倒角平滑度
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // 依然保持旋转
      meshRef.current.rotation.y += delta * 0.5;
      // 依然保持上下浮动
      meshRef.current.position.y = props.position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} {...props} geometry={geometry} castShadow>
      {/* 调整中心点：因为 Extrude 默认是从 z=0 向前生长，我们需要稍微往回挪一点，让它居中 */}
      <meshStandardMaterial
        color="#ffd700"       // 纯金
        emissive="#ffd700"    // 自发光
        emissiveIntensity={0.6}
        metalness={0.9}       // 金属质感拉满
        roughness={0.1}       // 极其光滑
      />
      {/* 内部光源 */}
      <pointLight color="#ffd700" intensity={2} distance={15} decay={2} />
    </mesh>
  );
};

export default Star;