// app.js
const cloudUtils = require('./utils/cloudUtils');

// 彻底禁用已废弃的 wx.getSystemInfoSync API
if (wx.getSystemInfoSync) {
  const originalGetSystemInfoSync = wx.getSystemInfoSync;
  wx.getSystemInfoSync = function() {
    console.warn('⚠️ wx.getSystemInfoSync 已废弃，正在使用新API替代');
    
    // 使用同步方式返回系统信息，以保持兼容性
    try {
      // 尝试使用新API
      if (typeof wx.getSystemSetting === 'function' &&
          typeof wx.getDeviceInfo === 'function' &&
          typeof wx.getWindowInfo === 'function' &&
          typeof wx.getAppBaseInfo === 'function') {
        
        const systemSetting = wx.getSystemSetting();
        const deviceInfo = wx.getDeviceInfo();
        const windowInfo = wx.getWindowInfo();
        const appBaseInfo = wx.getAppBaseInfo();
        
        return {
          ...systemSetting,
          ...deviceInfo,
          ...windowInfo,
          ...appBaseInfo
        };
      } else {
        // 对于旧版本，尝试调用原始函数一次，如果失败则使用默认值
        console.warn('基础库版本较低，尝试获取基础系统信息');
        try {
          return originalGetSystemInfoSync.call(this);
        } catch (fallbackError) {
          console.warn('原始API也失败，使用默认系统信息:', fallbackError);
          return {
            platform: 'unknown',
            system: 'unknown',
            version: 'unknown',
            model: 'unknown',
            pixelRatio: 2,
            screenWidth: 375,
            screenHeight: 667,
            windowWidth: 375,
            windowHeight: 667,
            statusBarHeight: 20,
            language: 'zh_CN',
            fontSizeSetting: 16
          };
        }
      }
    } catch (error) {
      console.error('系统信息获取失败，使用默认值:', error);
      return {
        platform: 'unknown',
        system: 'unknown',
        version: 'unknown',
        model: 'unknown',
        pixelRatio: 2,
        screenWidth: 375,
        screenHeight: 667,
        windowWidth: 375,
        windowHeight: 667,
        statusBarHeight: 20,
        language: 'zh_CN',
        fontSizeSetting: 16
      };
    }
  };
}

