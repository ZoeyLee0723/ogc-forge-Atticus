import { watch } from 'vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { GeoJSON } from 'ol/format'
import { useLayerStore } from '@/stores/layerStore'
import { getPointStyle, getLineStyle, getPolygonStyle } from '@/utils/featureStyles'
import Select from 'ol/interaction/Select'
import Draw from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import { wfsApi } from '@/api/ogc/wfs'

export function useOlMap() {
  const layerStore = useLayerStore()
  const format = new GeoJSON()
  let currentDraw = null
  let currentModify = null
  let selectInstance = null
  let modifySelectInstance = null

  // ==================== 1. 创建三个业务矢量图层 ====================
  const pointLayer = new VectorLayer({ source: new VectorSource(), style: getPointStyle() })
  const lineLayer = new VectorLayer({ source: new VectorSource(), style: getLineStyle() })
  const polygonLayer = new VectorLayer({ source: new VectorSource(), style: getPolygonStyle() })

  const drawTargetMap = {
    Point: { source: pointLayer.getSource(), layerName: 'point' },
    LineString: { source: lineLayer.getSource(), layerName: 'string' },
    Polygon: { source: polygonLayer.getSource(), layerName: 'polygon' },
  }

  // ==================== 2. 挂载到地图上 ====================
  function addBusinessLayers(map) {
    map.addLayer(polygonLayer)
    map.addLayer(lineLayer)
    map.addLayer(pointLayer)
  }

  // ==================== 3. 监听 Store ====================
  function setupWatchers() {
    const opts = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
    const watchList = [
      { getter: () => layerStore.pointGeoJson, layer: pointLayer },
      { getter: () => layerStore.lineGeoJson, layer: lineLayer },
      { getter: () => layerStore.polygonGeoJson, layer: polygonLayer },
    ]
    watchList.forEach(({ getter, layer }) => {
      watch(getter, (geojson) => {
        if (!geojson) return
        layer.getSource().clear()
        layer.getSource().addFeatures(format.readFeatures(geojson, opts))
      })
    })
  }

  // ==================== 4. 添加【查询】选择交互 ====================
  function addSelectInteraction(map, featurePopup) {
    selectInstance = new Select({
      layers: [pointLayer, lineLayer, polygonLayer],
      // 【修复】根据要素类型返回对应样式，避免线面被当成点渲染而"消失"
      style: (feature) => {
        const type = feature.getGeometry().getType()
        if (type === 'Point' || type === 'MultiPoint') return getPointStyle()
        if (type === 'LineString' || type === 'MultiLineString') return getLineStyle()
        if (type === 'Polygon' || type === 'MultiPolygon') return getPolygonStyle()
      },
    })
    selectInstance.on('select', (event) => {
      if (event.selected.length > 0) {
        featurePopup.value.showFeaturePopup(event.selected[0])
      }
    })
    map.addInteraction(selectInstance)
  }

  // ==================== 5. 核心：抽取公共 GML 拼接逻辑 ====================
  function _buildGmlGeom(geometry) {
    const geoType = geometry.getType()
    const coords = geometry.getCoordinates()

    if (geoType === 'Point') {
      return `<gml:Point srsName="EPSG:4326">
            <gml:coordinates decimal="." cs="," ts=" ">${coords[0]},${coords[1]}</gml:coordinates>
          </gml:Point>`
    } else if (geoType === 'MultiPoint') {
      const coordStr = coords.map((c) => `${c[0]},${c[1]}`).join(' ')
      return `<gml:MultiPoint srsName="EPSG:4326">
            <gml:pointMember><gml:Point>
              <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
            </gml:Point></gml:pointMember>
          </gml:MultiPoint>`
    } else if (geoType === 'LineString') {
      const coordStr = coords.map((c) => `${c[0]},${c[1]}`).join(' ')
      return `<gml:MultiLineString srsName="EPSG:4326">
            <gml:lineStringMember>
              <gml:LineString>
                <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
              </gml:LineString>
            </gml:lineStringMember>
          </gml:MultiLineString>`
    } else if (geoType === 'MultiLineString') {
      // coords 是三维数组：[ 线1的坐标[], 线2的坐标[], ... ]
      const members = coords
        .map(
          (lineCoords) =>
            `<gml:lineStringMember><gml:LineString>
              <gml:coordinates decimal="." cs="," ts=" ">${lineCoords.map((c) => `${c[0]},${c[1]}`).join(' ')}</gml:coordinates>
            </gml:LineString></gml:lineStringMember>`,
        )
        .join('')
      return `<gml:MultiLineString srsName="EPSG:4326">${members}</gml:MultiLineString>`
    } else if (geoType === 'Polygon') {
      const coordStr = coords[0].map((c) => `${c[0]},${c[1]}`).join(' ')
      return `<gml:MultiPolygon srsName="EPSG:4326">
            <gml:polygonMember>
              <gml:Polygon>
                <gml:outerBoundaryIs>
                  <gml:LinearRing>
                    <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
                  </gml:LinearRing>
                </gml:outerBoundaryIs>
              </gml:Polygon>
            </gml:polygonMember>
          </gml:MultiPolygon>`
    } else if (geoType === 'MultiPolygon') {
      // coords 是四维数组：[ 面1[环1的坐标[]], 面2[环1的坐标[]], ... ]
      const members = coords
        .map(
          (polyCoords) =>
            `<gml:polygonMember><gml:Polygon>
              <gml:outerBoundaryIs><gml:LinearRing>
                <gml:coordinates decimal="." cs="," ts=" ">${polyCoords[0].map((c) => `${c[0]},${c[1]}`).join(' ')}</gml:coordinates>
              </gml:LinearRing></gml:outerBoundaryIs>
            </gml:Polygon></gml:polygonMember>`,
        )
        .join('')
      return `<gml:MultiPolygon srsName="EPSG:4326">${members}</gml:MultiPolygon>`
    }
    return ''
  }

  // ==================== 6. 拼装 Insert XML ====================
  function buildInsertXml(feature, layerName) {
    const gmlGeom = _buildGmlGeom(feature.getGeometry())
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogcforge="http://www.ogcforge.com" xmlns:gml="http://www.opengis.net/gml">
  <wfs:Insert>
    <ogcforge:${layerName}>
      <ogcforge:geom>${gmlGeom}</ogcforge:geom>
    </ogcforge:${layerName}>
  </wfs:Insert>
</wfs:Transaction>`
  }

  // ==================== 7. 拼装 Update XML ====================
  function buildUpdateXml(feature, layerName, fid) {
    const gmlGeom = _buildGmlGeom(feature.getGeometry())
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:ogcforge="http://www.ogcforge.com" xmlns:gml="http://www.opengis.net/gml">
  <wfs:Update typeName="ogcforge:${layerName}">
    <wfs:Property>
      <wfs:Name>geom</wfs:Name>
      <wfs:Value>${gmlGeom}</wfs:Value>
    </wfs:Property>
    <ogc:Filter>
      <ogc:FeatureId fid="${fid}"/>
    </ogc:Filter>
  </wfs:Update>
</wfs:Transaction>`
  }

  // ==================== 8. 绘制交互 ====================
  function activateDraw(map, type) {
    deactivateDraw(map)
    deactivateModify(map)
    if (selectInstance) selectInstance.setActive(false) // 冻结查询，防弹窗

    const target = drawTargetMap[type]
    if (!target) return

    currentDraw = new Draw({ source: target.source, type })
    currentDraw.on('drawend', async (event) => {
      const clonedFeature = event.feature.clone()
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')
      try {
        const xmlString = buildInsertXml(clonedFeature, target.layerName)
        console.log('🚀 [Insert] 发送 XML:\n', xmlString)
        const result = await wfsApi.postTransaction(xmlString)
        console.log('✅ [Insert] 成功:\n', result)
      } catch (error) {
        console.error('❌ [Insert] 失败:', error)
      }
    })
    map.addInteraction(currentDraw)
  }

  function deactivateDraw(map) {
    if (currentDraw) {
      map.removeInteraction(currentDraw)
      currentDraw = null
    }
    if (selectInstance) selectInstance.setActive(true) // 唤醒查询
  }

  // ==================== 9. 修改交互 ====================
  function activateModify(map) {
    deactivateModify(map)
    deactivateDraw(map)
    if (selectInstance) selectInstance.setActive(false) // 冻结查询，防弹窗

    // ① 创建"修改专用" Select（不绑弹窗，只负责选中要素）
    modifySelectInstance = new Select({
      layers: [pointLayer, lineLayer, polygonLayer],
      style: (feature) => {
        const type = feature.getGeometry().getType()
        if (type === 'Point' || type === 'MultiPoint') return getPointStyle()
        if (type === 'LineString' || type === 'MultiLineString') return getLineStyle()
        if (type === 'Polygon' || type === 'MultiPolygon') return getPolygonStyle()
      },
    })
    map.addInteraction(modifySelectInstance)

    // ② 创建 Modify，绑定到专用 Select 的要素集合上
    currentModify = new Modify({
      features: modifySelectInstance.getFeatures(),
    })

    currentModify.on('modifyend', async (event) => {
      const feature = event.features.getArray()[0]
      const fid = feature.getId()
      if (!fid) {
        console.error('❌ [Update] 失败：要素没有 FID！')
        return
      }

      let layerName = ''
      if (pointLayer.getSource().hasFeature(feature)) layerName = 'point'
      else if (lineLayer.getSource().hasFeature(feature)) layerName = 'string'
      else if (polygonLayer.getSource().hasFeature(feature)) layerName = 'polygon'

      const clonedFeature = feature.clone()
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')

      try {
        const xmlString = buildUpdateXml(clonedFeature, layerName, fid)
        console.log('🛠️ [Update] 发送 XML:\n', xmlString)
        const result = await wfsApi.postTransaction(xmlString)
        console.log('✅ [Update] 成功:\n', result)
      } catch (error) {
        console.error('❌ [Update] 失败:', error)
      }
    })

    map.addInteraction(currentModify)
  }

  function deactivateModify(map) {
    if (currentModify) {
      map.removeInteraction(currentModify)
      currentModify = null
    }
    if (modifySelectInstance) {
      map.removeInteraction(modifySelectInstance)
      modifySelectInstance = null
    }
    if (selectInstance) selectInstance.setActive(true) // 唤醒查询
  }
  // ==================== 10. 拼装批量修改属性 XML (新增) ====================
  function buildBatchUpdatePropertyXml(layerName, fid, propertiesObj) {
    // 把 { name: '张三', age: 18 } 变成多个 <wfs:Property> 节点
    const propertyNodes = Object.entries(propertiesObj)
      .map(
        ([key, value]) => `
        <wfs:Property>
          <wfs:Name>${key}</wfs:Name>
          <wfs:Value>${value}</wfs:Value>
        </wfs:Property>`,
      )
      .join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:ogcforge="http://www.ogcforge.com" xmlns:gml="http://www.opengis.net/gml">
  <wfs:Update typeName="ogcforge:${layerName}">
    ${propertyNodes}
    <ogc:Filter>
      <ogc:FeatureId fid="${fid}"/>
    </ogc:Filter>
  </wfs:Update>
</wfs:Transaction>`
  }
// ==================== 11. 拼装删除 XML (新增) ====================
  function buildDeleteXml(layerName, fid) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:ogcforge="http://www.ogcforge.com">
  <wfs:Delete typeName="ogcforge:${layerName}">
    <ogc:Filter>
      <ogc:FeatureId fid="${fid}"/>
    </ogc:Filter>
  </wfs:Delete>
</wfs:Transaction>`
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
    activateModify,
    deactivateModify,
    buildBatchUpdatePropertyXml, // 【新增】暴露属性修改方法
    buildDeleteXml, // 【新增】暴露删除方法
  }
}
