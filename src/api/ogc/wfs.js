import axios from 'axios'

const WFS_BASE = '/geoserver/ogcforge/ows'

export const wfsApi = {
  /**
   * 通过 WFS 协议获取要素，返回 GeoJSON
   */
  async getFeatures(typeName) {
    const params = {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
    }
    const res = await axios.get(WFS_BASE, { params })
    return res.data
  },

  /**
   * 发送 WFS-T 事务请求（增删改）
   */
  async postTransaction(xmlString) {
    try {
      const res = await axios.post(WFS_BASE, xmlString, {
        headers: {
          'Content-Type': 'application/xml',
        },
      })
      return res.data
    } catch (error) {
      console.error('WFS-T 请求异常:', error.response?.data || error.message)
      throw error
    }
  },
}
