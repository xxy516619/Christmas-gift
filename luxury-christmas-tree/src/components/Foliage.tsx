import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { damp } from 'maath/easing';

// [修改1] 数量翻4倍，由 15000 -> 60000，解决“秃顶”问题
const COUNT = 200000; 

const foliageMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uLerp: { value: 0 }, 
        // [修改2] 调整配色，加入更深的墨绿和更嫩的亮绿，增强对比
        uColor1: { value: new THREE.Color('#002418') }, // 深处阴影绿
        uColor2: { value: new THREE.Color('#2dfc8f') }, // 梢头嫩绿
        uColorGold: { value: new THREE.Color('#fff0a0') }, // 闪烁金光
    },
    vertexShader: `
      uniform float uTime;
      uniform float uLerp;
      attribute vec3 aTargetPos;
      attribute float aRandom;
      attribute float aBranchIntensity; // [新增] 用于标记是否在树枝末端
      
      varying float vRandom;
      varying vec3 vPos;
      varying float vBranch; // 传递给片元着色器

      void main() {
        vRandom = aRandom;
        vBranch = aBranchIntensity;
        
        // 混合 Chaos(炸裂) 和 Target(树形) 状态
        vec3 pos = mix(position, aTargetPos, uLerp);
        
        // 风吹动效：外层叶子摆动幅度大，内层小
        float windStrength = (1.0 - uLerp) * 0.1 + aBranchIntensity * 0.05;
        pos.x += sin(uTime * 2.0 * aRandom + pos.y) * windStrength;
        pos.z += cos(uTime * 1.5 * aRandom + pos.y) * windStrength;
        
        vPos = pos;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        
        // [修改3] 动态点大小：树梢的叶子大一点，内部的小一点
        gl_PointSize = (12.0 + aBranchIntensity * 16.0) * (1.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColorGold;
      uniform float uTime;
      
      varying float vRandom;
      varying vec3 vPos;
      varying float vBranch;

      void main() {
        // 圆形粒子
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        // [修改4] 颜色渐变逻辑：基于 "距离树干的远近(vBranch)" 来决定颜色
        // vBranch 越接近 1 (树梢)，颜色越亮；越接近 0 (树干)，颜色越深
        vec3 baseColor = mix(uColor1, uColor2, vBranch * 0.8 + vRandom * 0.2);
        
        // 闪烁效果
        float sparkle = sin(uTime * 3.0 + vRandom * 20.0);
        // 只有树梢更容产生金色反光
        float sparkleThreshold = 0.98 - vBranch * 0.05; 
        
        vec3 finalColor = mix(baseColor, uColorGold, smoothstep(sparkleThreshold, 1.0, sparkle));
        
        gl_FragColor = vec4(finalColor, 0.9); // 稍微提高一点不透明度
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending, // 改回 NormalBlending 让体积感更强，Additive 会太亮太透
});

const Foliage = () => {
    const pointsRef = useRef<THREE.Points>(null);
    const treeState = useAppStore(state => state.treeState);
    const lerpTarget = useRef(1);

    const [chaosPositions, targetPositions, randoms, branchIntensities] = useMemo(() => {
        const cPos = new Float32Array(COUNT * 3);
        const tPos = new Float32Array(COUNT * 3);
        const rands = new Float32Array(COUNT);
        const branches = new Float32Array(COUNT);

        for (let i = 0; i < COUNT; i++) {
            // --- 1. Chaos 状态 (保持不变) ---
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = 20 + Math.random() * 10;
            cPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            cPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 5;
            cPos[i * 3 + 2] = r * Math.cos(phi);

            // --- 2. Target 树形状态 (核心重写) ---
            
            // 高度归一化 (0 到 1)
            // 我们让树稍微高一点点，分布在 -8 到 9 之间
            const hRatio = Math.random(); 
            const y = hRatio * 24 - 11; 

            // 基础圆锥半径 (下宽上窄)
            const baseRadius = (1.0 - hRatio) * 14;

            // [核心算法] 模拟树的分层 (Layering)
            // 使用正弦波创造 8-10 个“层级”，模拟一簇簇树枝
            const layers = 10;
            const layerWobble = Math.pow(Math.sin(hRatio * Math.PI * layers), 2);
            
            // 这一层最大的伸展半径
            // 基础半径 + 层级凸起
            const maxRadiusAtHeight = baseRadius * (0.7 + 0.4 * layerWobble);

            // 粒子的实际半径：
            // 不再是只在表面，而是填充在内部 (Volumetric)
            // Math.sqrt(Math.random()) 保证点均匀分布在圆面内，而不是聚集在中心
            // 我们让 70% 的点集中在外部 (树叶)，30% 在内部 (填充)
            const depth = Math.random();
            const rMultiplier = 0.3 + 0.7 * Math.sqrt(depth); 
            
            const radius = maxRadiusAtHeight * rMultiplier;
            const angle = Math.random() * Math.PI * 2;

            tPos[i * 3] = radius * Math.cos(angle);
            // 稍微给 Y 轴加一点随机扰动，让层级边缘不那么生硬
            tPos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.5; 
            tPos[i * 3 + 2] = radius * Math.sin(angle);

            // 随机属性
            rands[i] = Math.random();
            
            // [新增] 计算"树枝强度" (离中心越远，越接近树梢，强度越大)
            // 用于 Shader 里做颜色渐变：越靠外越亮，越靠内越黑
            branches[i] = (radius / (baseRadius + 0.1)); 
        }
        return [cPos, tPos, rands, branches];
    }, []);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;
        const material = pointsRef.current.material as THREE.ShaderMaterial;
        
        material.uniforms.uTime.value = state.clock.elapsedTime;
        lerpTarget.current = treeState === 'FORMED' ? 1 : 0;
        damp(material.uniforms.uLerp, 'value', lerpTarget.current, 0.25, delta);
    });

    return (
        <points ref={pointsRef} material={foliageMaterial}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={COUNT} args={[chaosPositions, 3]} />
                <bufferAttribute attach="attributes-aTargetPos" count={COUNT} args={[targetPositions, 3]} />
                <bufferAttribute attach="attributes-aRandom" count={COUNT} args={[randoms, 1]} />
                {/* 传入 branchIntensity 属性 */}
                <bufferAttribute attach="attributes-aBranchIntensity" count={COUNT} args={[branchIntensities, 1]} />
            </bufferGeometry>
        </points>
    );
};

export default Foliage;