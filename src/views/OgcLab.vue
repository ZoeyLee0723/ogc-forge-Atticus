<template>
  <div id="ol-map-container" class="map-container">
    <!-- 美化后的工具栏 -->
    <div class="draw-toolbar">
      <!-- 循环渲染绘制按钮 -->
      <div
        v-for="tool in drawTools"
        :key="tool.type"
        :class="['tool-btn', { active: currentMode === tool.type }]"
        @click="handleDraw(tool.type)"
      >
        <span class="tool-icon">{{ tool.icon }}</span>
        <span>{{ tool.label }}</span>
      </div>
      <!-- 修改按钮 -->
      <div :class="['tool-btn', { active: currentMode === 'modify' }]" @click="handleModify">
        <span class="tool-icon">✥</span>
        <span>修改</span>
      </div>
      <!-- 分隔线 -->
      <div class="tool-divider"></div>

      <!-- 停止按钮 -->
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
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
  position: relative;
}

.draw-toolbar {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 999;
  background: rgba(255, 255, 255, 0.95);
  padding: 6px;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #333;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  user-select: none;
  gap: 6px;
}

.tool-icon {
  font-size: 16px;
  line-height: 1;
}

.tool-btn:hover {
  background-color: #ecf5ff;
  color: #409eff;
}

.tool-btn.active {
  background-color: #409eff;
  color: #fff;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.4);
}

.tool-divider {
  width: 1px;
  height: 24px;
  background-color: #e4e7ed;
  margin: 0 4px;
}

.stop-btn:hover {
  background-color: #fef0f0;
  color: #f56c6c;
}
.stop-btn.active {
  background-color: transparent;
  color: #999;
  box-shadow: none;
}
</style>
