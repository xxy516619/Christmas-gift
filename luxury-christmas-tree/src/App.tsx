import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Scene from './Scene';
import HandTracker from './components/HandTracker';
import { useAppStore } from './store';

import bgmUrl from './assets/bgm.flac';

function App() {
  const [started, setStarted] = useState(false);
  const treeState = useAppStore(s => s.treeState);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 👇 2. 初始化音频 (组件加载时执行一次)
  useEffect(() => {
    // 使用导入的 url 创建音频
    const audio = new Audio(bgmUrl);
    audio.loop = true;  // 循环播放
    audio.volume = 0.5; // 设置音量
    
    // 保存到 ref 以便后续控制
    audioRef.current = audio;

    // 清理函数：组件销毁时停止音乐
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const handleStart = () => {
    if (audioRef.current) {
        audioRef.current.volume = 0.5;
        // 打印一下，看看是不是真的执行了
        console.log("正在尝试播放音乐..."); 
        
        audioRef.current.play()
            .then(() => {
                console.log("✅ 播放成功！");
            })
            .catch(e => {
                // 如果这里报错，请截图发给我，这是关键线索
                console.error("❌ 播放失败，原因:", e);
            });
    }
    setStarted(true); // 切换界面
    
    
  };

  return (
    <div className="w-full h-full relative bg-black">
      
      {!started && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-luxury-gold">
            <h1 className="text-4xl md:text-6xl font-bold mb-8 tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">THE CHRISTMAS EVE</h1>
            <p className="text-lg md:text-xl mb-12 text-emerald-400 tracking-widest uppercase">Interactive Experience of Memory</p>
            <button onClick={handleStart} className="px-10 py-4 border border-yellow-500 text-yellow-500 text-xl hover:bg-yellow-500 hover:text-black transition-all duration-500 rounded-none tracking-widest uppercase">Enter Experience</button>
        </div>
      )}
      {started && (
        <>
          <HandTracker />
          <Canvas shadows dpr={[1, 2]} gl={{ antialias: false, stencil: false, alpha: false }}>
             <React.Suspense fallback={null}><Scene /></React.Suspense>
          </Canvas>
          <div className="absolute top-8 left-8 pointer-events-none z-20 text-left">
            <div className={`inline-block px-6 py-4 bg-black/40 backdrop-blur-md border border-white/10 transition-all duration-700 ${treeState === 'CHAOS' ? 'border-yellow-500/50 shadow-[0_0_50px_rgba(255,215,0,0.3)]' : ''}`}>
                <p className="text-l font-bold text-yellow-100 mb-1">{treeState === 'FORMED' ? '🖐️ OPEN HAND TO UNLEASH' : '✊ CLOSE FIST TO FORM'}</p>
            </div>
          </div>
        </>
      )}
      <Loader dataInterpolation={(p) => `Loading Assets... ${p.toFixed(0)}%`} />
    </div>
  );
}
export default App;