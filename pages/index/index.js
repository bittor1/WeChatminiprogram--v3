// pages/index/index.js
Page({
  data: {
    rankings: [],
    totalVotes: 0,
    showUserCenter: false,
    userInfo: null
  },

  onLoad() {
    // 获取app全局数据
    const app = getApp();
    const rankings = app.globalData.rankings || [];
    
    // 计算总投票数
    const totalVotes = this.calculateTotalVotes(rankings);
    
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo') || null;
    
    // 更新数据
    this.setData({
      rankings,
      totalVotes,
      userInfo
    });
  },
  
  onShow() {
    // 页面显示时刷新数据
    this.onLoad();
  },
  
  // 计算总投票数
  calculateTotalVotes(rankings) {
    return rankings.reduce((total, item) => total + item.votes, 0);
  },
  
  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },
  
  // 跳转到创建页
  goToCreate() {
    wx.navigateTo({
      url: '/pages/create/create'
    });
  },
  
  // 跳转到关于页
  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },
  
  // 打开用户中心抽屉
  openUserCenter(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // 记录抽屉打开时间，用于防止快速关闭
    this._drawerOpenTime = Date.now();
    
    // 添加一个短暂的视觉反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 打印详细日志
    console.log('尝试打开用户中心 - 详细信息:', {
      event: e,
      timestamp: new Date().toISOString(),
      userInfo: this.data.userInfo ? '已登录' : '未登录'
    });

    // 如果用户未登录，则获取微信用户信息
    if (!this.data.userInfo) {
      wx.showLoading({
        title: '加载中...',
      });
      
      // 获取微信用户信息
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          wx.hideLoading();
          
          const userInfo = {
            id: "current_user",
            name: res.userInfo.nickName,
            avatar: res.userInfo.avatarUrl,
            votes: 0
          };
          
          wx.setStorageSync('userInfo', userInfo);
          
          // 确保界面更新后再打开抽屉
          this.setData({
            userInfo: userInfo
          }, () => {
            // 在回调中设置显示抽屉
            this.setData({
              showUserCenter: true
            });
            
            console.log('用户中心已打开', this.data.showUserCenter);
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('获取用户信息失败:', err);
          
          // 使用默认用户信息
          const mockUserInfo = {
            id: "current_user",
            name: "当前用户",
            avatar: "/public/placeholder-user.jpg",
            votes: 0
          };
          
          wx.setStorageSync('userInfo', mockUserInfo);
          
          // 确保界面更新后再打开抽屉
          this.setData({
            userInfo: mockUserInfo
          }, () => {
            // 在回调中设置显示抽屉
            this.setData({
              showUserCenter: true
            });
            console.log('用户中心已打开（使用默认用户）', this.data.showUserCenter);
          });
        }
      });
    } else {
      // 已登录用户，直接打开抽屉
      this.setData({
        showUserCenter: true
      });
      
      console.log('用户中心已打开（已登录用户）', this.data.showUserCenter);
    }
  },
  
  // 关闭用户中心抽屉
  closeUserCenter() {
    // 检查是否是快速关闭（防止意外关闭）
    const now = Date.now();
    if (this._drawerOpenTime && now - this._drawerOpenTime < 500) {
      console.log('抽屉刚刚打开，忽略关闭请求');
      return;
    }
    
    this.setData({
      showUserCenter: false
    });
    
    console.log('用户中心已关闭');
  },
  
  // 处理用户退出登录
  handleUserLogout() {
    this.setData({
      userInfo: null
    });
    
    console.log('用户已退出登录');
  }
})