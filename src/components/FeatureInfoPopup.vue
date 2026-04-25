<template>
  <div v-if="showPopup" class="feature-info-popup">
    <div class="popup-header">
      <h3>要素属性</h3>
      <div class="header-actions">
        <!-- 【修改】拆分为三种缓冲分析按钮 -->
        <button
          v-if="!isEditing"
          class="action-btn analysis-btn turf-btn"
          @click="handleBufferAnalysis('turf')"
        >
          Turf缓冲
        </button>
        <button
          v-if="!isEditing"
          class="action-btn analysis-btn wps-btn"
          @click="handleBufferAnalysis('wps')"
        >
          WPS缓冲
        </button>
        <button
          v-if="!isEditing"
          class="action-btn analysis-btn postgis-btn"
          @click="handleBufferAnalysis('postgis')"
        >
          数据库缓冲
        </button>

        <!-- 非编辑状态：显示编辑和删除按钮 -->
        <button
          v-if="!isEditing && Object.keys(attrs).length > 0"
          class="action-btn edit-btn"
          @click="isEditing = true"
        >
          编辑
        </button>
        <button
          v-if="!isEditing && Object.keys(attrs).length > 0"
          class="action-btn delete-btn"
          @click="handleDelete"
        >
          删除
        </button>

        <!-- 编辑状态：显示保存和取消按钮 -->
        <button v-if="isEditing" class="action-btn save-btn" @click="handleSave">保存</button>
        <button v-if="isEditing" class="action-btn cancel-btn" @click="handleCancel">取消</button>

        <button class="close-btn" @click="handleClose">×</button>
      </div>
    </div>

    <div class="popup-content">
      <div v-if="Object.keys(attrs).length > 0">
        <div v-for="(value, key) in attrs" :key="key" class="attribute-item">
          <div class="attribute-label">{{ key }}</div>
          <!-- 展示模式 -->
          <div v-if="!isEditing" class="attribute-value">{{ value }}</div>
          <!-- 编辑模式 -->
          <input v-else class="attribute-input" v-model="attrs[key]" />
        </div>
      </div>
      <div v-else class="no-attributes">该要素无业务属性</div>
    </div>

    <!-- 缓冲区参数输入区域 -->
    <div v-if="showBufferInput" class="buffer-input-area">
      <div class="buffer-row">
        <label>半径(米):</label>
        <input type="number" v-model.number="bufferRadius" class="buffer-input" />
        <button class="confirm-btn" @click="executeBuffer">确定</button>
        <button class="cancel-small-btn" @click="showBufferInput = false">取消</button>
      </div>
      <div class="buffer-tip">
        当前模式:
        {{
          currentAnalysisType === 'turf'
            ? '前端Turf计算'
            : currentAnalysisType === 'wps'
              ? 'GeoServer WPS计算'
              : 'PostGIS 数据库计算'
        }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { wfsApi } from '@/api/ogc/wfs'
import { useOlMap } from '@/composables/useOlMap'
// 引入三种分析逻辑
import { useTurfAnalysis } from '@/composables/useTurfAnalysis'
import { useWpsAnalysis } from '@/composables/useWpsAnalysis'
import { usePostgisAnalysis } from '@/composables/usePostgisAnalysis'

const { buildBatchUpdatePropertyXml, buildDeleteXml } = useOlMap()
const { generateBuffer } = useTurfAnalysis()
const { generateWpsBuffer } = useWpsAnalysis()
const { generatePostgisBuffer } = usePostgisAnalysis() // 引入 PostGIS 缓冲方法

const mapInstanceRef = inject('mapInstance')

const showPopup = ref(false)
const isEditing = ref(false)
const attrs = ref({})
let currentFeature = null
let originalAttrs = {}

// 缓冲区分析相关状态
const showBufferInput = ref(false)
const bufferRadius = ref(2000)
const currentAnalysisType = ref('turf') // 记录当前选择的分析模式: turf / wps / postgis

const handleClose = () => {
  showPopup.value = false
  isEditing.value = false
  showBufferInput.value = false
}

const handleCancel = () => {
  attrs.value = { ...originalAttrs }
  isEditing.value = false
}

const showFeaturePopup = (feature) => {
  if (!feature) return
  currentFeature = feature

  const properties = feature.getProperties()
  const filtered = {}

  for (const [key, value] of Object.entries(properties)) {
    if (key !== 'geometry' && !key.startsWith('_') && key !== 'id') {
      filtered[key] = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
    }
  }

  attrs.value = filtered
  originalAttrs = { ...filtered }
  isEditing.value = false
  showPopup.value = true
}

// 提取公共逻辑：通过要素获取图层名
const getLayerNameByFeature = (feature) => {
  const geoType = feature.getGeometry().getType()
  if (geoType.includes('Point')) return 'point'
  if (geoType.includes('Line')) return 'string'
  if (geoType.includes('Polygon')) return 'polygon'
  return ''
}

// 点击缓冲按钮，记录类型并弹出输入框
const handleBufferAnalysis = (type) => {
  currentAnalysisType.value = type
  showBufferInput.value = true
}

// 执行分析（加入 WPS 和 PostGIS 逻辑和异步处理）
const executeBuffer = async () => {
  if (!currentFeature) return

  const map = mapInstanceRef.value
  const radius = bufferRadius.value

  try {
    if (currentAnalysisType.value === 'turf') {
      // Turf 前端计算
      generateBuffer(currentFeature, radius, 'meters', map)
      console.log(`✅ [Turf] 已生成 ${radius} 米缓冲区`)
    } else if (currentAnalysisType.value === 'wps') {
      // WPS 服务端计算
      await generateWpsBuffer(currentFeature, radius, map)
      console.log(`✅ [WPS] 已生成 ${radius} 米缓冲区`)
    } else if (currentAnalysisType.value === 'postgis') {
      // PostGIS 数据库计算
      await generatePostgisBuffer(currentFeature, radius, map)
      console.log(`✅ [PostGIS] 已生成 ${radius} 米缓冲区`)
    }
    showBufferInput.value = false // 成功后关闭输入框
  } catch (error) {
    console.error('缓冲区分析失败:', error)
    alert('缓冲区分析失败，请查看控制台日志')
  }
}

const handleSave = async () => {
  if (!currentFeature) return
  const fid = currentFeature.getId()
  if (!fid) return alert('修改失败：找不到要素 FID')

  const layerName = getLayerNameByFeature(currentFeature)

  try {
    const xmlString = buildBatchUpdatePropertyXml(layerName, fid, attrs.value)
    console.log('📝 [Update Props] 发送 XML:\n', xmlString)
    const result = await wfsApi.postTransaction(xmlString)
    console.log('✅ [Update Props] 成功:\n', result)

    isEditing.value = false
    originalAttrs = { ...attrs.value }
    alert('属性修改成功！')
  } catch (error) {
    console.error('❌ [Update Props] 失败:', error)
    alert('属性修改失败，请查看控制台')
  }
}

const handleDelete = async () => {
  if (!currentFeature) return
  if (!confirm('⚠️ 确定要删除这个要素吗？此操作不可逆！')) return

  const fid = currentFeature.getId()
  const layerName = getLayerNameByFeature(currentFeature)

  try {
    const xmlString = buildDeleteXml(layerName, fid)
    console.log('🗑️ [Delete] 发送 XML:\n', xmlString)
    const result = await wfsApi.postTransaction(xmlString)
    console.log('✅ [Delete] 成功:\n', result)

    mapInstanceRef.value
      .getLayers()
      .getArray()
      .forEach((layer) => {
        const source = layer.getSource()
        if (source && typeof source.getFeatures === 'function') {
          if (source.getFeatures().includes(currentFeature)) {
            source.removeFeature(currentFeature)
          }
        }
      })

    showPopup.value = false
  } catch (error) {
    console.error('❌ [Delete] 失败:', error)
    alert('删除失败，请查看控制台')
  }
}

defineExpose({ showFeaturePopup })
</script>

<style scoped>
.feature-info-popup {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 380px; /* 稍微加宽以容纳三个按钮 */
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.popup-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 6px; /* 按钮增多，稍微缩小间距 */
  align-items: center;
  flex-wrap: wrap; /* 允许换行防止撑爆 */
}

.action-btn {
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}

.edit-btn {
  background: #e6f7ff;
  color: #1890ff;
}
.edit-btn:hover {
  background: #bae7ff;
}

.save-btn {
  background: #f6ffed;
  color: #52c41a;
}
.save-btn:hover {
  background: #d9f7be;
}

.cancel-btn {
  background: #fff1f0;
  color: #ff4d4f;
}
.cancel-btn:hover {
  background: #ffccc7;
}

.delete-btn {
  background: #fff1f0;
  color: #ff4d4f;
}
.delete-btn:hover {
  background: #ffccc7;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: #606266;
}

.popup-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.attribute-item {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.attribute-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.attribute-label {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
  margin-bottom: 4px;
}
.attribute-value {
  font-size: 13px;
  color: #303133;
  word-break: break-all;
}

.attribute-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  color: #303133;
  outline: none;
  transition: border 0.2s;
}
.attribute-input:focus {
  border-color: #409eff;
}

.no-attributes {
  text-align: center;
  color: #999;
  padding: 20px 0;
}

.popup-content::-webkit-scrollbar {
  width: 6px;
}
.popup-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
.popup-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}
.popup-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 缓冲区按钮样式区分 */
.turf-btn {
  background: #f0f9eb;
  color: #67c23a;
}
.turf-btn:hover {
  background: #e1f3d8;
}

.wps-btn {
  background: #fdf6ec;
  color: #e6a23c;
} /* 橙色系代表 WPS 服务端 */
.wps-btn:hover {
  background: #faecd8;
}

.postgis-btn {
  background: #f3e8ff;
  color: #8a2be2;
} /* 紫色系代表 PostGIS 数据库 */
.postgis-btn:hover {
  background: #e6ccff;
}

/* 缓冲区输入区域样式 */
.buffer-input-area {
  padding: 10px 16px;
  background: #fdf6ec;
  border-top: 1px solid #faecd8;
}
.buffer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.buffer-row label {
  font-size: 12px;
  color: #666;
}
.buffer-input {
  width: 60px;
  padding: 4px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.confirm-btn {
  background: #67c23a;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.cancel-small-btn {
  background: transparent;
  border: 1px solid #dcdfe6;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.buffer-tip {
  margin-top: 6px;
  font-size: 11px;
  color: #909399;
}
</style>
