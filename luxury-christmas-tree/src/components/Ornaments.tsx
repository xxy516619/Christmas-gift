import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { damp } from 'maath/easing';

const TYPES = [
    { color: '#ffd700', scale: 0.5, weight: 0.1, roughness: 0.1, metalness: 1.0 }, // 金球
    { color: '#d40000', scale: 0.4, weight: 0.3, roughness: 0.3, metalness: 0.6 }, // 红球
    { color: '#ffffff', scale: 0.15, weight: 0.8, roughness: 0.1, metalness: 0.1, emissive: '#ffffee', emissiveIntensity: 2 }, // 灯光
];
const COUNT_PER_TYPE = 100;

const Ornaments = () => {
    const treeState = useAppStore(state => state.treeState);
    const meshesRef = useRef<THREE.InstancedMesh[]>([]);
    
    const instancesData = useMemo(() => {
        return TYPES.map((type) => {
            const chaosData = new Float32Array(COUNT_PER_TYPE * 3);
            const targetData = new Float32Array(COUNT_PER_TYPE * 3);
            const randoms = new Float32Array(COUNT_PER_TYPE);
            
            for (let i = 0; i < COUNT_PER_TYPE; i++) {
                // Chaos
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2 - 1);
                const r = 20 + Math.random() * 15;
                chaosData[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                chaosData[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 5;
                chaosData[i * 3 + 2] = r * Math.cos(phi);
                // Target
                const t = Math.random();
                const angle = Math.random() * Math.PI * 2;
                const radius = (1 - t) * 6.5;
                const height = t * 16 - 8;
                targetData[i * 3] = radius * Math.cos(angle);
                targetData[i * 3 + 1] = height + 6;
                targetData[i * 3 + 2] = radius * Math.sin(angle);
                randoms[i] = Math.random();
            }
            return { type, chaosData, targetData, randoms, lerpValues: new Float32Array(COUNT_PER_TYPE).fill(treeState === 'FORMED' ? 1 : 0) };
        });
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);
    const tempPos = useMemo(() => new THREE.Vector3(), []);

    useFrame((state, delta) => {
        const targetLerp = treeState === 'FORMED' ? 1 : 0;
        instancesData.forEach((data, typeIdx) => {
            const mesh = meshesRef.current[typeIdx];
            if (!mesh) return;
            for (let i = 0; i < COUNT_PER_TYPE; i++) {
                // 不同的重量导致飞行速度不同
                damp(data.lerpValues, i as any, targetLerp, 1.5 - data.type.weight, delta);
                const currentLerp = data.lerpValues[i];

                tempPos.set(
                    THREE.MathUtils.lerp(data.chaosData[i*3], data.targetData[i*3], currentLerp),
                    THREE.MathUtils.lerp(data.chaosData[i*3+1], data.targetData[i*3+1], currentLerp),
                    THREE.MathUtils.lerp(data.chaosData[i*3+2], data.targetData[i*3+2], currentLerp)
                );

                dummy.rotation.set(state.clock.elapsedTime * data.randoms[i], 0, 0);
                dummy.position.copy(tempPos);
                dummy.scale.setScalar(data.type.scale * (0.8 + data.randoms[i] * 0.4));
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        });
    });

    const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);

    return (
        <>
            {instancesData.map((data, i) => (
                <instancedMesh 
                    key={i} 
                    ref={el => meshesRef.current[i] = el!} 
                    args={[sphereGeo, undefined, COUNT_PER_TYPE]}
                    castShadow
                >
                    <meshStandardMaterial 
                        color={data.type.color}
                        metalness={data.type.metalness}
                        roughness={data.type.roughness}
                        emissive={data.type.emissive || '#000000'}
                        emissiveIntensity={data.type.emissiveIntensity || 0}
                        envMapIntensity={2}
                    />
                </instancedMesh>
            ))}
        </>
    );
};

export default Ornaments;