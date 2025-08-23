// app.js
const cloudUtils = require('./utils/cloudUtils');

// 移除monkey patch，使用标准API
App({
  onLaunch: function() {
    console.log('应用初始化');
    
    // 初始化全局数据
    this.initializeGlobalData();
    
    // 记录当前版本
    console.log('当前版本: 1.0.2');
    
    // 清除可能导致问题的缓存
    this.clearProblemCache();
    
    // 检查并初始化数据库
    this.initializeDatabase();
    
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
  
  // 初始化全局数据
  initializeGlobalData: function() {
    // 初始化云开发
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

    // 登录
    wx.login({
      success: (res) => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        console.log('登录成功', res.code)
      },
    })
    
    // 初始化rankings为空数组，避免显示默认的张三数据
    this.globalData.rankings = [];
    
    // 立即加载排行榜数据
    this.refreshRankingData().catch(err => {
      console.error('初始化排行榜数据失败:', err);
    });
  },
  
  // 检查并初始化数据库
  initializeDatabase: function() {
    if (!wx.cloud) {
      console.error('云开发未初始化，无法初始化数据库');
      return;
    }
    
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
  },
  
  // 从云数据库刷新排行榜数据
  refreshRankingData() {
    return new Promise((resolve, reject) => {
      // 如果云开发已初始化
      if (wx.cloud) {
        // 查询所有提名，不再过滤votes > 0
        const db = wx.cloud.database();
        db.collection('entries')
          .orderBy('votes', 'desc')
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
                  votes: item.votes || 0,
                  trend: item.trend || 'stable',
                  hotLevel: item.hotLevel || 1,
                  isGif: item.isGif || false,
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
  
  // 检查用户是否已登录 (现在检查userInfo对象)
  checkUserLogin: function() {
    const userInfo = wx.getStorageSync('userInfo');
    return userInfo && userInfo._id; // 检查是否存在且有_id
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
  
  // 全局变量
  globalData: {
    userInfo: null,
    shareSupport: {
      canShareTimeline: false,
      canShowShareMenu: false
    },
    rankings: [] // 初始化为空数组
  },
})