// src/composables/useTurfAnalysis.js
import * as turf from '@turf/turf'
import { GeoJSON } from 'ol/format'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style, Fill, Stroke } from 'ol/style'

const format = new GeoJSON()

// 缓冲区结果图层（单例，避免重复创建）
let analysisLayer = null

export function useTurfAnalysis() {
  /**
   * 获取或创建分析结果图层
   */
  const getAnalysisLayer = (map) => {
    if (!analysisLayer) {
      analysisLayer = new VectorLayer({
        source: new VectorSource(),
        style: new Style({
          fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
          stroke: new Stroke({ color: '#ff0000', width: 2 }),
          zIndex: 100, // 保证在最上层
        }),
      })
      map.addLayer(analysisLayer)
    }
    return analysisLayer
  }

  /**
   * 清空分析结果
   */
  const clearAnalysis = () => {
    if (analysisLayer) {
      analysisLayer.getSource().clear()
    }
  }

  /**
   * 核心方法：执行缓冲区分析
   * @param {import('ol/Feature').default} feature OL要素
   * @param {number} radius 缓冲半径
   * @param {string} units 单位 ('meters' | 'kilometers' | 'degrees')
   * @param {import('ol/Map').default} map 地图实例
   */
  const generateBuffer = (feature, radius, units, map) => {
    if (!feature || !map) return

    // 1. 清空之前的结果
    clearAnalysis()

    // 2. 坐标转换：EPSG:3857 (Web墨卡托) -> EPSG:4326 (经纬度)
    // Turf.js 需要 GeoJSON 标准（经纬度）
    const feature4326 = feature.clone()
    feature4326.getGeometry().transform('EPSG:3857', 'EPSG:4326')

    // 3. OL Feature -> Turf GeoJSON
    const geoJsonObj = format.writeFeatureObject(feature4326)

    // 4. Turf 计算
    // 注意：turf.buffer 返回的是 Feature<Polygon | MultiPolygon>
    const buffered = turf.buffer(geoJsonObj, Number(radius), { units })

    if (!buffered) {
      console.warn('缓冲区生成失败，可能半径过小')
      return
    }

    // 5. Turf GeoJSON -> OL Feature
    // readFeature 会将 GeoJSON 转回 OL 对象
    const bufferedFeature = format.readFeature(buffered)

    // 6. 坐标还原：EPSG:4326 -> EPSG:3857 (匹配地图投影)
    bufferedFeature.getGeometry().transform('EPSG:4326', 'EPSG:3857')

    // 7. 渲染到地图
    const layer = getAnalysisLayer(map)
    layer.getSource().addFeature(bufferedFeature)

    // 8. 视图定位到结果区域（可选）
    // map.getView().fit(bufferedFeature.getGeometry().getExtent(), { duration: 500, padding: [50, 50, 50, 50] })

    return bufferedFeature
  }

  return {
    generateBuffer,
    clearAnalysis,
    getAnalysisLayer,
  }
}
