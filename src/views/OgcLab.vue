<template>
  <div id="ol-map-container" class="map-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { createTdtVecLayer, createTdtVecAnnoLayer } from '@/utils/baseLayerSources'
import { wfsApi } from '@/api/ogc/wfs'
import { useLayerStore } from '@/stores/layerStore'
import { useOlMap } from '@/composables/useOlMap'

let mapInstance = null
const layerStore = useLayerStore()
const { addBusinessLayers, setupWatchers } = useOlMap()

onMounted(async () => {
  initMap()
  setupWatchers()
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
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
}
</style>
