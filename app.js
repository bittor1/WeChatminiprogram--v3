// app.js
const paymentUtils = require('./utils/paymentUtils');

App({
  onLaunch: function() {
    console.log('应用初始化');
    
    // 初始化全局数据
    this.initializeGlobalData();
    
    // 记录当前版本
    console.log('当前版本: 1.0.1');
    
    // 清除可能导致问题的缓存
    this.clearProblemCache();
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
  
  // 初始化全局数据
  initializeGlobalData: function() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true, // 记录用户访问、调用信息
        env: 'dechi-leaderboard-1gxyz' // 云开发环境ID，请替换为您自己的环境ID
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
    
    // 加载排行榜数据
    this.refreshRankingData();
  },
  
  // 从云数据库刷新排行榜数据
  refreshRankingData() {
    // 如果云开发已初始化
    if (wx.cloud) {
      wx.cloud.database().collection('entries')
        .orderBy('votes', 'desc')
        .limit(10)
        .get()
        .then(res => {
          console.log('获取排行榜数据成功:', res);
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
          if (rankings.length > 0) {
            this.globalData.rankings = rankings;
          }
        })
        .catch(err => {
          console.error('获取排行榜数据失败:', err);
        });
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
  
  // 创建并处理支付
  createPayment(type, count, targetId, userId) {
    return new Promise((resolve, reject) => {
      // 生成订单
      const orderData = paymentUtils.generateOrder(type, count, userId);
      // 添加目标用户ID
      orderData.targetId = targetId;
      
      // 发起支付
      paymentUtils.requestPayment(orderData)
        .then(res => {
          // 支付成功后保存订单
          return paymentUtils.saveOrderToDb(orderData);
        })
        .then(() => {
          // 返回成功结果
          resolve({
            success: true,
            orderData
          });
        })
        .catch(err => {
          // 返回错误结果
          reject(err);
        });
    });
  },
  
  // 全局变量
  globalData: {
    userInfo: null,
    rankings: [
      {
        id: "1",
        rank: 1,
        name: "张三",
        avatar: "/public/placeholder-user.jpg",
        votes: 1250,
        trend: "up",
        hotLevel: 5,
        isGif: false,
      },
      {
        id: "2", 
        rank: 2,
        name: "李四",
        avatar: "/public/placeholder-user.jpg",
        votes: 1120,
        trend: "up",
        hotLevel: 4,
        isGif: false,
      },
      {
        id: "3",
        rank: 3,
        name: "王五",
        avatar: "/public/placeholder-user.jpg",
        votes: 980,
        trend: "stable",
        hotLevel: 3,
        isGif: true,
      },
      {
        id: "4",
        rank: 4,
        name: "赵六",
        avatar: "/public/placeholder-user.jpg",
        votes: 820,
        trend: "down",
        hotLevel: 2,
        isGif: false,
      },
      {
        id: "5",
        rank: 5,
        name: "钱七",
        avatar: "/public/placeholder-user.jpg",
        votes: 750,
        trend: "up",
        hotLevel: 3,
        isGif: false,
      },
      {
        id: "6",
        rank: 6,
        name: "孙八",
        avatar: "/public/placeholder-user.jpg",
        votes: 680,
        trend: "stable",
        hotLevel: 2,
        isGif: false,
      },
      {
        id: "7",
        rank: 7,
        name: "周九",
        avatar: "/public/placeholder-user.jpg",
        votes: 620,
        trend: "down",
        hotLevel: 2,
        isGif: true,
      },
      {
        id: "8",
        rank: 8,
        name: "吴十",
        avatar: "/public/placeholder-user.jpg",
        votes: 550,
        trend: "down",
        hotLevel: 1,
        isGif: false,
      },
      {
        id: "9",
        rank: 9,
        name: "郑十一",
        avatar: "/public/placeholder-user.jpg",
        votes: 480,
        trend: "stable",
        hotLevel: 1,
        isGif: false,
      },
      {
        id: "10",
        rank: 10,
        name: "王十二",
        avatar: "/public/placeholder-user.jpg",
        votes: 420,
        trend: "up",
        hotLevel: 3,
        isGif: false,
      },
    ],
  },
})