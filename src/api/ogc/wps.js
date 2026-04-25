// src/api/ogc/wps.js
import axios from 'axios'

// WPS 和 WFS 共用同一个 OWS 入口，保持与 wfs.js 一致
const WPS_BASE = '/geoserver/ogcforge/ows'

export const wpsApi = {
  /**
   * 发送 WPS Execute 请求 (针对 geo:buffer 返回 RawDataOutput JSON)
   * @param {string} xmlString 符合 WPS 1.0.0 规范的 Execute 请求 XML
   * @returns {Promise<object>} 返回 GeoJSON 结果对象
   */
  async postExecute(xmlString) {
    try {
      const res = await axios.post(WPS_BASE, xmlString, {
        headers: {
          'Content-Type': 'application/xml',
        },
      })

      // 因为我们在 XML 中指定了 mimeType="application/json"，axios 会自动解析为 JSON 对象
      // 做一层基本校验，确保返回的是 GeoJSON 几何对象
      // 支持三种格式：1. 原始几何对象  2. FeatureCollection  3. Feature
      if (res.data && res.data.type && res.data.coordinates) {
        // 情况1：直接返回几何对象（如 {"type": "Polygon", "coordinates": [...]}）
        return res.data
      } else if (
        res.data &&
        res.data.type === 'FeatureCollection' &&
        res.data.features &&
        res.data.features.length > 0
      ) {
        // 情况2：返回 FeatureCollection，提取第一个 Feature 的几何
        console.log('📝 [WPS] 返回 FeatureCollection，提取第一个 Feature 的几何')
        return res.data.features[0].geometry
      } else if (res.data && res.data.type === 'Feature' && res.data.geometry) {
        // 情况3：返回 Feature，直接提取其 geometry 属性
        console.log('📝 [WPS] 返回 Feature，提取其几何')
        return res.data.geometry
      } else {
        console.error('WPS 返回的非预期 JSON 结构:', res.data)
        throw new Error('WPS服务返回的JSON格式不符合预期')
      }
    } catch (error) {
      // 提取 axios 的错误信息
      const errMsg = error.response?.data || error.message
      console.error('WPS Execute 请求异常:', errMsg)
      throw error
    }
  },
}
