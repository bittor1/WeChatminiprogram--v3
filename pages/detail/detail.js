// pages/detail/detail.js
// 导入支付工具类
const paymentUtils = require('../../utils/paymentUtils');

Page({
  data: {
    userInfo: {},
    danmakuText: '',
    commentText: '',
    danmakuList: [],
    showModal: false,
    modalTitle: '',
    modalType: '',
    newAchievement: '',
    customVoteCount: 1, // 自定义投票数，默认为1
    isProcessingPayment: false, // 是否正在处理支付
    achievements: [
      {
        id: '1',
        icon: '🍜',
        content: '在网红日料店吃了38盘寿司，店家看不下去请他离开',
        date: '2024-04-15',
        location: '伦敦 Soho',
        type: 'success'
      },
      {
        id: '2',
        icon: '🥂',
        content: '酒吧嗨到凌晨，全场买单，一掷千金',
        date: '2024-03-28',
        location: '伦敦 Shoreditch',
        type: 'success'
      },
      {
        id: '3',
        icon: '🍕',
        content: '据说他每周必去拉面店，老板已经认识他',
        date: '2024-01-10',
        type: 'neutral'
      }
    ],
    comments: [
      {
        id: '1',
        user: '西门',
        content: '这家伙每天都在吃，难怪上榜了',
        timestamp: '2小时前'
      },
      {
        id: '2',
        user: '敏姐',
        content: '我看他就是馋，哈哈哈',
        timestamp: '昨天'
      },
      {
        id: '3',
        user: '欣妹',
        content: '带我去那家拉面店呗',
        timestamp: '3天前'
      }
    ]
  },
  
  onLoad(options) {
    // 模拟从服务器获取用户信息
    const app = getApp();
    const id = options.id || '1';
    const user = app.globalData.rankings.find(item => item.id === id) || app.globalData.rankings[0];
    
    this.setData({
      userInfo: user
    });

    // 生成随机弹幕动画
    this.generateDanmakuItems();
  },
  
  // 返回首页
  goBackToHome() {
    wx.switchTab({
      url: '/pages/index/index',
    })
  },
  
  // 监听弹幕输入
  onDanmakuInput(e) {
    this.setData({
      danmakuText: e.detail.value
    });
  },
  
  // 监听评论输入
  onCommentInput(e) {
    this.setData({
      commentText: e.detail.value
    });
  },

  // 发送弹幕
  sendDanmaku() {
    if (!this.data.danmakuText.trim()) return;
    
    // 直接发送弹幕，无需付费
    const newDanmaku = {
      id: `dmk_${Date.now()}`,
      text: this.data.danmakuText,
      top: Math.floor(Math.random() * 80) + 10,
      duration: Math.floor(Math.random() * 10000) + 5000
    };
    
    const danmakuList = this.data.danmakuList.concat(newDanmaku);
    this.setData({
      danmakuList,
      danmakuText: ''
    });
    
    wx.showToast({
      title: '发送成功',
      icon: 'success'
    });
  },
  
  // 发送评论
  sendComment() {
    if (!this.data.commentText.trim()) return;
    
    const newComment = {
      id: `cmt_${Date.now()}`,
      user: '我',
      content: this.data.commentText,
      timestamp: '刚刚'
    };
    
    const comments = [newComment, ...this.data.comments];
    this.setData({
      comments,
      commentText: ''
    });
    
    wx.showToast({
      title: '评论成功',
      icon: 'success'
    });
  },
  
  // 处理投票 - 显示选择
  handleVote() {
    wx.showActionSheet({
      itemList: ['免费投1票', '付费投更多票'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 免费投1票
          this.freeVote();
        } else if (res.tapIndex === 1) {
          // 付费投更多票
          this.openCustomVoteModal();
        }
      }
    });
  },
  
  // 免费投1票
  freeVote() {
    const userInfo = this.data.userInfo;
    userInfo.votes += 1;
    
    this.setData({
      userInfo
    });
    
    wx.showToast({
      title: '投票成功',
      icon: 'success'
    });
  },
  
  // 打开自定义投票弹窗
  openCustomVoteModal() {
    this.setData({
      showModal: true,
      modalTitle: '自定义投票',
      modalType: 'vote',
      customVoteCount: 1
    });
  },
  
  // 监听自定义投票数输入
  onCustomVoteInput(e) {
    let value = parseInt(e.detail.value);
    if (isNaN(value) || value < 1) value = 1;
    if (value > 100) value = 100;
    
    this.setData({
      customVoteCount: value
    });
  },
  
  // 减少自定义投票数
  decreaseCustomVotes() {
    let count = this.data.customVoteCount;
    if (count > 1) {
      this.setData({
        customVoteCount: count - 1
      });
    }
  },
  
  // 增加自定义投票数
  increaseCustomVotes() {
    let count = this.data.customVoteCount;
    if (count < 100) {
      this.setData({
        customVoteCount: count + 1
      });
    }
  },
  
  // 购买自定义票数
  buyCustomVotes() {
    if (this.data.isProcessingPayment) return;
    
    const count = this.data.customVoteCount;
    
    this.setData({ isProcessingPayment: true });
    
    // 获取当前登录用户信息
    const currentUserInfo = wx.getStorageSync('userInfo') || {};
    const userId = currentUserInfo.id || 'default_user';
    
    // 生成订单
    const orderData = paymentUtils.generateOrder('vote', count, userId);
    // 添加目标用户ID
    orderData.targetId = this.data.userInfo.id;
    
    // 显示加载提示
    wx.showLoading({ title: '处理中...' });
    
    // 发起支付
    paymentUtils.requestPayment(orderData)
      .then(res => {
        // 支付成功
        console.log('支付成功', res);
        
        // 更新UI
        const userInfo = this.data.userInfo;
        userInfo.votes += count;
        
        this.setData({
          userInfo,
          showModal: false,
          isProcessingPayment: false
        });
        
        // 保存订单记录
        return paymentUtils.saveOrderToDb(orderData);
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '投票成功',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('支付失败', err);
        this.setData({ isProcessingPayment: false });
        wx.hideLoading();
        
        if (err.errMsg === 'requestPayment:fail cancel') {
          wx.showToast({
            title: '支付已取消',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: '支付失败',
            icon: 'none'
          });
        }
      });
  },
  
  // 处理减票
  handleDownVote() {
    this.setData({
      showModal: true,
      modalTitle: '购买减票',
      modalType: 'downvote'
    });
  },
  
  // 处理分享
  handleShare() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  
  // 播放音效
  playSound() {
    // 显示录音界面
    wx.showToast({
      title: '开始录音',
      icon: 'success'
    });
  },
  
  // 确认音效
  recordSound() {
    if (this.data.isProcessingPayment) return;
    
    // 获取当前登录用户信息
    const currentUserInfo = wx.getStorageSync('userInfo') || {};
    const userId = currentUserInfo.id || 'default_user';
    
    // 生成订单
    const orderData = paymentUtils.generateOrder('sound', 1, userId);
    // 添加目标用户ID
    orderData.soundUrl = 'temp_sound_url'; // 这里应该是实际的录音URL
    
    this.setData({ isProcessingPayment: true });
    
    // 显示加载提示
    wx.showLoading({ title: '处理中...' });
    
    // 发起支付
    paymentUtils.requestPayment(orderData)
      .then(res => {
        // 支付成功
        console.log('支付成功', res);
        
        // 保存订单记录
        return paymentUtils.saveOrderToDb(orderData);
      })
      .then(() => {
        wx.hideLoading();
        this.setData({ isProcessingPayment: false });
        
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('支付失败', err);
        this.setData({ isProcessingPayment: false });
        wx.hideLoading();
        
        if (err.errMsg === 'requestPayment:fail cancel') {
          wx.showToast({
            title: '支付已取消',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: '支付失败',
            icon: 'none'
          });
        }
      });
  },
  
  // 添加战绩
  addAchievement() {
    this.setData({
      showModal: true,
      modalTitle: '爆料新事迹',
      modalType: 'achievement',
      newAchievement: ''
    });
  },
  
  // 监听事迹输入
  onAchievementInput(e) {
    this.setData({
      newAchievement: e.detail.value
    });
  },
  
  // 提交事迹
  submitAchievement() {
    if (!this.data.newAchievement.trim()) return;
    
    const newAchievement = {
      id: `ach_${Date.now()}`,
      icon: '✨',
      content: this.data.newAchievement,
      date: this.formatDate(new Date()),
      type: 'neutral'
    };
    
    const achievements = [newAchievement, ...this.data.achievements];
    this.setData({
      achievements,
      showModal: false
    });
    
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },
  
  // 购买减票
  buyDownVotes(e) {
    if (this.data.isProcessingPayment) return;
    
    const type = e.currentTarget.dataset.type;
    const isAd = type === 'ad';
    
    if (isAd) {
      // 观看广告
      wx.showModal({
        title: '观看广告',
        content: '将为您播放一段15秒广告，观看完成后可减1票',
        success: res => {
          if (res.confirm) {
            // 模拟广告播放
            wx.showLoading({
              title: '广告播放中...',
            });
            
            setTimeout(() => {
              wx.hideLoading();
              this.processDownVote();
            }, 3000);
          }
        }
      });
    } else {
      // 直接付费
      this.setData({ isProcessingPayment: true });
      
      // 获取当前登录用户信息
      const currentUserInfo = wx.getStorageSync('userInfo') || {};
      const userId = currentUserInfo.id || 'default_user';
      
      // 生成订单
      const orderData = paymentUtils.generateOrder('downvote', 1, userId);
      // 添加目标用户ID
      orderData.targetId = this.data.userInfo.id;
      
      // 显示加载提示
      wx.showLoading({ title: '处理中...' });
      
      // 发起支付
      paymentUtils.requestPayment(orderData)
        .then(res => {
          // 支付成功
          console.log('支付成功', res);
          
          // 更新UI
          this.processDownVote();
          
          // 保存订单记录
          return paymentUtils.saveOrderToDb(orderData);
        })
        .then(() => {
          wx.hideLoading();
          this.setData({ 
            showModal: false,
            isProcessingPayment: false
          });
        })
        .catch(err => {
          console.error('支付失败', err);
          this.setData({ isProcessingPayment: false });
          wx.hideLoading();
          
          if (err.errMsg === 'requestPayment:fail cancel') {
            wx.showToast({
              title: '支付已取消',
              icon: 'none'
            });
          } else {
            wx.showToast({
              title: '支付失败',
              icon: 'none'
            });
          }
        });
    }
  },
  
  // 处理减票逻辑
  processDownVote() {
    // 模拟支付成功
    const userInfo = this.data.userInfo;
    userInfo.votes -= 1;
    
    this.setData({
      userInfo,
      showModal: false
    });
    
    wx.showToast({
      title: '减票成功',
      icon: 'success'
    });
  },
  
  // 关闭弹窗
  closeModal() {
    this.setData({
      showModal: false
    });
  },
  
  // 阻止点击穿透
  stopPropagation() {
    // 阻止冒泡
  },
  
  // 格式化日期
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },
  
  // 生成随机弹幕
  generateDanmakuItems() {
    const danmakuTexts = [
      '太有才了',
      '哈哈哈笑死我了',
      '这是什么神仙',
      '我来了我来了',
      '蹭个榜哈哈',
      '为什么他会上榜',
      '投票+1',
      '简直太强了',
      '吃货本货啊',
      '明天我们一起去吃'
    ];
    
    const danmakuList = [];
    
    // 生成5-10条随机弹幕
    const count = Math.floor(Math.random() * 5) + 5;
    
    for (let i = 0; i < count; i++) {
      danmakuList.push({
        id: `dm_${i}`,
        text: danmakuTexts[Math.floor(Math.random() * danmakuTexts.length)],
        top: Math.floor(Math.random() * 80) + 10,
        duration: Math.floor(Math.random() * 10000) + 5000
      });
    }
    
    this.setData({ danmakuList });
  },

  // 用于分享
  onShareAppMessage() {
    return {
      title: `来看看${this.data.userInfo.name}的得吃档案`,
      path: `/pages/detail/detail?id=${this.data.userInfo.id}`
    };
  }
})
