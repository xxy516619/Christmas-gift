import { create } from 'zustand';
import * as THREE from 'three';

// 定义全应用的状态类型
interface AppState {
  treeState: 'FORMED' | 'CHAOS'; // 树的状态：聚合 vs 散乱
  handPosition: THREE.Vector2;   // 手的位置
  isPinching: boolean;           // 是否捏合
  activePhotoIndex: number | null; // 当前激活的照片索引（如果有）
  
  // 修改状态的方法
  setTreeState: (state: 'FORMED' | 'CHAOS') => void;
  setHandPosition: (x: number, y: number) => void;
  setIsPinching: (isPinching: boolean) => void;
  setActivePhotoIndex: (index: number | null) => void;
}

// 创建状态仓库
export const useAppStore = create<AppState>((set) => ({
  treeState: 'FORMED', // 默认是聚合状态
  handPosition: new THREE.Vector2(0, 0),
  isPinching: false,
  activePhotoIndex: null,
  
  setTreeState: (state) => set({ treeState: state }),
  setHandPosition: (x, y) => set({ handPosition: new THREE.Vector2(x, y) }),
  setIsPinching: (isPinching) => set({ isPinching }),
  setActivePhotoIndex: (index) => set({ activePhotoIndex: index }),
}));