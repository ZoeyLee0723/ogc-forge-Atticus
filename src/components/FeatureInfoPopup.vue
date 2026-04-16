<template>
  <div v-if="showPopup" class="feature-info-popup">
    <div class="popup-header">
      <h3>要素属性</h3>
      <button class="close-btn" @click="handleClose">×</button>
    </div>
    <div class="popup-content">
      <div v-if="Object.keys(attrs).length > 0">
        <div v-for="(value, key) in attrs" :key="key" class="attribute-item">
          <div class="attribute-label">{{ key }}</div>
          <div class="attribute-value">{{ value }}</div>
        </div>
      </div>
      <div v-else class="no-attributes">该要素无业务属性</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showPopup = ref(false)
const attrs = ref({})

const handleClose = () => {
  showPopup.value = false
}

const showFeaturePopup = (feature) => {
  if (!feature) return

  const properties = feature.getProperties()
  const filtered = {}

  for (const [key, value] of Object.entries(properties)) {
    if (key !== 'geometry' && !key.startsWith('_')) {
      filtered[key] = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
    }
  }

  attrs.value = filtered
  showPopup.value = true
}

defineExpose({ showFeaturePopup })
</script>

<style scoped>
.feature-info-popup {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 300px;
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
</style>
