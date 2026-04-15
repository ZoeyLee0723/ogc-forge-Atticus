import { defineStore } from 'pinia'

export const useLayerStore = defineStore('layer', {
  state: () => ({
    pointGeoJson: null,
    lineGeoJson: null,
    polygonGeoJson: null,
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
  },
})
