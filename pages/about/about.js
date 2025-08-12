// pages/about/about.js
Page({
  data: {
    // 页面的初始数据
  },

  onLoad(options) {
    // 页面加载时执行
  },

  // 返回首页
  goBackToHome() {
    wx.switchTab({
      url: '/pages/index/index',
    })
  },

  onShareAppMessage() {
    return {
      title: '伦敦必吃榜 - 一个有趣的社交排行榜',
      path: '/pages/index/index'
    }
  }
})