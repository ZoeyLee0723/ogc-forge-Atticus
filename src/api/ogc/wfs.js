import axios from 'axios'

// 因为配了 proxy，直接用相对路径，不需要写 localhost:8080
const WFS_BASE = '/geoserver/ogcforge/ows'

export const wfsApi = {
  /**
   * 通过 WFS 协议获取要素，返回 GeoJSON
   * @param {string} typeName - 图层名，如 'ogcforge:point'
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
}
