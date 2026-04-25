// src/composables/useWpsAnalysis.js
import { WKT, GeoJSON } from 'ol/format'
import { Vector as VectorLayer } from 'ol/layer'
import { Vector as VectorSource } from 'ol/source'
import { Stroke, Fill, Style } from 'ol/style'
import { Feature } from 'ol'
import { getCenter } from 'ol/extent' // 引入获取中心点的方法
import { wpsApi } from '@/api/ogc/wps'

let wpsAnalysisLayer = null

export function useWpsAnalysis() {
  const getWpsAnalysisLayer = (map) => {
    if (wpsAnalysisLayer) return wpsAnalysisLayer

    const existingLayer = map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('name') === 'wps-analysis-layer')
    if (existingLayer) {
      wpsAnalysisLayer = existingLayer
      return wpsAnalysisLayer
    }

    wpsAnalysisLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 165, 0, 0.4)' }),
        stroke: new Stroke({ color: '#ff8c00', width: 2 }),
      }),
      zIndex: 15,
    })
    wpsAnalysisLayer.set('name', 'wps-analysis-layer')
    map.addLayer(wpsAnalysisLayer)

    return wpsAnalysisLayer
  }

  const buildWPSBufferXml = (geometryWKT, distanceInDegrees) => {
    // 干净的 XML 模板
    return `<?xml version="1.0" encoding="UTF-8"?>
<wps:Execute version="1.0.0" service="WPS" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.opengis.net/wps/1.0.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:wps="http://www.opengis.net/wps/1.0.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:wcs="http://www.opengis.net/wcs/1.1.1" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">
  <ows:Identifier>geo:buffer</ows:Identifier>
  <wps:DataInputs>
    <wps:Input>
      <ows:Identifier>geom</ows:Identifier>
      <wps:Data>
        <wps:ComplexData mimeType="application/wkt"><![CDATA[${geometryWKT}]]></wps:ComplexData>
      </wps:Data>
    </wps:Input>
    <wps:Input>
      <ows:Identifier>distance</ows:Identifier>
      <wps:Data>
        <wps:LiteralData>${distanceInDegrees}</wps:LiteralData>
      </wps:Data>
    </wps:Input>
  </wps:DataInputs>
  <wps:ResponseForm>
    <wps:RawDataOutput mimeType="application/json">
      <ows:Identifier>result</ows:Identifier>
    </wps:RawDataOutput>
  </wps:ResponseForm>
</wps:Execute>`
  }

  const generateWpsBuffer = async (feature, radius, map) => {
    if (!feature || !map) return

    try {
      const clonedFeature = feature.clone()

      // 1. 坐标转换：3857 -> 4326
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')

      // 【关键修复】2. 根据要素所在纬度，将米转换为度
      const extent = clonedFeature.getGeometry().getExtent()
      const center = getCenter(extent)
      const latitude = center[1] // 获取中心点纬度
      const latRad = (latitude * Math.PI) / 180

      // 近似公式：在当前纬度下，1度对应的米数
      const meterPerDegree = 111320 * Math.cos(latRad)
      const distanceInDegrees = radius / meterPerDegree

      console.log(
        `📝 [WPS] 半径换算: ${radius}米 ➡️ ${distanceInDegrees.toFixed(6)}度 (纬度:${latitude.toFixed(4)})`,
      )

      // 3. 转换为 WKT
      const wktFormat = new WKT()
      const geometryWKT = wktFormat.writeFeature(clonedFeature)

      // 4. 构建 XML (传入换算后的度)
      const xmlRequest = buildWPSBufferXml(geometryWKT, distanceInDegrees)

      // 5. 发送请求
      const resultGeoJSON = await wpsApi.postExecute(xmlRequest)

      // 6. GeoJSON 转 OL Geometry (带投影转换)
      const geoJsonFormat = new GeoJSON()
      const geometry = geoJsonFormat.readGeometry(resultGeoJSON, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })

      if (!geometry) throw new Error('WPS返回的GeoJSON转换为OL几何失败')

      // 7. 包装成 Feature 并渲染
      const bufferedFeature = new Feature({ geometry })
      const layer = getWpsAnalysisLayer(map)
      layer.getSource().addFeature(bufferedFeature)

      return bufferedFeature
    } catch (error) {
      console.error('❌ [WPS Buffer Failed]:', error)
      throw error
    }
  }

  return {
    getWpsAnalysisLayer,
    generateWpsBuffer,
  }
}
