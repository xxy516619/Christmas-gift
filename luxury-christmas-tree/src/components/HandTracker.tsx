import { useEffect, useRef } from 'react';
import { Hands, type Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { useAppStore } from '../store';

const TOTAL_PHOTOS = 89; // 照片总数

const HandTracker = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setTreeState = useAppStore((state) => state.setTreeState);
  const setHandPosition = useAppStore((state) => state.setHandPosition);
  const setIsPinching = useAppStore((state) => state.setIsPinching);
  const setActivePhotoIndex = useAppStore((state) => state.setActivePhotoIndex);

  const wasPinchingRef = useRef(false);

  const lastDetectionTime = useRef(0);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(onResults);

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            const now = Date.now();
            if (now - lastDetectionTime.current < 60) {
              return;
            }
            lastDetectionTime.current = now;

            try {
              await hands.send({ image: videoRef.current });
            }
            catch (e) {
              console.error('Hands send error:', e);
            }
          }
        },
        width: 640,
        height: 480,
      });

      setTimeout(() => {
        camera?.start().catch(err => console.error("Camera start failed:", err));
      }, 1000); // 延迟启动摄像头，确保用户有时间允许权限
    }
    
    // 清理函数
    return () => { hands.close(); };
  }, []);

  const onResults = (results: Results) => {
    // --- 1. 绘制手势骨架 (Debug View) ---
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // 清空画布
            
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                const width = canvas.width;
                const height = canvas.height;

                // 画连线 (Spring Green)
                ctx.strokeStyle = '#00ff7f'; 
                ctx.lineWidth = 2;
                for (const [start, end] of HAND_CONNECTIONS) {
                    const p1 = landmarks[start];
                    const p2 = landmarks[end];
                    ctx.beginPath();
                    ctx.moveTo(p1.x * width, p1.y * height);
                    ctx.lineTo(p2.x * width, p2.y * height);
                    ctx.stroke();
                }

                // 画关节点 (Luxury Gold)
                ctx.fillStyle = '#ffd700'; 
                for (const lm of landmarks) {
                    const x = lm.x * width;
                    const y = lm.y * height;
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    }
    // --- 2. 处理手势数据 ---
    if (!results.multiHandLandmarks.length) {
        setHandPosition(0, 0);
        setIsPinching(false);
        setActivePhotoIndex(null);
        wasPinchingRef.current = false;
        return;
    }

    const landmarks = results.multiHandLandmarks[0];

    // 1. 计算手掌中心 (用于旋转视角)
    const palmCenterX = (landmarks[0].x + landmarks[9].x) / 2;
    const palmCenterY = (landmarks[0].y + landmarks[9].y) / 2;
    // 映射坐标并反转 X 轴 (镜像效果)
    setHandPosition((palmCenterX - 0.5) * -2, (palmCenterY - 0.5) * 2);

    // 2. 检测张开/握拳 (切换状态)
    const fingertips = [8, 12, 16, 20]; 
    let avgDistance = 0;
    fingertips.forEach(tipIdx => {
        const dx = landmarks[tipIdx].x - landmarks[0].x;
        const dy = landmarks[tipIdx].y - landmarks[0].y;
        avgDistance += Math.sqrt(dx*dx + dy*dy);
    });
    avgDistance /= fingertips.length;
    
    if (avgDistance > 0.35) {
        setTreeState('CHAOS'); // 张开 -> 炸裂
    } else if (avgDistance < 0.25) {
        setTreeState('FORMED'); // 握拳 -> 聚合
    }

    // 3. 检测捏合 (放大照片)
    const pinchDx = landmarks[4].x - landmarks[8].x;
    const pinchDy = landmarks[4].y - landmarks[8].y;
    const pinchDistance = Math.sqrt(pinchDx*pinchDx + pinchDy*pinchDy);

    const isPinchingNow = pinchDistance < 0.1;

    setIsPinching(isPinchingNow);

    // 核心修改：检测状态跳变
    if (isPinchingNow && !wasPinchingRef.current) {
        // 刚刚开始捏合：随机选一张
        const randomIdx = Math.floor(Math.random() * TOTAL_PHOTOS);
        setActivePhotoIndex(randomIdx);
    } else if (!isPinchingNow && wasPinchingRef.current) {
        // 刚刚松开：重置
        setActivePhotoIndex(null);
    }

    wasPinchingRef.current = isPinchingNow;
  };

  return (
    // 悬浮小窗容器
    <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 160, // 宽度
        height: 120, // 高度 (4:3比例)
        borderRadius: 12,
        overflow: 'hidden',
        border: '2px solid rgba(255, 215, 0, 0.3)', // 淡金色边框
        boxShadow: '0 0 15px rgba(0,0,0,0.5)',
        zIndex: 50, // 保证在最上层
        background: 'rgba(0, 0, 0, 0.6)',
        pointerEvents: 'none' // 避免阻挡鼠标交互
    }}>
        {/* 摄像头画面 */}
        <video 
            ref={videoRef} 
            playsInline 
            style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                transform: 'scaleX(-1)' // 镜像翻转
            }} 
        />
        {/* 骨架绘制层 */}
        <canvas 
            ref={canvasRef}
            width={640} // 必须与 Camera 初始化分辨率一致
            height={480}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)' // 也要镜像翻转
            }}
        />
    </div>
  );
};

export default HandTracker;