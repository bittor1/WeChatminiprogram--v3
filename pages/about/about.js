// pages/about/about.js
Page({
  data: {
    // 页面的初始数据
  },

  onLoad(options) {
    // 页面加载时执行
    
    // 启用分享菜单（包括朋友圈）
    if (wx.canIUse('showShareMenu')) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '伦敦必吃榜 - 一个有趣的社交排行榜',
      path: '/pages/index/index',
      imageUrl: '/placeholder.jpg'
    }
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '来看看这个有趣的伦敦必吃榜，颠覆你的社交体验！',
      query: '',
      imageUrl: '/placeholder.jpg'
    }
  }
})