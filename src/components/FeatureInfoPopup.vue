<template>
  <div v-if="showPopup" class="feature-info-popup">
    <div class="popup-header">
      <h3>要素属性</h3>
      <div class="header-actions">
        <!-- 分析功能：收纳进下拉菜单 -->
        <div v-if="!isEditing" class="dropdown-wrapper">
          <button class="action-btn base-btn">缓冲分析 ▾</button>
          <div class="dropdown-menu">
            <div class="dropdown-item turf" @click="handleBufferAnalysis('turf')">
              <span class="dot turf-dot"></span>Turf 前端计算
            </div>
            <div class="dropdown-item wps" @click="handleBufferAnalysis('wps')">
              <span class="dot wps-dot"></span>WPS 服务计算
            </div>
            <div class="dropdown-item postgis" @click="handleBufferAnalysis('postgis')">
              <span class="dot postgis-dot"></span>PostGIS 数据库计算
            </div>
          </div>
        </div>

        <!-- 基础操作按钮 -->
        <button v-if="!isEditing && hasAttrs" class="action-btn" @click="isEditing = true">编辑</button>
        <button v-if="!isEditing && hasAttrs" class="action-btn danger-text-btn" @click="handleDelete">删除</button>

        <!-- 编辑状态按钮 -->
        <button v-if="isEditing" class="action-btn success-btn" @click="handleSave">保存</button>
        <button v-if="isEditing" class="action-btn" @click="handleCancel">取消</button>

        <!-- 分割线 -->
        <div v-if="hasAttrs || isEditing" class="action-divider"></div>

        <!-- 关闭按钮 -->
        <button class="close-btn" @click="handleClose">×</button>
      </div>
    </div>

    <div class="popup-content">
      <div v-if="hasAttrs">
        <div v-for="(value, key) in attrs" :key="key" class="attribute-item">
          <div class="attribute-label">{{ key }}</div>
          <div v-if="!isEditing" class="attribute-value">{{ value }}</div>
          <input v-else class="attribute-input" v-model="attrs[key]" />
        </div>
      </div>
      <div v-else class="no-attributes">该要素无业务属性</div>
    </div>

    <!-- 缓冲区参数输入区域 (美化版) -->
    <div v-if="showBufferInput" class="buffer-input-area">
      <div class="buffer-form">
        <div class="input-group">
          <input
            type="number"
            v-model.number="bufferRadius"
            class="buffer-input"
            placeholder="输入半径"
            autofocus
          />
          <span class="input-suffix">米</span>
        </div>
        <div class="buffer-actions">
          <button class="confirm-btn" @click="executeBuffer">确定执行</button>
          <button class="cancel-small-btn" @click="showBufferInput = false">取消</button>
        </div>
      </div>
      <div class="buffer-tip">
        当前模式：
        <span :class="`tag tag-${currentAnalysisType}`">
          {{ currentAnalysisType === 'turf' ? 'Turf前端' : currentAnalysisType === 'wps' ? 'WPS服务' : 'PostGIS数据库' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed } from 'vue'
import { wfsApi } from '@/api/ogc/wfs'
import { useOlMap } from '@/composables/useOlMap'
import { useTurfAnalysis } from '@/composables/useTurfAnalysis'
import { useWpsAnalysis } from '@/composables/useWpsAnalysis'
import { usePostgisAnalysis } from '@/composables/usePostgisAnalysis'

const { buildBatchUpdatePropertyXml, buildDeleteXml, refreshLayers } = useOlMap()
const { generateBuffer } = useTurfAnalysis()
const { generateWpsBuffer } = useWpsAnalysis()
const { generatePostgisBuffer } = usePostgisAnalysis()

const mapInstanceRef = inject('mapInstance')

const showPopup = ref(false)
const isEditing = ref(false)
const attrs = ref({})
let currentFeature = null
let originalAttrs = {}

// 计算属性简化模板判断
const hasAttrs = computed(() => Object.keys(attrs.value).length > 0)

// 缓冲区分析相关状态
const showBufferInput = ref(false)
const bufferRadius = ref(2000)
const currentAnalysisType = ref('turf')

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

const getLayerNameByFeature = (feature) => {
  const geoType = feature.getGeometry().getType()
  if (geoType.includes('Point')) return 'point'
  if (geoType.includes('Line')) return 'string'
  if (geoType.includes('Polygon')) return 'polygon'
  return ''
}

const handleBufferAnalysis = (type) => {
  currentAnalysisType.value = type
  showBufferInput.value = true
}

const executeBuffer = async () => {
  if (!currentFeature) return
  const map = mapInstanceRef.value
  const radius = bufferRadius.value

  try {
    if (currentAnalysisType.value === 'turf') {
      generateBuffer(currentFeature, radius, 'meters', map)
    } else if (currentAnalysisType.value === 'wps') {
      await generateWpsBuffer(currentFeature, radius, map)
    } else if (currentAnalysisType.value === 'postgis') {
      await generatePostgisBuffer(currentFeature, radius, map)
    }
    showBufferInput.value = false
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
    await wfsApi.postTransaction(xmlString)
    isEditing.value = false
    originalAttrs = { ...attrs.value }
    refreshLayers()
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
    await wfsApi.postTransaction(xmlString)
    mapInstanceRef.value.getLayers().getArray().forEach((layer) => {
      const source = layer.getSource()
      if (source && typeof source.getFeatures === 'function' && source.getFeatures().includes(currentFeature)) {
        source.removeFeature(currentFeature)
      }
    })
    showPopup.value = false
    refreshLayers()
  } catch (error) {
    console.error('❌ [Delete] 失败:', error)
    alert('删除失败，请查看控制台')
  }
}

defineExpose({ showFeaturePopup })
</script>

<style scoped>
/* 弹窗主体 */
.feature-info-popup {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 400px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* 头部布局 */
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: #fafbfc;
  border-bottom: 1px solid #f0f0f0;
}

.popup-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 统一按钮基础样式 */
.action-btn {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  color: #4b5563;
  background: #fff;
  transition: all 0.2s;
  white-space: nowrap;
}
.action-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.danger-text-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

.success-btn {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
.success-btn:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.action-divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 4px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #9ca3af;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}
.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 下拉菜单样式 */
.dropdown-wrapper {
  position: relative;
}
.dropdown-menu {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
  border: 1px solid #f0f0f0;
  padding: 6px;
  min-width: 180px;
  z-index: 10;
}
.dropdown-wrapper:hover .dropdown-menu {
  display: block;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #374151;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.dropdown-item:hover {
  background: #f3f4f6;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.turf-dot { background: #10b981; }
.wps-dot { background: #f59e0b; }
.postgis-dot { background: #8b5cf6; }

/* 内容区域 */
.popup-content {
  padding: 16px 20px;
  max-height: 350px;
  overflow-y: auto;
}

.attribute-item {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f9fafb;
}
.attribute-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.attribute-label {
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.attribute-value {
  font-size: 13px;
  color: #1f2937;
  word-break: break-all;
  line-height: 1.5;
}

.attribute-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #1f2937;
  outline: none;
  transition: border 0.2s;
  background: #fff;
}
.attribute-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.no-attributes {
  text-align: center;
  color: #9ca3af;
  padding: 30px 0;
  font-size: 13px;
}

/* 滚动条 */
.popup-content::-webkit-scrollbar { width: 4px; }
.popup-content::-webkit-scrollbar-track { background: transparent; }
.popup-content::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

/* 缓冲区输入面板 */
.buffer-input-area {
  padding: 16px 20px;
  background: #fafbfc;
  border-top: 1px solid #f0f0f0;
}
.buffer-form {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.input-group {
  position: relative;
  flex: 1;
}
.buffer-input {
  width: 100%;
  padding: 7px 35px 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}
.buffer-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.input-suffix {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #9ca3af;
}
.buffer-actions {
  display: flex;
  gap: 8px;
}
.confirm-btn {
  padding: 7px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.confirm-btn:hover { background: #2563eb; }
.cancel-small-btn {
  padding: 7px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: #4b5563;
  transition: all 0.2s;
}
.cancel-small-btn:hover { border-color: #d1d5db; background: #f9fafb; }

.buffer-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.tag-turf { background: #d1fae5; color: #065f46; }
.tag-wps { background: #fef3c7; color: #92400e; }
.tag-postgis { background: #ede9fe; color: #5b21b6; }
</style>
