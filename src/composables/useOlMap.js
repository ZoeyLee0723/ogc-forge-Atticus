import { watch } from 'vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { GeoJSON } from 'ol/format'
import { useLayerStore } from '@/stores/layerStore'
import { getPointStyle, getLineStyle, getPolygonStyle } from '@/utils/featureStyles'
import Select from 'ol/interaction/Select'
import Draw from 'ol/interaction/Draw'
import { wfsApi } from '@/api/ogc/wfs'

export function useOlMap() {
  const layerStore = useLayerStore()
  const format = new GeoJSON()

  let currentDraw = null

  // ==================== 1. 创建三个业务矢量图层 ====================
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

  // ==================== 2. 挂载到地图上 ====================
  function addBusinessLayers(map) {
    map.addLayer(polygonLayer)
    map.addLayer(lineLayer)
    map.addLayer(pointLayer)
  }

  // ==================== 3. 监听 Store → 自动渲染到 OL ====================
  function setupWatchers() {
    const projectionOpts = {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
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

  // ==================== 4. 添加选择交互 ====================
  function addSelectInteraction(map, featurePopup) {
    const select = new Select({
      layers: [pointLayer, lineLayer, polygonLayer],
      style: (feature) => {
        return getPointStyle()
      },
    })

    select.on('select', (event) => {
      const selectedFeatures = event.selected
      if (selectedFeatures.length > 0) {
        const feature = selectedFeatures[0]
        featurePopup.value.showFeaturePopup(feature)
      }
    })

    map.addInteraction(select)
  }

  // ==================== 5. 手动拼接 WFS-T XML ====================
  /**
   * 根据 feature 拼出一段标准的 WFS-T Insert XML
   * @param {ol.Feature} feature - 已经转成 4326 的要素
   * @param {string} layerName - GeoServer 图层名 (如 'point')
   * @returns {string} 完整的 WFS-T XML 字符串
   */
  function buildInsertXml(feature, layerName) {
    const geometry = feature.getGeometry()
    const geoType = geometry.getType()
    const coords = geometry.getCoordinates()

    // 根据不同几何类型，拼出对应的 GML 几何标签
    let gmlGeom = ''
    if (geoType === 'Point') {
      gmlGeom = `<ogcforge:geom>
          <gml:Point srsName="EPSG:4326">
            <gml:coordinates decimal="." cs="," ts=" ">${coords[0]},${coords[1]}</gml:coordinates>
          </gml:Point>
        </ogcforge:geom>`
    } else if (geoType === 'LineString') {
      const coordStr = coords.map((c) => `${c[0]},${c[1]}`).join(' ')
      gmlGeom = `<ogcforge:geom>
          <gml:LineString srsName="EPSG:4326">
            <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
          </gml:LineString>
        </ogcforge:geom>`
    } else if (geoType === 'Polygon') {
      const coordStr = coords[0].map((c) => `${c[0]},${c[1]}`).join(' ')
      gmlGeom = `<ogcforge:geom>
          <gml:Polygon srsName="EPSG:4326">
            <gml:outerBoundaryIs>
              <gml:LinearRing>
                <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
              </gml:LinearRing>
            </gml:outerBoundaryIs>
          </gml:Polygon>
        </ogcforge:geom>`
    }

    // 拼装完整的 WFS Transaction
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction
  service="WFS"
  version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs"
  xmlns:ogcforge="http://www.ogcforge.com"
  xmlns:gml="http://www.opengis.net/gml">
  <wfs:Insert>
    <ogcforge:${layerName}>
      ${gmlGeom}
    </ogcforge:${layerName}>
  </wfs:Insert>
</wfs:Transaction>`
  }

  // ==================== 6. 绘制 + 发送 WFS-T ====================
  function activateDraw(map, type) {
    deactivateDraw(map)

    let targetSource = null
    let layerName = ''

    if (type === 'Point') {
      targetSource = pointLayer.getSource()
      layerName = 'point'
    } else if (type === 'LineString') {
      targetSource = lineLayer.getSource()
      layerName = 'string'
    } else if (type === 'Polygon') {
      targetSource = polygonLayer.getSource()
      layerName = 'polygon'
    }

    if (!targetSource) return

    currentDraw = new Draw({
      source: targetSource,
      type: type,
    })

    currentDraw.on('drawend', async (event) => {
      const feature = event.feature
      const geometry = feature.getGeometry()
      const geoType = geometry.getType()

      // --- 步骤一：打印经纬度坐标 ---
      const geo4326 = geometry.clone().transform('EPSG:3857', 'EPSG:4326')
      const coords = geo4326.getCoordinates()

      if (geoType === 'Point') {
        console.log(
          `[绘制完成 - Point] 经度: ${coords[0].toFixed(6)}, 纬度: ${coords[1].toFixed(6)}`,
        )
      } else if (geoType === 'LineString') {
        const formattedCoords = coords.map((c) => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}]`)
        console.log(`[绘制完成 - LineString] 坐标点序列:\n`, formattedCoords)
      } else if (geoType === 'Polygon') {
        const outerRing = coords[0]
        const formattedCoords = outerRing.map((c) => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}]`)
        console.log(`[绘制完成 - Polygon] 外环坐标点序列:\n`, formattedCoords)
      }

      // --- 步骤二：手动拼接 XML 并发送 ---
      const clonedFeature = feature.clone()
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')

      try {
        const xmlString = buildInsertXml(clonedFeature, layerName)

        console.log('🚀 准备发送的 WFS-T XML:\n', xmlString)

        const result = await wfsApi.postTransaction(xmlString)
        console.log('✅ WFS-T 写入成功！服务器返回:\n', result)
      } catch (error) {
        console.error('❌ WFS-T 写入失败:', error)
      }
    })

    map.addInteraction(currentDraw)
  }

  // ==================== 7. 停止绘制 ====================
  function deactivateDraw(map) {
    if (currentDraw) {
      map.removeInteraction(currentDraw)
      currentDraw = null
    }
  }

  return {
    addBusinessLayers,
    setupWatchers,
    pointLayer,
    lineLayer,
    polygonLayer,
    addSelectInteraction,
    activateDraw,
    deactivateDraw,
  }
}
