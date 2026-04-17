<template>
  <div id="ol-map-container" class="map-container">
    <!-- 【新增】绘制工具栏 -->
    <div class="draw-toolbar">
      <el-button type="primary" size="small" @click="handleDraw('Point')">画点</el-button>
      <el-button type="success" size="small" @click="handleDraw('LineString')">画线</el-button>
      <el-button type="warning" size="small" @click="handleDraw('Polygon')">画面</el-button>
      <el-button type="info" size="small" @click="handleStopDraw">停止绘制</el-button>
    </div>

    <FeatureInfoPopup ref="featurePopup" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
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

// 【修改】解构出新增的绘制方法
const { addBusinessLayers, setupWatchers, addSelectInteraction, activateDraw, deactivateDraw } =
  useOlMap()

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
}

async function loadAllLayers() {
  try {
    const [pointData, lineData, polygonData] = await Promise.all([
      wfsApi.getFeatures('ogcforge:point'),
      wfsApi.getFeatures('ogcforge:string'),
      wfsApi.getFeatures('ogcforge:polygon'),
    ])
    layerStore.setPoint(pointData)
    layerStore.setLine(lineData)
    layerStore.setPolygon(polygonData)
    console.log('[OgcLab] 图层加载完成')
  } catch (err) {
    console.error('[OgcLab] WFS 加载失败', err)
  }
}

// 【新增】点击按钮触发绘制
function handleDraw(type) {
  activateDraw(mapInstance, type)
}

// 【新增】停止绘制
function handleStopDraw() {
  deactivateDraw(mapInstance)
}
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
  position: relative; /* 【修改】需要加上 relative，让工具栏的 absolute 生效 */
}

/* 【新增】工具栏样式 */
.draw-toolbar {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 999; /* 确保在地图之上 */
  background: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
</style>
