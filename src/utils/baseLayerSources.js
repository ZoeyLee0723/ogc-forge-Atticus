import XYZ from 'ol/source/XYZ'
import TileLayer from 'ol/layer/Tile'

const TDT_TOKEN = '74874263f2ad1050ae9cb2890b194cfc'

// 创建天地图【矢量】底图图层
export function createTdtVecLayer() {
  return new TileLayer({
    source: new XYZ({
      url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`,
      crossOrigin: 'anonymous',
    }),
    visible: true,
  })
}
// 创建天地图【矢量】注记图层（路名、地名）
export function createTdtVecAnnoLayer() {
  return new TileLayer({
    source: new XYZ({
      url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`,
      crossOrigin: 'anonymous',
    }),
    visible: true,
  })
}
