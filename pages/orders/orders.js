// pages/orders/orders.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    orders: [],
    hasOrders: true,
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.fetchOrderData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 如果已经加载过数据则不重新加载
    if (this.data.loading) {
      this.fetchOrderData();
    }
  },

  /**
   * 获取订单数据
   */
  fetchOrderData: function () {
    this.setData({
      loading: true
    });
    
    // 获取全局应用实例
    const app = getApp();
    
    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const userId = userInfo.id || 'default_user';
    
    // 从全局方法获取订单数据
    app.getUserOrders(userId).then(orders => {
      this.setData({
        orders,
        hasOrders: orders.length > 0,
        loading: false
      });
    }).catch(err => {
      console.error('获取订单数据失败:', err);
      this.setData({
        loading: false,
        hasOrders: false
      });
      
      wx.showToast({
        title: '获取订单失败',
        icon: 'none'
      });
    });
  },

  /**
   * 查看订单详情
   */
  viewOrderDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 返回上一页
   */
  goBack: function () {
    wx.navigateBack();
  },
  
  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.fetchOrderData();
    wx.stopPullDownRefresh();
  }
}) 