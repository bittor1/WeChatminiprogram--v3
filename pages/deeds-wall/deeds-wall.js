// pages/deeds-wall/deeds-wall.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    deedsList: [],
    loading: true,
    hasMore: true,
    pageSize: 10,
    currentPage: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadDeeds();
    
    // 启用分享菜单
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.setData({
      deedsList: [],
      currentPage: 0,
      hasMore: true
    });
    this.loadDeeds().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadDeeds();
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '战绩墙 - 伦敦必吃榜',
      path: '/pages/deeds-wall/deeds-wall'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline: function () {
    return {
      title: '战绩墙 - 伦敦必吃榜',
      query: ''
    };
  },

  /**
   * 加载事迹数据
   */
  loadDeeds: async function () {
    if (this.data.loading || !this.data.hasMore) return;
    
    try {
      this.setData({ loading: true });
      wx.showLoading({ title: '加载中...' });
      
      // 模拟数据，实际项目中应该调用云函数获取数据
      const mockData = this.getMockData();
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 计算分页
      const start = this.data.currentPage * this.data.pageSize;
      const end = start + this.data.pageSize;
      const pageData = mockData.slice(start, end);
      
      // 更新数据
      this.setData({
        deedsList: [...this.data.deedsList, ...pageData],
        currentPage: this.data.currentPage + 1,
        hasMore: end < mockData.length,
        loading: false
      });
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载事迹失败:', error);
      this.setData({ loading: false });
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 获取模拟数据
   */
  getMockData: function () {
    return [
      {
        id: '1',
        nickname: '张三',
        avatarUrl: 'https://placekitten.com/80/80',
        content: '张三路过Soho，12对情侣当场改口喊他老公',
        location: '伦敦 Soho',
        createTime: '2024-07-12'
      },
      {
        id: '2',
        nickname: '李四',
        avatarUrl: 'https://placekitten.com/81/81',
        content: '曾经Hyde Park天鹅围住张三跳求偶舞，我全程直播',
        location: '伦敦 Hyde Park',
        createTime: '2024-07-05'
      },
      {
        id: '3',
        nickname: '王五',
        avatarUrl: 'https://placekitten.com/82/82',
        content: '张三在Covent Garden请整条街免费喝酒',
        location: '伦敦 Covent Garden',
        createTime: '2024-06-28'
      },
      {
        id: '4',
        nickname: '赵六',
        avatarUrl: 'https://placekitten.com/83/83',
        content: '张三约会路过泰晤士河，The Shard外墙自行亮起"约吗"霓虹字母',
        location: '伦敦 泰晤士河',
        createTime: '2024-06-03'
      },
      {
        id: '5',
        nickname: '小明',
        avatarUrl: 'https://placekitten.com/84/84',
        content: '上周在Camden Market看到张三，结果所有摊主都争着送他东西',
        location: '伦敦 Camden Market',
        createTime: '2024-05-25'
      }
    ];
  },

  /**
   * "爆料新事迹"按钮点击事件
   */
  onReportNewDeed: function() {
    const app = getApp();
    
    // 检查登录状态
    if (!app.checkUserLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到事迹提交页面
    wx.navigateTo({
      url: '/pages/report-deed/report-deed',
      fail: function(err) {
        console.error("跳转失败:", err);
        
        // 如果页面不存在，显示提示
        wx.showModal({
          title: '功能开发中',
          content: '爆料新事迹功能正在开发中，敬请期待！',
          showCancel: false
        });
      }
    });
  }
}) 