import { defineStore } from 'pinia'

export const useLayerStore = defineStore('layer', {
  state: () => ({
    pointGeoJson: null,
    lineGeoJson: null,
    polygonGeoJson: null,
    // 图层显示状态
    layerVisibility: {
      point: true,
      line: true,
      polygon: true,
      base: true,
    },
  }),
  actions: {
    setPoint(data) {
      this.pointGeoJson = data
    },
    setLine(data) {
      this.lineGeoJson = data
    },
    setPolygon(data) {
      this.polygonGeoJson = data
    },
    // 设置图层显示状态
    setLayerVisibility(layerName, visible) {
      if (Object.prototype.hasOwnProperty.call(this.layerVisibility, layerName)) {
        this.layerVisibility[layerName] = visible
      }
    },
    // 切换图层显示状态
    toggleLayerVisibility(layerName) {
      if (Object.prototype.hasOwnProperty.call(this.layerVisibility, layerName)) {
        this.layerVisibility[layerName] = !this.layerVisibility[layerName]
      }
    },
  },
  getters: {
    isLayerVisible: (state) => (layerName) => {
      return state.layerVisibility[layerName] || false
    },
  },
})
