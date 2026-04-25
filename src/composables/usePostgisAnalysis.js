// src/composables/usePostgisAnalysis.js
import axios from 'axios'
import { WKT, GeoJSON } from 'ol/format'
import { Feature } from 'ol'
import { Vector as VectorLayer } from 'ol/layer'
import { Vector as VectorSource } from 'ol/source'
import { Stroke, Fill, Style } from 'ol/style'

// 可以复用之前 WPS 的图层，或者单独建一个紫色的 PostGIS 专属图层
let postgisLayer = null

export function usePostgisAnalysis() {
  const getPostgisLayer = (map) => {
    if (postgisLayer) return postgisLayer

    const existing = map
      .getLayers()
      .getArray()
      .find((l) => l.get('name') === 'postgis-analysis-layer')
    if (existing) {
      postgisLayer = existing
      return postgisLayer
    }

    postgisLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        fill: new Fill({ color: 'rgba(147, 112, 219, 0.4)' }), // 紫色半透明
        stroke: new Stroke({ color: '#8A2BE2', width: 2 }),
      }),
      zIndex: 16,
    })
    postgisLayer.set('name', 'postgis-analysis-layer')
    map.addLayer(postgisLayer)
    return postgisLayer
  }

  const generatePostgisBuffer = async (feature, radius, map) => {
    if (!feature || !map) return

    try {
      // 1. 坐标转换：3857 -> 4326
      const clonedFeature = feature.clone()
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')

      // 2. 转 WKT
      const wktFormat = new WKT()
      const wkt = wktFormat.writeFeature(clonedFeature)

      // 3. 发送给 Node.js 后端 (注意修改为你真实的后端地址)
      const response = await axios.post('http://localhost:3000/api/buffer', {
        wkt,
        radius,
      })

      // 4. 解析返回的 GeoJSON 并转换投影
      const geoJsonFormat = new GeoJSON()
      const geometry = geoJsonFormat.readGeometry(response.data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })

      if (!geometry) throw new Error('GeoJSON 转换失败')

      // 5. 包装成 Feature 并渲染
      const bufferedFeature = new Feature({ geometry })
      const layer = getPostgisLayer(map)
      layer.getSource().addFeature(bufferedFeature)

      console.log(`✅ [PostGIS] 已生成 ${radius} 米缓冲区`)
      return bufferedFeature
    } catch (error) {
      console.error('❌ [PostGIS Buffer Failed]:', error)
      throw error
    }
  }

  return { generatePostgisBuffer }
}