App({
  onLaunch: function() {
    console.log('应用初始化');
    
    // 初始化网络管理器
    this.networkManager.init();
    
    // 测试性能监控器
    this.performanceMonitor.test();
    
    // 初始化云开发
    this.initializeCloudDevelopment();
    
    // 记录当前版本
    console.log('当前版本: 1.0.2');
    
    // 清除可能导致问题的缓存
    this.clearProblemCache();
    
    // 新的登录策略：每次进入小程序都是未登录状态
    // 用户需要主动点击用户中心或需要登录的功能时才触发登录
    this.setInitialGuestState();
    
    // 检查每日投票限制重置
    this.checkDailyVoteLimitReset();
    
    // 检查分享功能支持
    this.checkShareSupport();
    
    // 检查图片资源是否存在
    this.checkImageResources();
    
    // 预加载图片
    this.preloadImages();
  },
  
  // 检查分享功能支持
  checkShareSupport() {
    // 获取分享功能支持信息
    const shareSupport = cloudUtils.checkShareSupport();
    this.globalData.shareSupport = shareSupport;
    
    console.log('分享功能支持检查:', shareSupport);
  },
  
  // 在全局启用分享功能
  enableShareMenu() {
    return cloudUtils.enableShareMenu();
  },
  
  // 显示分享成功提示
  showShareSuccess() {
    cloudUtils.showShareSuccess();
  },
  
  // 清除可能导致问题的缓存
  clearProblemCache: function() {
    try {
      console.log('清理缓存数据...');
      // 不要清除用户信息
      // 清除其他可能导致问题的数据
    } catch (e) {
      console.error('清理缓存出错:', e);
    }
  },
  
  // 检查每日投票限制是否需要重置
  checkDailyVoteLimitReset: function() {
    try {
      const lastResetDateStr = wx.getStorageSync('lastVoteLimitResetDate');
      const now = new Date();
      const today = this.getDateString(now);
      
      if (!lastResetDateStr || lastResetDateStr !== today) {
        console.log('重置每日投票限制...');
        
        // 清除所有投票限制记录
        const storage = wx.getStorageInfoSync({});
        const keys = storage.keys;
        
        keys.forEach(key => {
          if (key.startsWith('voteLimits_') || key.startsWith('downvoteLimits_')) {
            wx.removeStorageSync(key);
          }
        });
        
        // 记录今天的重置日期
        wx.setStorageSync('lastVoteLimitResetDate', today);
      }
    } catch (e) {
      console.error('检查每日投票限制重置出错:', e);
    }
  },
  
  // 获取日期字符串 YYYY-MM-DD
  getDateString: function(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },
  
  // 初始化云开发
  initializeCloudDevelopment: function() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true, // 记录用户访问、调用信息
        env: 'cloud1-2g2sby6z920b76cb' // 更新为新的云开发环境ID
      })
      console.log('云开发初始化成功')
    } else {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    }
    
    // 展示本地存储能力
    const logs = wx.getStorageSync("logs") || []
    logs.unshift(Date.now())
    wx.setStorageSync("logs", logs)
  },

  // 设置初始游客状态
  setInitialGuestState: function() {
    console.log('设置初始游客状态...');
    
    // 彻底清除所有可能的登录相关缓存
    try {
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('openid');
      wx.removeStorageSync('sessionKey');
      console.log('已清除所有登录相关缓存');
    } catch (e) {
      console.error('清除缓存失败:', e);
    }
    
    // 强制设置全局游客状态
    this.globalData.userInfo = null;
    this.globalData.token = null;
    this.globalData.isLoggedIn = false;
    this.globalData.needsUserInfo = false;
    this.globalData.openid = null;
    
    // 输出状态确认
    console.log('游客状态设置完成:', {
      isLoggedIn: this.globalData.isLoggedIn,
      userInfo: this.globalData.userInfo,
      token: this.globalData.token
    });
    
    // 加载排行榜数据（游客也可以查看）
    this.refreshRankingData().catch(err => {
      console.error('游客模式加载排行榜数据失败:', err);
    });
  },

  // 触发登录流程（被用户点击事件调用）
  triggerLogin: function() {
    console.log('触发登录流程...');
    
    return new Promise((resolve, reject) => {
      // 先获取微信登录凭证
      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('获取到登录凭证:', res.code);
            
            // 调用登录云函数获取用户基础信息
            wx.cloud.callFunction({
              name: 'login',
              data: {
                code: res.code,
                deviceInfo: this.getDeviceInfo()
              }
            }).then(loginRes => {
              console.log('登录云函数结果:', loginRes);
              
              if (loginRes.result && loginRes.result.success) {
                const { token, userInfo } = loginRes.result.data;
                
                // 保存token
                wx.setStorageSync('token', token);
                this.globalData.token = token;
                
                // 检查用户信息是否完整
                const isInfoComplete = userInfo && 
                                     userInfo.nickname && 
                                     userInfo.nickname.trim() !== '' &&
                                     userInfo.avatarUrl && 
                                     userInfo.avatarUrl.trim() !== '' &&
                                     userInfo.isInfoComplete !== false;
                
                if (isInfoComplete) {
                  // 用户信息完整，直接登录成功
                  wx.setStorageSync('userInfo', userInfo);
                  this.globalData.userInfo = userInfo;
                  this.globalData.isLoggedIn = true;
                  
                  console.log('登录成功，用户信息完整');
                  resolve({ success: true, userInfo });
                } else {
                  // 用户信息不完整，需要显示授权弹窗
                  console.log('登录成功，但需要完善用户信息');
                  this.globalData.userInfo = userInfo;
                  this.globalData.needsUserInfo = true;
                  
                  resolve({ success: true, needsUserInfo: true, userInfo });
                }
              } else {
                console.error('登录失败:', loginRes.result?.message);
                reject(new Error(loginRes.result?.message || '登录失败'));
              }
            }).catch(err => {
              console.error('调用登录云函数失败:', err);
              reject(err);
            });
          } else {
            console.error('获取登录凭证失败:', res.errMsg);
            reject(new Error('获取登录凭证失败'));
          }
        },
        fail: (err) => {
          console.error('wx.login失败:', err);
          reject(err);
        }
      });
    });
  },

  // 处理登录失败
  handleLoginFailure: function() {
    console.log('登录失败，使用游客模式');
    
    // 清除可能存在的无效token
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    
    // 设置游客状态
    this.globalData.userInfo = null;
    this.globalData.token = null;
    this.globalData.isLoggedIn = false;
    this.globalData.needsUserInfo = false;
    
    // 仍然加载排行榜数据（游客也可以查看）
    this.refreshRankingData().catch(err => {
      console.error('游客模式加载排行榜数据失败:', err);
    });
  },
  
  // 用户退出登录
  handleUserLogout: function() {
    console.log('用户主动退出登录');
    
    // 清除所有登录相关数据
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    
    // 重置为游客状态
    this.globalData.userInfo = null;
    this.globalData.token = null;
    this.globalData.isLoggedIn = false;
    this.globalData.needsUserInfo = false;
    
    // 显示退出成功提示
    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    });
  },

  // 获取设备信息
  getDeviceInfo: function() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      return {
        platform: systemInfo.platform,
        system: systemInfo.system,
        version: systemInfo.version,
        model: systemInfo.model
      };
    } catch (err) {
      console.error('获取设备信息失败:', err);
      return {};
    }
  },
  
  // 检查并初始化数据库
  initializeDatabase: function() {
    if (!wx.cloud) {
      console.error('云开发未初始化，无法初始化数据库');
      return;
    }
    
    // 暂时注释掉数据库初始化检查，避免权限错误
    // 数据库应该由管理员在云开发控制台手动创建
    /*
    wx.cloud.callFunction({
      name: 'dbInit',
      data: {
        forceInit: false,       // 是否强制初始化（忽略权限检查）
        initSampleData: false   // 是否初始化示例数据
      }
    }).then(res => {
      console.log('数据库初始化检查结果:', res.result);
      
      // 如果集合未创建，重新加载排行榜数据
      const result = res.result;
      if (result && result.success) {
        const collections = result.results.collections || [];
        const hasNewCollection = collections.some(c => c.status === 'created');
        
        if (hasNewCollection) {
          console.log('检测到新建的数据库集合，重新加载排行榜数据');
          this.refreshRankingData();
        }
      }
    }).catch(err => {
      console.error('数据库初始化检查失败:', err);
    });
    */
    
    // 直接加载数据，不进行数据库初始化检查
    this.refreshRankingData();
  },
  
  // 从云数据库刷新排行榜数据
  refreshRankingData() {
    return new Promise((resolve) => {
      // 如果云开发已初始化
      if (wx.cloud) {
        // 查询所有提名
        const db = wx.cloud.database();
        const _ = db.command;
        db.collection('entries')
          .where({
            // 使用一个始终为真的条件来避免全表扫描警告
            // votes 字段大于等于 0（包括所有条目）
            votes: _.gte(0)
          })
          .orderBy('votes', 'desc')
          .orderBy('_createTime', 'desc') // 票数相同时，新上榜的排在上面
          .limit(50) // 增加限制数量，确保能看到更多提名
          .get()
          .then(res => {
            console.log('获取排行榜数据成功:', res);
            
            // 如果数据库有数据，使用数据库数据
            if (res.data && res.data.length > 0) {
              const rankings = res.data.map((item, index) => {
                return {
                  id: item._id,
                  rank: index + 1,
                  name: item.name,
                  avatar: item.avatarUrl,
                  votes: item.votes !== undefined ? item.votes : 0, // 支持负数
                  trend: item.trend || 'stable',
                  hotLevel: item.hotLevel || 1,
                  isGif: item.isGif || false,
                  createTime: item._createTime || item.createdAt || Date.now(), // 包含创建时间用于排序
                };
              });
              
              // 更新全局数据
              this.globalData.rankings = rankings;
            } else {
              // 如果没有数据，保持空数组
              this.globalData.rankings = [];
            }
            
            resolve(this.globalData.rankings);
          })
          .catch(err => {
            console.error('获取排行榜数据失败:', err);
            // 显示友好的错误提示
            wx.showToast({
              title: '获取数据失败，请重试',
              icon: 'none'
            });
            // 返回空数组而不是拒绝
            this.globalData.rankings = [];
            resolve(this.globalData.rankings);
          });
      } else {
        console.error('云开发未初始化');
        wx.showToast({
          title: '系统初始化失败',
          icon: 'none'
        });
        // 返回空数组而不是拒绝
        this.globalData.rankings = [];
        resolve(this.globalData.rankings);
      }
    });
  },
  
  // 检查用户是否已登录（基于token验证）
  checkUserLogin: function() {
    const token = wx.getStorageSync('token');
    return token && this.globalData.isLoggedIn;
  },

  // 验证token有效性（可选，用于重要操作前的验证）
  validateToken: function() {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      if (!token) {
        resolve(false);
        return;
      }

      // 可以调用云函数验证token
      wx.cloud.callFunction({
        name: 'checkSession', // 需要创建这个云函数
        data: { token }
      }).then(res => {
        if (res.result && res.result.valid) {
          resolve(true);
        } else {
          // token无效，清除本地数据
          this.handleLoginFailure();
          resolve(false);
        }
      }).catch(err => {
        console.error('验证token失败:', err);
        resolve(false);
      });
    });
  },
  
  // 检查转发状态
  checkShareStatus: function(userId, shareType) {
    try {
      const shareInfoStr = wx.getStorageSync(`shareInfo_${userId}`);
      if (!shareInfoStr) return false;
      
      const shareInfo = JSON.parse(shareInfoStr);
      return shareType === 'friend' ? shareInfo.sharedToFriend : 
             shareType === 'timeline' ? shareInfo.sharedToTimeline : false;
    } catch (e) {
      console.error('检查转发状态失败:', e);
      return false;
    }
  },
  
  // 从云数据库获取用户订单记录
  getUserOrders(userId) {
    return new Promise((resolve, reject) => {
      if (!userId) {
        reject(new Error('用户ID不能为空'));
        return;
      }
      
      // 尝试从云数据库获取订单
      if (wx.cloud) {
        wx.cloud.database().collection('orders')
          .where({
            userId: userId
          })
          .orderBy('createTime', 'desc')
          .get()
          .then(res => {
            if (res.data && res.data.length > 0) {
              // 格式化订单数据
              const orders = res.data.map(item => ({
                id: item._id,
                title: item.body,
                status: item.status,
                statusText: item.statusText,
                date: this.formatDate(new Date(item.createTime)),
                amount: item.amount,
              }));
              resolve(orders);
            } else {
              // 如果没有订单记录，返回模拟数据
              resolve(this.getMockOrders());
            }
          })
          .catch(err => {
            console.error('获取订单数据失败:', err);
            // 出错时返回模拟数据
            resolve(this.getMockOrders());
          });
      } else {
        // 如果云开发未初始化，返回模拟数据
        resolve(this.getMockOrders());
      }
    });
  },
  
  // 获取模拟订单数据
  getMockOrders() {
    return [
      {
        id: 'ORD20240708001',
        title: '投票充值10票',
        status: 'success',
        statusText: '支付成功',
        date: '2024-07-08 14:32:45',
        amount: 10.00,
      },
      {
        id: 'ORD20240707003',
        title: '减票付费',
        status: 'success',
        statusText: '支付成功',
        date: '2024-07-07 09:15:21',
        amount: 2.00,
      },
      {
        id: 'ORD20240705002',
        title: '自定义音效',
        status: 'pending',
        statusText: '处理中',
        date: '2024-07-05 18:45:32',
        amount: 6.00,
      },
      {
        id: 'ORD20240630001',
        title: '投票充值50票',
        status: 'success',
        statusText: '支付成功',
        date: '2024-06-30 10:05:19',
        amount: 50.00,
      }
    ];
  },
  
  // 格式化日期
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  },
  
  // createPayment 函数已移除
  
  // 修改checkImageResources方法，使用wx.getImageInfo替代文件系统API
  checkImageResources: function() {
    console.log('检查图片资源...');
    
    // 不使用文件系统API，直接使用预加载函数
    this.preloadImages();
  },
  
  // 添加预加载图片的方法
  preloadImages: function() {
    const imagesToPreload = [
      '/images/placeholder-user.jpg',
      '/images/placeholder.jpg',
      '/images/avatar_default.png'
    ];
    
    imagesToPreload.forEach(imagePath => {
      wx.getImageInfo({
        src: imagePath,
        success: res => {
          console.log(`预加载图片成功: ${imagePath}`, res);
        },
        fail: err => {
          console.error(`预加载图片失败: ${imagePath}`, err);
        }
      });
    });
  },

  // 全局测试方法 - 可以在控制台调用
  testVideoGif: function() {
    console.log('=== 全局视频转GIF测试 ===');
    console.log('当前页面:', getCurrentPages());
    
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      console.log('当前页面路径:', currentPage.route);
      console.log('页面data:', currentPage.data);
      
      // 检查页面是否有用户中心抽屉
      if (currentPage.route === 'pages/index/index') {
        console.log('在首页，检查用户中心抽屉组件...');
        
        // 尝试多种方式查找组件
        const userDrawer1 = currentPage.selectComponent('#user-center-drawer');
        const userDrawer2 = currentPage.selectComponent('.user-center-drawer');
        const userDrawer3 = currentPage.selectComponent('user-center-drawer');
        
        console.log('查找结果:');
        console.log('  #user-center-drawer:', !!userDrawer1);
        console.log('  .user-center-drawer:', !!userDrawer2);
        console.log('  user-center-drawer:', !!userDrawer3);
        
        if (userDrawer1 || userDrawer2 || userDrawer3) {
          const drawer = userDrawer1 || userDrawer2 || userDrawer3;
          console.log('找到用户中心抽屉组件，测试连通性...');
          if (drawer.testEntryCard) {
            drawer.testEntryCard();
          } else {
            console.log('抽屉组件没有testEntryCard方法');
          }
        } else {
          console.log('所有方式都未找到用户中心抽屉组件');
          console.log('提示：请先打开用户中心抽屉，然后重新运行测试');
        }
      }
    }
  },
  
  // 全局变量
  // 全局预加载管理器
  preloadManager: {
    cache: new Map(),
    preloadQueue: [],
    
    // 预加载detail页面数据
    preloadDetailData: function(entryId) {
      if (!entryId || this.cache.has('detail_' + entryId)) {
        return; // 已经预加载过
      }
      
      console.log('🚀 开始预加载 detail 数据:', entryId);
      
      // 预加载条目详情
      var detailPromise = wx.cloud.database().collection('entries').doc(entryId).get();
      
      // 预加载评论
      var commentPromise = wx.cloud.callFunction({
        name: 'commentManage',
        data: {
          action: 'list',
          data: {
            nominationId: entryId,
            page: 1,
            limit: 10
          }
        }
      });
      
      // 缓存预加载结果
      Promise.all([detailPromise, commentPromise]).then(function(results) {
        this.cache.set('detail_' + entryId, {
          entryData: results[0],
          commentData: results[1],
          timestamp: Date.now()
        });
        console.log('✅ detail 数据预加载完成:', entryId);
      }.bind(this)).catch(function(err) {
        console.error('❌ detail 数据预加载失败:', err);
      });
    },
    
    // 获取预加载的数据
    getPreloadedData: function(entryId) {
      var cacheKey = 'detail_' + entryId;
      var cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < 60000)) { // 60秒有效期
        console.log('📦 使用预加载数据:', entryId);
        return cached;
      }
      
      // 清除过期缓存
      if (cached) {
        this.cache.delete(cacheKey);
      }
      
      return null;
    },
    
    // 清除缓存
    clearCache: function() {
      this.cache.clear();
      console.log('🗑️ 清除预加载缓存');
    }
  },

  // 图片优化管理器
  imageOptimizer: {
    // 配置选项
    config: {
      enablePreloading: true, // 是否启用图片预加载
      maxPreloadCount: 5 // 最大预加载图片数量
    },
    // 检查图片大小并优化
    optimizeImageUrl: function(originalUrl, maxSize) {
      if (!originalUrl) return originalUrl;
      
      // 检查是否是云存储图片
      if (originalUrl.includes('tcb.qcloud.la') || originalUrl.includes('myqcloud.com')) {
        // 添加图片处理参数
        var separator = originalUrl.includes('?') ? '&' : '?';
        
        // 根据maxSize设置不同的压缩参数
        if (maxSize === 'thumbnail') {
          // 缩略图：200x200，质量70%
          return originalUrl + separator + 'imageView2/1/w/200/h/200/q/70';
        } else if (maxSize === 'medium') {
          // 中等大小：600x600，质量80%
          return originalUrl + separator + 'imageView2/1/w/600/h/600/q/80';
        } else if (maxSize === 'large') {
          // 大图：1200x1200，质量85%
          return originalUrl + separator + 'imageView2/1/w/1200/h/1200/q/85';
        }
      }
      
      return originalUrl;
    },
    
    // 预加载关键图片（微信小程序优化版）
    preloadImages: function(imageUrls) {
      // 检查是否启用预加载
      if (!this.config.enablePreloading) {
        console.log('🖼️ 图片预加载已禁用');
        return;
      }
      
      if (!Array.isArray(imageUrls)) return;
      
      // 限制预加载数量
      var urlsToPreload = imageUrls.slice(0, this.config.maxPreloadCount);
      
      urlsToPreload.forEach(function(url) {
        if (url) {
          try {
            // 微信小程序中图片预加载的最佳实践：
            // 1. 使用 wx.getImageInfo 触发图片加载
            // 2. 更轻量，不会实际下载文件
            wx.getImageInfo({
              src: url,
              success: function(res) {
                console.log('🖼️ 图片预加载完成:', url, res.width + 'x' + res.height);
              },
              fail: function(err) {
                console.warn('⚠️ 图片预加载失败:', url, err);
              }
            });
          } catch (e) {
            console.warn('⚠️ 图片预加载异常:', url, e);
          }
        }
      });
    },
    
    // GIF优化：检查文件大小
    checkGifSize: function(gifUrl) {
      if (!gifUrl || !gifUrl.includes('.gif')) return gifUrl;
      
      // 对于GIF，添加格式转换参数，转为WebP或压缩
      var separator = gifUrl.includes('?') ? '&' : '?';
      
      // 尝试转换为WebP格式（更小的文件大小）
      return gifUrl + separator + 'imageView2/2/w/800/format/webp/q/75';
    }
  },

  // 网络状况管理器
  networkManager: {
    networkType: 'unknown',
    isSlowNetwork: false,
    
    // 初始化网络监控
    init: function() {
      var self = this;
      
      // 获取当前网络状态
      wx.getNetworkType({
        success: function(res) {
          self.networkType = res.networkType;
          self.isSlowNetwork = (res.networkType === '2g' || res.networkType === 'slow-2g');
          console.log('📶 当前网络类型:', res.networkType, self.isSlowNetwork ? '(慢网络)' : '(快网络)');
        }
      });
      
      // 监听网络状态变化
      wx.onNetworkStatusChange(function(res) {
        self.networkType = res.networkType;
        self.isSlowNetwork = (res.networkType === '2g' || res.networkType === 'slow-2g');
        console.log('📶 网络状态变化:', res.networkType, self.isSlowNetwork ? '(慢网络)' : '(快网络)');
      });
    },
    
    // 获取适合当前网络的加载策略
    getLoadingStrategy: function() {
      if (this.isSlowNetwork) {
        return {
          imageQuality: 'thumbnail', // 低质量图片
          enablePreload: false, // 禁用预加载
          batchSize: 5, // 小批量加载
          timeout: 10000 // 更长超时时间
        };
      } else {
        return {
          imageQuality: 'medium', // 中等质量图片
          enablePreload: true, // 启用预加载
          batchSize: 10, // 正常批量加载
          timeout: 5000 // 正常超时时间
        };
      }
    }
  },

  // 性能监控管理器
  performanceMonitor: {
    metrics: {
      pageLoadTimes: [],
      networkRequestTimes: [],
      imageLoadTimes: [],
      cacheHitRate: 0
    },
    
    // 开始性能监控
    startMonitoring: function(type, id) {
      var self = this;
      var startTime = Date.now();
      return {
        type: type,
        id: id || 'default',
        startTime: startTime,
        
        // 结束监控
        end: function() {
          var endTime = Date.now();
          var duration = endTime - startTime;
          
          self.recordMetric(type, duration);
          console.log('⏱️ 性能监控 [' + type + ']:', duration + 'ms');
          
          return duration;
        }
      };
    },
    
    // 记录性能指标
    recordMetric: function(type, duration) {
      switch(type) {
        case 'pageLoad':
          this.metrics.pageLoadTimes.push(duration);
          if (this.metrics.pageLoadTimes.length > 50) {
            this.metrics.pageLoadTimes.shift(); // 保持最近50条记录
          }
          break;
        case 'networkRequest':
          this.metrics.networkRequestTimes.push(duration);
          if (this.metrics.networkRequestTimes.length > 100) {
            this.metrics.networkRequestTimes.shift();
          }
          break;
        case 'imageLoad':
          this.metrics.imageLoadTimes.push(duration);
          if (this.metrics.imageLoadTimes.length > 50) {
            this.metrics.imageLoadTimes.shift();
          }
          break;
      }
    },
    
    // 获取性能报告
    getPerformanceReport: function() {
      var calculateAverage = function(arr) {
        return arr.length > 0 ? arr.reduce(function(a, b) { return a + b; }) / arr.length : 0;
      };
      
      return {
        averagePageLoadTime: Math.round(calculateAverage(this.metrics.pageLoadTimes)),
        averageNetworkTime: Math.round(calculateAverage(this.metrics.networkRequestTimes)),
        averageImageLoadTime: Math.round(calculateAverage(this.metrics.imageLoadTimes)),
        cacheHitRate: this.metrics.cacheHitRate,
        totalSamples: {
          pageLoads: this.metrics.pageLoadTimes.length,
          networkRequests: this.metrics.networkRequestTimes.length,
          imageLoads: this.metrics.imageLoadTimes.length
        }
      };
    },
    
    // 更新缓存命中率
    updateCacheHitRate: function(hit, total) {
      this.metrics.cacheHitRate = total > 0 ? Math.round((hit / total) * 100) : 0;
    },
    
    // 测试性能监控器
    test: function() {
      console.log('🧪 测试性能监控器...');
      try {
        var tracker = this.startMonitoring('test', 'test');
        setTimeout(function() {
          var duration = tracker.end();
          console.log('✅ 性能监控器测试成功，耗时:', duration + 'ms');
        }, 100);
      } catch (e) {
        console.error('❌ 性能监控器测试失败:', e);
      }
    }
  },

  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    needsUserInfo: false, // 标记是否需要收集用户信息
    shareSupport: {
      canShareTimeline: false,
      canShowShareMenu: false
    },
    rankings: [] // 初始化为空数组
  },
})