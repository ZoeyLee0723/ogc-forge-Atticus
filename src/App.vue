<template>
  <router-view />
</template>

<style>
/* 全局重置样式，确保地图 100% 铺满无滚动条 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
