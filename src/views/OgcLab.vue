<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">OGC Forge</h1>
        <nav class="app-nav">
          <a href="#" class="nav-item active">地图实验室</a>
          <a href="#" class="nav-item">关于</a>
        </nav>
      </div>
      <div class="header-right">
        <button class="header-btn">
          <span class="btn-icon">🔄</span>
          <span>刷新图层</span>
        </button>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-title">图层管理</h3>
          <div class="layer-list">
            <div class="layer-item">
              <input
                type="checkbox"
                id="layer1"
                :checked="layerStore.layerVisibility.base"
                @change="handleLayerVisibility('base', $event.target.checked)"
              />
              <label for="layer1">底图</label>
            </div>
            <div class="layer-item">
              <input
                type="checkbox"
                id="layer2"
                :checked="layerStore.layerVisibility.point"
                @change="handleLayerVisibility('point', $event.target.checked)"
              />
              <label for="layer2">点要素</label>
            </div>
            <div class="layer-item">
              <input
                type="checkbox"
                id="layer3"
                :checked="layerStore.layerVisibility.line"
                @change="handleLayerVisibility('line', $event.target.checked)"
              />
              <label for="layer3">线要素</label>
            </div>
            <div class="layer-item">
              <input
                type="checkbox"
                id="layer4"
                :checked="layerStore.layerVisibility.polygon"
                @change="handleLayerVisibility('polygon', $event.target.checked)"
              />
              <label for="layer4">面要素</label>
            </div>
          </div>
        </div>
      </aside>

      <!-- 地图容器 -->
      <div id="ol-map-container" class="map-container">
        <!-- 绘制工具栏（横向） -->
        <div class="draw-toolbar-horizontal">
          <div
            v-for="tool in drawTools"
            :key="tool.type"
            :class="['tool-btn', { active: currentMode === tool.type }]"
            @click="handleDraw(tool.type)"
          >
            <span class="tool-icon">{{ tool.icon }}</span>
            <span>{{ tool.label }}</span>
          </div>
          <div :class="['tool-btn', { active: currentMode === 'modify' }]" @click="handleModify">
            <span class="tool-icon">✥</span>
            <span>修改</span>
          </div>
          <div class="tool-divider"></div>
          <div
            :class="['tool-btn', 'stop-btn', { active: currentMode === null }]"
            @click="handleStopDraw"
          >
            <span class="tool-icon">✕</span>
            <span>停止</span>
          </div>
        </div>

        <FeatureInfoPopup ref="featurePopup" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, provide } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { createTdtVecLayer, createTdtVecAnnoLayer } from '@/utils/baseLayerSources'
import { wfsApi } from '@/api/ogc/wfs'
import { useLayerStore } from '@/stores/layerStore'
import { useOlMap } from '@/composables/useOlMap'
import FeatureInfoPopup from '@/components/FeatureInfoPopup.vue'

let mapInstance = null
const layerStore = useLayerStore()
const featurePopup = ref(null)
const currentMode = ref(null)

// 【关键修复】提前声明 ref，在 setup 同步阶段 provide，解决子组件 inject 时序问题
const mapInstanceRef = ref(null)
provide('mapInstance', mapInstanceRef)

const {
  addBusinessLayers,
  setupWatchers,
  addSelectInteraction,
  activateDraw,
  deactivateDraw,
  deactivateModify,
  activateModify,
  setLayerVisibility,
} = useOlMap()

const drawTools = [
  { type: 'Point', label: '画点', icon: '◉' },
  { type: 'LineString', label: '画线', icon: '╱' },
  { type: 'Polygon', label: '画面', icon: '◇' },
]

onMounted(async () => {
  initMap()
  setupWatchers()
  addSelectInteraction(mapInstance, featurePopup)
  await loadAllLayers()
})

