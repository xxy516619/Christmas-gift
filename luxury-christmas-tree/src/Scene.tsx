import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera, OrbitControls, Stars, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useAppStore } from './store';
import { damp } from 'maath/easing';
import Foliage from './components/Foliage';
import Ornaments from './components/Ornaments';
import Photos from './components/Photos';
import Snow from './components/Snow';
import Star from './components/Star';

const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf';

const Scene = () => {
    const handPosition = useAppStore(state => state.handPosition);
    const isPinching = useAppStore(state => state.isPinching);
    const cameraRigRef = useRef<THREE.Group>(null);
    const { camera } = useThree();

    const lookAtTarget = useRef(new THREE.Vector3(0, 6, 0));

    // --- 惯性旋转核心变量 ---
    const lastHandX = useRef(0);      // 上一帧手的位置
    const rotationVelocity = useRef(0); // 当前旋转速度 (弧度/帧)
    const treeRotationY = useRef(0);    // 树当前的累计角度

    useFrame((state, delta) => {
        if (cameraRigRef.current) {
            // 1. 计算手移动的距离 (Delta)
            // 这里的 0.05 是归一化坐标的位移，乘以系数放大
            const moveDelta = handPosition.x - lastHandX.current;

            // 2. [关键] 判断是“正常挥动”还是“丢失归零”
            // 如果一帧之内跳变太大 (>0.1)，说明是手移出屏幕导致的归零，忽略这次跳变，保持之前的惯性
            const isTrackingLost = Math.abs(moveDelta) > 0.1;
            const isHandStatic = handPosition.x === 0 && lastHandX.current === 0; // 手不在屏幕上

            if (!isPinching && !isTrackingLost && !isHandStatic) {
                // [交互中]：直接把手的速度传给树
                // 乘以 -5.0 是灵敏度系数：手划过半个屏幕，树能转好几圈
                // 负号是为了符合直觉：往左拨，树往左转
                rotationVelocity.current = moveDelta * -5.0;
            } else {
                // [未交互/惯性中]：没有输入时，应用摩擦力减速
                // 0.95 代表每帧损失 5% 速度，数值越大滑得越远
                rotationVelocity.current *= 0.95;
            }

            // 3. 应用速度
            treeRotationY.current += rotationVelocity.current;

            // 4. 更新摄像机组旋转
            // 捏合时强制归零(看照片)，否则使用累计角度
            const targetRotationY = isPinching ? 0 : treeRotationY.current;
            
            // 使用 damp 平滑插值，让画面更丝滑
            damp(cameraRigRef.current.rotation, 'y', targetRotationY, 0.1, delta);
            
            // X轴 (上下视角) 依然保持简单的跟随，不需要惯性
            const targetRotationX = isPinching ? 0 : -handPosition.y * Math.PI * 0.15;
            damp(cameraRigRef.current.rotation, 'x', targetRotationX, 0.2, delta);

            // 5. 记录上一帧位置
            // 如果追踪丢失，就不要更新 lastHandX，防止下一帧计算出错
            if (!isTrackingLost) {
                lastHandX.current = handPosition.x;
            }
        }

        const targetFov = isPinching ? 50 : 60;
        damp(camera, 'fov', targetFov, 0.2, delta);
        camera.updateProjectionMatrix();
        const targetLookAtX = isPinching ? 0 : handPosition.x * 5;
        const targetLookAtY = isPinching ? 4 : (6 + handPosition.y * 5);
        const targetLookAtZ = 0;
        damp(lookAtTarget.current, 'x', targetLookAtX, 0.2, delta);
        damp(lookAtTarget.current, 'y', targetLookAtY, 0.2, delta);
        damp(lookAtTarget.current, 'z', targetLookAtZ, 0.2, delta);
        state.camera.lookAt(lookAtTarget.current);
        // state.camera.lookAt(targetLookAtX, targetLookAtY, 0); //
    });

    return (
        <>
            <color attach="background" args={['#020204']} />
            <fog attach="fog" args={['#020204', 30, 100]} />

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            <Text
                font={FONT_URL} // 使用在线花体字
                position={[0, 35, -50]} // 放在高空背景远处
                fontSize={15} // 巨大字体
                color="#ffd700" // 金色
                anchorX="center"
                anchorY="middle"
                fillOpacity={0.6} // 稍微透明一点，融入背景
            >
                Merry Christmas
            </Text>

            <group ref={cameraRigRef}><PerspectiveCamera makeDefault position={[0, 4, 20]} fov={60} /></group>
            <Environment preset="lobby" background={false} blur={0.6} />
            <ambientLight intensity={0.1} color="#00ff7f" />
            <spotLight position={[10, 30, 20]} angle={0.3} penumbra={1} intensity={2} color="#ffd700" castShadow />
            <pointLight position={[-10, -5, -10]} intensity={1} color="#004b35" />
            <Snow />
            <group position={[0, -2, 0]}>
                <Star position={[0, 16, 0]} />
                <Foliage />
                <Ornaments />
                <Photos />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
                    <planeGeometry args={[100, 100]} />
                    <meshStandardMaterial color="#001a12" metalness={0.9} roughness={0.1} envMapIntensity={1.5} />
                </mesh>
            </group>
            <EffectComposer>
                <Bloom luminanceThreshold={0.65} mipmapBlur intensity={1.5} radius={0.7} levels={8} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
            <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 2.5} />
        </>
    );
};
export default Scene;