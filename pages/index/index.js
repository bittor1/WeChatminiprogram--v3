// pages/index/index.js
const cloudUtils = require('../../utils/cloudUtils');

Page({
  data: {
    rankings: [],
    totalVotes: 0,
    totalNominations: 0,
    totalUsers: 0,
    voteGrowthRate: 0,
    showUserCenter: false,
    showAuthDialog: false, // 控制授权对话框显示
    userInfo: null,
    isLoading: true,
    loadError: false,
    drawerTopOffset: 40,
    shareSupport: {
      canShareTimeline: false,
      canShowShareMenu: false
    },
    isRefreshing: false, // 防止重复刷新
    hasInitialized: false, // 标记是否已初始化
    _pendingAction: null // 待执行的操作
  },

  onLoad() {
    // 获取应用实例
    const app = getApp();
    
    // 在新的登录策略下，只有确认已登录才显示用户信息
    console.log('页面加载，检查登录状态:', {
      isLoggedIn: app.globalData.isLoggedIn,
      hasUserInfo: !!app.globalData.userInfo
    });
    
    if (app.globalData.isLoggedIn && app.globalData.userInfo && app.globalData.userInfo.isInfoComplete) {
      console.log('用户已登录且信息完整，显示用户信息');
      this.setData({ 
        userInfo: app.globalData.userInfo 
      });
    } else {
      console.log('用户未登录或信息不完整，保持游客状态');
      this.setData({ 
        userInfo: null 
      });
    }
    
    // 首次加载时强制刷新数据
    this.refreshData();
    
    // 使用辅助函数启用分享菜单
    const shareSupport = cloudUtils.enableShareMenu();
    this.setData({ shareSupport });
  },
  
  onShow() {
    // 如果已经初始化过，使用常规加载
    if (this.data.hasInitialized) {
      this.loadData();
    }
    // 否则等待 onLoad 中的初始化完成
  },

  // 加载数据
  loadData() {
    this.setData({ isLoading: true, loadError: false });
    wx.showLoading({ title: '加载中...', mask: true });

    // 获取app全局数据
    const app = getApp();
    const rankings = app.globalData.rankings || [];
    
    // 移除自动刷新逻辑，避免死循环
    
    // 计算总投票数
    const totalVotes = this.calculateTotalVotes(rankings);
    
    // 计算超过百人想吃的人数
    const totalPopular = this.calculatePopularUsers(rankings);
    
    // 更新数据 - 不再自动加载用户信息
    this.setData({
      rankings,
      totalVotes,
      totalUsers: totalPopular, // 更新为超过百人想吃的人数
      isLoading: false
    });
    
    wx.hideLoading();
  },

  // 加载统计数据
  loadStatistics() {
    wx.cloud.callFunction({
      name: 'statistics',
      data: {
        action: 'getDashboardStats'
      }
    })
    .then(res => {
      if (res.result && res.result.success) {
        const stats = res.result.data;
        this.setData({
          // 不从云函数获取totalVotes，而是使用本地计算的值
          // totalVotes: stats.totalVotes,
          totalNominations: stats.nominationsCount,
          // 不从云函数获取totalUsers，我们现在使用计算的超过百人想吃数
          // totalUsers: stats.totalUsers,
          voteGrowthRate: stats.voteGrowthRate
        });
      } else {
        console.warn('获取统计数据返回异常:', res);
      }
    })
    .catch(err => {
      console.error('加载统计数据失败:', err);
      wx.showToast({
        title: '统计数据加载失败',
        icon: 'none'
      });
    });
  },

  // 刷新数据
  refreshData() {
    // 防止重复刷新
    if (this.data.isRefreshing) {
      console.log('正在刷新中，跳过重复请求');
      return;
    }
    
    const app = getApp();
    this.setData({ isLoading: true, loadError: false, isRefreshing: true });
    wx.showLoading({ title: '刷新中...', mask: true });

    // 刷新排行榜数据
    app.refreshRankingData()
      .then((rankings) => {
        // 确保rankings是有效的数组
        const validRankings = Array.isArray(rankings) ? rankings : app.globalData.rankings || [];
        
        // 计算总投票数
        const totalVotes = this.calculateTotalVotes(validRankings);
        
        // 计算超过百人想吃的人数
        const totalPopular = this.calculatePopularUsers(validRankings);
        
        this.setData({
          rankings: validRankings,
          totalVotes: totalVotes, // 明确设置计算出的总投票数
          totalUsers: totalPopular, // 更新为超过百人想吃的人数
          isLoading: false,
          isRefreshing: false, // 刷新完成
          hasInitialized: true // 标记已初始化
        });

        // 刷新统计数据
        this.loadStatistics();
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('刷新数据失败:', err);
        
        // 出错时仍然显示全局数据
        const rankings = app.globalData.rankings || [];
        
        // 确保即使出错也更新总投票数
        const totalVotes = this.calculateTotalVotes(rankings);
        
        // 计算超过百人想吃的人数
        const totalPopular = this.calculatePopularUsers(rankings);
        
        this.setData({
          rankings,
          totalVotes: totalVotes, // 明确设置计算出的总投票数
          totalUsers: totalPopular, // 更新为超过百人想吃的人数
          isLoading: false,
          loadError: true, // 显示错误状态
          isRefreshing: false, // 错误时也要重置刷新状态
          hasInitialized: true // 错误时也标记已初始化
        });
        
        wx.hideLoading();
        wx.showToast({
          title: '刷新数据失败',
          icon: 'none'
        });
      });
  },
  
  // 计算总投票数
  calculateTotalVotes(rankings) {
    return rankings.reduce((total, item) => total + item.votes, 0);
  },
  
  // 计算超过百人想吃的人数
  calculatePopularUsers(rankings) {
    return rankings.filter(item => item.votes >= 100).length;
  },
  
  // 跳转到详情页 - 智能预加载优化
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    
    console.log('🎯 用户点击详情页，开始智能预加载:', id);
    
    // 立即开始预加载数据
    const app = getApp();
    app.preloadManager.preloadDetailData(id);
    
    // 跳转到详情页
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },
  
  // 跳转到创建页
  goToCreate() {
    console.log('跳转到创建页');
    
    // 使用requireLogin确保用户已登录
    this.requireLogin(() => {
      wx.navigateTo({
        url: '../create/create',
        fail: (err) => {
          console.error('跳转到创建页失败:', err);
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          });
        }
      });
    }, '提名功能');
  },
  
  // 跳转到添加页
  goToAdd() {
    wx.navigateTo({
      url: '../add/add',
      fail: (err) => {
        console.error('跳转到添加页失败:', err);
      }
    });
  },
  
  // 跳转到关于页
  goToAbout() {
    console.log('跳转到关于页');
    wx.navigateTo({
      url: '../about/about',
      fail: (err) => {
        console.error('跳转到关于页失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 打开用户中心抽屉
  openUserCenter(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // 如果抽屉已经显示，则不再重复打开
    if (this.data.showUserCenter) {
      return;
    }

    const app = getApp();

    // 定义打开抽屉的具体操作
    const openDrawerAction = () => {
      // 测量标题位置，用于抽屉顶部对齐
      const query = wx.createSelectorQuery();
      query.select('.main-title').boundingClientRect();
      query.exec(res => {
        const rect = res && res[0];
        const topOffset = rect ? Math.max(0, Math.floor(rect.top)) : 40;
        
        // 设置抽屉顶部偏移，然后显示抽屉
        this.setData({ drawerTopOffset: topOffset }, () => {
          // 记录抽屉打开时间，用于防止快速关闭
          this._drawerOpenTime = Date.now();
          
          // 从缓存中获取最新的用户信息
          const storedUserInfo = wx.getStorageSync('userInfo');
          
          this.setData({ 
            showUserCenter: true,
            userInfo: storedUserInfo || null
          });
        });
      });
    };

    // 检查是否已登录
    if (app.globalData.isLoggedIn) {
      // 如果已登录，直接打开抽屉
      openDrawerAction();
    } else {
      // 未登录，触发新的登录流程
      this.triggerLoginForUserCenter(openDrawerAction);
    }
  },

  // 为用户中心触发登录流程
  async triggerLoginForUserCenter(openDrawerAction) {
    try {
      wx.showLoading({ title: '登录中...', mask: true });
      
      const app = getApp();
      const loginResult = await app.triggerLogin();
      wx.hideLoading();
      
      if (loginResult.success) {
        if (loginResult.needsUserInfo) {
          // 需要完善用户信息，显示授权弹窗
          this.setData({ 
            showAuthDialog: true,
            _pendingAction: openDrawerAction // 保存待执行的操作
          });
        } else {
          // 登录成功，用户信息完整，执行原本的操作
          openDrawerAction();
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 通用的需要登录功能触发器
  async requireLogin(action, actionName = '该功能') {
    const app = getApp();
    
    if (app.globalData.isLoggedIn) {
      // 已登录，直接执行操作
      if (typeof action === 'function') {
        action();
      }
      return true;
    } else {
      // 未登录，触发登录流程
      try {
        wx.showLoading({ title: '登录中...', mask: true });
        
        const loginResult = await app.triggerLogin();
        wx.hideLoading();
        
        if (loginResult.success) {
          if (loginResult.needsUserInfo) {
            // 需要完善用户信息，显示授权弹窗
            this.setData({ 
              showAuthDialog: true,
              _pendingAction: action // 保存待执行的操作
            });
            
            wx.showToast({
              title: `请完善用户信息以使用${actionName}`,
              icon: 'none',
              duration: 2000
            });
          } else {
            // 登录成功，用户信息完整，执行操作
            if (typeof action === 'function') {
              action();
            }
          }
          return true;
        }
      } catch (err) {
        wx.hideLoading();
        console.error('登录失败:', err);
        wx.showToast({
          title: `需要登录才能使用${actionName}`,
          icon: 'none'
        });
      }
      return false;
    }
  },
  
  // 保存用户信息到云数据库
  saveUserInfo(openid, userInfo, callback) {
    wx.cloud.callFunction({
      name: 'userManage',
      data: {
        action: 'saveUserInfo',
        openid: openid,
        userInfo: userInfo
      },
      success: (res) => {
        console.log('保存用户信息成功:', res);
        wx.hideLoading();
        
        if (res.result && res.result.code === 200) {
          // 保存用户信息到本地
          wx.setStorageSync('userInfo', res.result.userInfo);
          
          // 更新全局用户信息
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userInfo = res.result.userInfo;
          }
          
          // 更新页面数据
          this.setData({
            userInfo: res.result.userInfo
          });
          
          // 执行回调函数（打开抽屉）
          if (typeof callback === 'function') {
            callback();
          }
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('保存用户信息失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 调用用户登录云函数
  callUserLogin(userData) {
    wx.cloud.callFunction({
      name: 'userManage',
      data: {
        action: 'login',
        userData
      }
    })
    .then(res => {
      console.log('用户登录成功:', res);
      
      // 更新本地存储的用户信息
      if (res.result && res.result.success && res.result.data) {
        const updatedUserInfo = res.result.data;
        
        // 合并返回的用户信息
        const userInfo = {
          ...this.data.userInfo,
          id: updatedUserInfo._id,
          votes: updatedUserInfo.votes || 0,
          nickname: updatedUserInfo.nickname || this.data.userInfo.nickname,
          name: updatedUserInfo.name || updatedUserInfo.nickname || this.data.userInfo.name,
          avatar: updatedUserInfo.avatar || this.data.userInfo.avatar,
          avatarUrl: updatedUserInfo.avatarUrl || this.data.userInfo.avatarUrl
        };
        
        // 更新数据
        wx.setStorageSync('userInfo', userInfo);
        this.setData({ userInfo });
      }
    })
    .catch(err => {
      console.error('用户登录失败:', err);
    });
  },
  
  // 处理用户退出登录
  handleUserLogout() {
    this.setData({
      userInfo: null
    });
    
    // 清除本地存储中的用户信息
    wx.removeStorageSync('userInfo');
    
    // 关闭用户中心抽屉
    this.closeUserCenter();
  },

  // 处理用户登录事件
  handleUserLogin(e) {
    const userInfo = e.detail.userInfo;
    this.setData({ userInfo });
  },

  // 处理用户信息更新事件
  handleUserInfoUpdate(e) {
    const userInfo = e.detail.userInfo;
    this.setData({ userInfo });
  },
  

  
  // 处理授权成功
  handleAuthSuccess(e) {
    console.log('授权登录成功:', e.detail);
    const app = getApp();
    
    // 更新全局状态
    app.globalData.isLoggedIn = true;
    app.globalData.needsUserInfo = false;
    
    // 关闭授权对话框
    this.setData({ showAuthDialog: false });
    
    // 刷新用户信息和页面数据
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo;
    this.setData({ userInfo });
    this.refreshData();
    
    // 如果有待执行的操作，执行它
    if (this.data._pendingAction) {
      this.data._pendingAction();
      this.setData({ _pendingAction: null });
    }
    
    wx.showToast({
      title: '登录成功',
      icon: 'success'
    });
  },
  
  // 处理授权取消
  handleAuthCancel() {
    console.log('用户取消授权');
    this.setData({ showAuthDialog: false });
    
    // 用户取消授权，可以继续使用游客模式
    wx.showToast({
      title: '您可以先浏览内容',
      icon: 'none'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData();
    wx.stopPullDownRefresh();
  },
  
  // 用于分享到好友
  onShareAppMessage() {
    return {
      title: '伦敦必吃榜',
      path: '/pages/index/index',
      imageUrl: '/images/share-pic.png' // 主页分享使用专用logo
    };
  },

  // 用于分享到朋友圈
  onShareTimeline() {
    return {
      title: '伦敦必吃榜',
      query: '',
      imageUrl: '/images/share-pic.png' // 使用专用分享图片
    };
  },
  
  // 记录分享行为
  recordShareAction(type) {
    // 获取当前的分享平台信息
    const platform = type === 'timeline' ? 'timeline' : 'wechat';
    
    // 获取合适的标题和路径
    let title = '伦敦必吃榜';
    const path = '/pages/index/index';
    
    if (type === 'timeline') {
      title = '伦敦必吃榜 - 人气排行榜';
    } else {
      title = '伦敦必吃榜 - 寻找伦敦最佳美食';
    }
    
    // 调用分享分析云函数
    wx.cloud.callFunction({
      name: 'shareAnalytics',
      data: {
        action: 'recordShare',
        shareData: {
          type: type,
          platform: platform,
          targetId: 'ranking_index',
          title: title,
          path: path
        }
      }
    })
    .catch(err => {
      console.error('记录分享行为失败:', err);
    });
  },

  // 关闭用户中心抽屉
  closeUserCenter() {
    // 检查是否是快速关闭（防止意外关闭）
    const now = Date.now();
    if (this._drawerOpenTime && now - this._drawerOpenTime < 300) {
      return;
    }
    
    this.setData({
      showUserCenter: false
    });
  }
})