function initMap() {
  mapInstance = new Map({
    target: 'ol-map-container',
    layers: [createTdtVecLayer(), createTdtVecAnnoLayer()],
    view: new View({
      center: fromLonLat([116.4, 39.9]),
      zoom: 10,
    }),
  })
  addBusinessLayers(mapInstance)
  // 【关键修复】map 创建完成后，赋值给响应式变量，子组件就能拿到真实 map 了
  mapInstanceRef.value = mapInstance
}

const layerConfigs = [
  { typeName: 'ogcforge:point', setter: (data) => layerStore.setPoint(data) },
  { typeName: 'ogcforge:string', setter: (data) => layerStore.setLine(data) },
  { typeName: 'ogcforge:polygon', setter: (data) => layerStore.setPolygon(data) },
]

async function loadAllLayers() {
  try {
    const promises = layerConfigs.map((c) => wfsApi.getFeatures(c.typeName))
    const results = await Promise.all(promises)
    results.forEach((data, index) => layerConfigs[index].setter(data))
    console.log('[OgcLab] 图层加载完成')
  } catch (err) {
    console.error('[OgcLab] WFS 加载失败', err)
  }
}

function handleDraw(type) {
  currentMode.value = type
  activateDraw(mapInstance, type)
}

function handleModify() {
  currentMode.value = 'modify'
  activateModify(mapInstance)
}

function handleStopDraw() {
  currentMode.value = null
  deactivateDraw(mapInstance)
  deactivateModify(mapInstance)
}

// 处理图层显示/隐藏
function handleLayerVisibility(layerName, visible) {
  layerStore.setLayerVisibility(layerName, visible)
  setLayerVisibility(layerName, visible)
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 顶部导航栏 */
.app-header {
  height: 60px;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 1000;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: #1890ff;
  margin: 0;
}

.app-nav {
  display: flex;
  gap: 24px;
}

.nav-item {
  text-decoration: none;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.nav-item:hover {
  color: #1890ff;
  background-color: #ecf5ff;
}

.nav-item.active {
  color: #1890ff;
  background-color: #e6f7ff;
  border-bottom: 2px solid #1890ff;
}

.header-right {
  display: flex;
  gap: 12px;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.header-btn:hover {
  background-color: #e6f7ff;
  border-color: #1890ff;
  color: #1890ff;
}

.btn-icon {
  font-size: 14px;
}

/* 主要内容区域 */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧边栏 */
.sidebar {
  width: 240px; /* 因内容减少，稍微缩小宽度更协调 */
  background-color: #ffffff;
  border-right: 1px solid #e8e8e8;
  padding: 20px;
  overflow-y: auto;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
}

.sidebar-section {
  margin-bottom: 24px;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.layer-item:hover {
  background-color: #f5f5f5;
}

.layer-item input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.layer-item label {
  font-size: 13px;
  color: #666;
  cursor: pointer;
  flex: 1;
}

/* 地图容器 */
.map-container {
  flex: 1;
  position: relative;
  background-color: #f0f2f5;
}

/* 横向绘制工具栏 */
.draw-toolbar-horizontal {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 999;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 8px;
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-divider {
  width: 1px;
  height: 24px;
  background-color: #e4e7ed;
  margin: 0 4px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: #333;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
  user-select: none;
  border: 1px solid transparent;
}

.tool-btn:hover {
  background-color: #ecf5ff;
  color: #1890ff;
  border-color: #d6e8ff;
}

.tool-btn.active {
  background-color: #1890ff;
  color: #fff;
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
}

.tool-icon {
  font-size: 16px;
  line-height: 1;
  min-width: 20px;
  text-align: center;
}

.stop-btn {
  border: 1px solid #ffccc7;
  background-color: #fff2f0;
  color: #ff4d4f;
}

.stop-btn:hover {
  background-color: #fff1f0;
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.stop-btn.active {
  background-color: transparent;
  color: #999;
  border-color: transparent;
  box-shadow: none;
}

/* 滚动条样式 */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
