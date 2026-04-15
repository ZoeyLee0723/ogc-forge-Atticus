import { Style, Fill, Stroke, Circle } from 'ol/style'

/** 点样式：红色圆点 + 白色描边 */
export function getPointStyle() {
  return new Style({
    image: new Circle({
      radius: 7,
      fill: new Fill({ color: '#e74c3c' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  })
}

/** 线样式：蓝色 3px */
export function getLineStyle() {
  return new Style({
    stroke: new Stroke({
      color: '#2980b9',
      width: 3,
    }),
  })
}

/** 面样式：半透明黄色填充 + 橙色描边 */
export function getPolygonStyle() {
  return new Style({
    fill: new Fill({ color: 'rgba(241, 196, 15, 0.3)' }),
    stroke: new Stroke({
      color: '#e67e22',
      width: 2,
    }),
  })
}
