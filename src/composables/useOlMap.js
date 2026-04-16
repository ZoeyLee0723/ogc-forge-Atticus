import { watch } from 'vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { GeoJSON } from 'ol/format'
import { useLayerStore } from '@/stores/layerStore'
import { getPointStyle, getLineStyle, getPolygonStyle } from '@/utils/featureStyles'
import Select from 'ol/interaction/Select' // 新增：选择交互

export function useOlMap() {
  const layerStore = useLayerStore()
  const format = new GeoJSON()

  // 1. 创建三个业务矢量图层，各自绑定样式
  const pointLayer = new VectorLayer({
    source: new VectorSource(),
    style: getPointStyle(),
  })
  const lineLayer = new VectorLayer({
    source: new VectorSource(),
    style: getLineStyle(),
  })
  const polygonLayer = new VectorLayer({
    source: new VectorSource(),
    style: getPolygonStyle(),
  })

  // 2. 挂载到地图上
  function addBusinessLayers(map) {
    // 注意叠加顺序：面在下，线在中，点在上
    map.addLayer(polygonLayer)
    map.addLayer(lineLayer)
    map.addLayer(pointLayer)
  }

  // 3. 监听 Store → 自动渲染到 OL
  // 核心架构：Vue 管数据，OL 管渲染，watch 是桥梁
  function setupWatchers() {
    // 投影转换配置对象（提炼出来，避免写重复代码）
    const projectionOpts = {
      dataProjection: 'EPSG:4326', // 告诉 OL：从 GeoServer 拿到的数据是经纬度
      featureProjection: 'EPSG:3857', // 告诉 OL：要画在天地图(3857)上
    }

    watch(
      () => layerStore.pointGeoJson,
      (geojson) => {
        if (geojson) {
          pointLayer.getSource().clear()
          pointLayer.getSource().addFeatures(format.readFeatures(geojson, projectionOpts))
        }
      },
    )

    watch(
      () => layerStore.lineGeoJson,
      (geojson) => {
        if (geojson) {
          lineLayer.getSource().clear()
          lineLayer.getSource().addFeatures(format.readFeatures(geojson, projectionOpts))
        }
      },
    )

    watch(
      () => layerStore.polygonGeoJson,
      (geojson) => {
        if (geojson) {
          polygonLayer.getSource().clear()
          polygonLayer.getSource().addFeatures(format.readFeatures(geojson, projectionOpts))
        }
      },
    )
  }
  // 4. 添加选择交互（战役二核心）
  function addSelectInteraction(map, featurePopup) {
    const select = new Select({
      layers: [pointLayer, lineLayer, polygonLayer], // 监听所有业务图层
      style: (feature) => {
        // 选中时高亮（可选）
        return getPointStyle() // 这里用点样式举例，可根据类型调整
      },
    })

    // 监听选择事件
    select.on('select', (event) => {
      const selectedFeatures = event.selected
      if (selectedFeatures.length > 0) {
        const feature = selectedFeatures[0] // 取第一个选中的要素
        featurePopup.value.showFeaturePopup(feature) // 触发弹窗显示
      }
    })

    map.addInteraction(select)
  }

  return {
    addBusinessLayers,
    setupWatchers,
    pointLayer,
    lineLayer,
    polygonLayer,
    addSelectInteraction,
  }
}
