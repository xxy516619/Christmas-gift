import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { damp } from 'maath/easing';

const modules = import.meta.glob('../assets/*.jpg', { eager: true });

const PHOTO_URLS = Object.values(modules).map((mod: any) => mod.default);

const BASE_WIDTH = 3.2;
const BASE_HEIGHT = 4;

const CONE_SLOPE = Math.atan(6 / 16);



// 单个拍立得组件
const Polaroid = ({ url, index, treePos, treeRot, chaosPos }: { url: string, index: number, treePos: THREE.Vector3, treeRot: THREE.Euler, chaosPos: THREE.Vector3 }) => {
    const meshRef = useRef<THREE.Group>(null);

    const activePhotoIndex = useAppStore(state => state.activePhotoIndex);
    const isPinching = useAppStore(state => state.isPinching);
    const treeState = useAppStore(state => state.treeState);
    const { camera } = useThree();

    const tempPos = useMemo(() => new THREE.Vector3(), []);
    const tempDir = useMemo(() => new THREE.Vector3(), []);

    const randomRot = useMemo(() => new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    ), []);

    // 加载纹理
    const texture = useLoader(THREE.TextureLoader, url);

    

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        const isActive = (index === activePhotoIndex) && isPinching;

        // --- 目标状态计算 ---
        let targetPos = new THREE.Vector3();
        let targetScale = 0.4;
        let targetRot = new THREE.Euler();

        if (isActive) {
            // --- 激活态计算 ---
            // 1. 获取相机当前在世界中的绝对位置和朝向
            camera.getWorldPosition(tempPos);
            camera.getWorldDirection(tempDir);
            
            // 2. 计算目标点：相机位置 + 朝向向量 * 4 (距离镜头4米)
            tempPos.add(tempDir.multiplyScalar(4));

            // 3. 坐标系修正！
            // 因为在 Scene.tsx 里，Photos 组件被放在了 <group position={[0, -2, 0]}> 里
            // 所以我们计算出的世界坐标 Y 值，需要 +2 才能抵消父级的 -2 偏移，转回局部坐标
            tempPos.y += 2; 

            targetPos.copy(tempPos);

            // 4. 旋转归零
            // 配合 Scene.tsx 里的 "捏合时视角自动回正" 逻辑，
            // 当视角回正时，0度旋转的照片正好正对屏幕。
            targetRot.set(0, 0, 0);

            // 5. 动态计算缩放 (保证不出框)
            const cam = camera as THREE.PerspectiveCamera;
            // 距离固定为 4 了
            const distToCamera = 4;
            const vHeight = 2 * Math.tan((cam.fov * Math.PI) / 360) * distToCamera;
            const vWidth = vHeight * cam.aspect;

            // 留 20% 边距
            const maxScaleH = (vHeight * 0.8) / BASE_HEIGHT;
            const maxScaleW = (vWidth * 0.8) / BASE_WIDTH;
            targetScale = Math.min(maxScaleH, maxScaleW);
            
            // 微微悬浮呼吸感
            targetPos.y += Math.sin(state.clock.elapsedTime * 1.5) * 0.05;

        } else if (treeState === 'CHAOS') {
            // 目标位置设为预计算好的 chaosPos
            targetPos.copy(chaosPos);
            // 炸裂时旋转也随机，增加混乱感
            targetRot.copy(randomRot);
            // 稍微缩小一点，避免在远处太抢眼
            targetScale = 0.35;
        }
        else {
            // --- 默认态：乖乖挂在树上 ---
            targetPos.copy(treePos);
            targetScale = 0.3; 
            targetRot.copy(treeRot);
        }


        // --- 应用动画 ---
        damp(meshRef.current.position, 'x', targetPos.x, 0.25, delta);
        damp(meshRef.current.position, 'y', targetPos.y, 0.25, delta);
        damp(meshRef.current.position, 'z', targetPos.z, 0.25, delta);
        damp(meshRef.current.scale, 'x', targetScale, 0.2, delta);
        damp(meshRef.current.scale, 'y', targetScale, 0.2, delta);
        damp(meshRef.current.scale, 'z', targetScale, 0.2, delta);
        damp(meshRef.current.rotation, 'x', targetRot.x, 0.2, delta);
        damp(meshRef.current.rotation, 'y', targetRot.y, 0.2, delta);
        damp(meshRef.current.rotation, 'z', targetRot.z, 0.2, delta);
    });

    return (
        <group ref={meshRef}>
            {/* 拍立得白边框 */}
            <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[BASE_WIDTH, BASE_HEIGHT]} />
                <meshStandardMaterial color="#fffdf0" roughness={0.8} />
            </mesh>
            {/* 照片内容 */}
            <mesh position={[0, 0.4, 0.01]}>
                <planeGeometry args={[2.8, 2.8]} />
                {/* 1. 改用 StandardMaterial，让它受光照影响，不再自发光
                   2. color="#cccccc"：稍微把亮度压低到 80%，防止白色区域过曝产生辉光
                   3. roughness={0.5}：模拟相纸的质感，不要太光滑也不要太粗糙
                */}
                <meshStandardMaterial 
                    map={texture} 
                    color="#cccccc" 
                    roughness={0.5} 
                    metalness={0} 
                />
            </mesh>
        </group>
    );
};

const Photos = () => {
    // 预计算所有照片的位置和朝向
    const { treePositions, rotations, chaosPositions } = useMemo(() => {
        const dummy = new THREE.Object3D(); // 用于辅助计算旋转
        
        const tPosList: THREE.Vector3[] = [];
        const rotList: THREE.Euler[] = [];
        const cPosList: THREE.Vector3[] = [];

        PHOTO_URLS.forEach((_, i) => {
            const t = 0.2 + (i / PHOTO_URLS.length) * 0.7; 
            const angle = i * 2.4; 
            const radius = (1 - t) * 6 + 1.2;
            const height = t * 18 - 12;

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = height + 6;

            const tPos = new THREE.Vector3(x, y, z);
            
            // --- 计算朝向 ---
            dummy.position.copy(tPos);
            // 1. 让照片面朝外 (看向更远处的同方向点)
            dummy.lookAt(x * 2, y, z * 2); 
            // 2. 让照片后仰，匹配圆锥斜度 (绕X轴负向旋转)
            dummy.rotateX(-CONE_SLOPE);

            tPosList.push(tPos);
            rotList.push(dummy.rotation.clone());

            // --- 计算 chaos 状态位置 ---
            const theta = Math.random() * Math.PI * 2; // 水平角度
            const phi = Math.acos(Math.random() * 2 - 1); // 垂直角度
            // 半径范围设为 25 到 45，让照片飞得比树叶稍远一点，更有层次感
            const r = 15 + Math.random() * 10; 
            
            const cx = r * Math.sin(phi) * Math.cos(theta);
            const cy = r * Math.sin(phi) * Math.sin(theta) + 5; // 稍微抬高一点中心点
            const cz = r * Math.cos(phi);
            cPosList.push(new THREE.Vector3(cx, cy, cz));
        }); 


        return { treePositions: tPosList, rotations: rotList , chaosPositions: cPosList};
    }, []);

    if (PHOTO_URLS.length === 0) return null;

    return (
        <group>
            {PHOTO_URLS.map((url, i) => (
                <React.Suspense key={i} fallback={null}>
                    <Polaroid 
                        url={url} 
                        index={i} 
                        treePos={treePositions[i]} 
                        treeRot={rotations[i]} // 传入计算好的旋转
                        chaosPos={chaosPositions[i]}
                    />
                </React.Suspense>
            ))}
        </group>
    );
};

export default Photos;