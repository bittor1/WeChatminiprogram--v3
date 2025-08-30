// pages/detail/detail.js
const app = getApp();

Page({
  data: {
    userInfo: {}, // 被查看的用户信息
    currentUser: {}, // 当前登录用户信息
    danmakuText: '',
    commentContent: '', // 添加评论内容字段
    commentText: '',
    commentCount: 0, // 评论计数
    danmakuList: [],
    modalTitle: '',
    modalType: '',
    newAchievement: '',
    customVoteCount: 1, // 自定义投票数，默认为1
    isProcessingPayment: false, // 是否正在处理支付 - 保留但目前不使用
    // 录制投票音效相关状态
    recordingState: 'idle', // idle: 初始状态, recording: 录制中, recorded: 录制完成
    recordTime: 0, // 录制时间（秒）
    formattedRecordTime: '00:00', // 格式化的录制时间
    tempFilePath: '', // 临时录音文件路径
    tempDuration: 0, // 临时录音时长（毫秒）
    formattedTempDuration: '0', // 格式化的临时录音时长
    recorderManager: null, // 录音管理器
    innerAudioContext: null, // 音频播放器
    recordTimer: null, // 录音计时器
    currentPageSound: null, // 当前页面绑定的音效
    achievements: [], // 空数组，等待从服务器加载或用户添加
    comments: [], // 空数组，等待从服务器加载或用户添加
    commentContent: '', // 评论内容
    replyTo: null, // 回复对象的名称
    replyToId: null, // 回复对象的评论ID
    voteLimit: {
      hasVoted: false,
      lastVoteDate: null
    },
    downvoteLimit: {
      hasDownvoted: false,
      lastDownvoteDate: null
    },
    shareInfo: {
      sharedToFriend: false,
      sharedToTimeline: false
    },
    shareType: '', // 'vote' 或 'downvote'，用于标记分享来源
    hasMoreComments: false, // 是否有更多评论
    commentPage: 1, // 当前评论页码
    showingMoreReplies: {} // 记录哪些评论展开了更多回复
  },
  
  onLoad(options) {
    // 从服务器获取用户信息
    const id = options.id;
    
    if (!id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: '详情页'
    });
    
    // 获取当前登录用户信息
    this.updateCurrentUser();
    
    // 获取用户详情
    this.loadUserDetail(id);
    
    // 加载事迹
    this.loadAchievements(id);
    
    // 加载评论
    this.loadComments(id);
    
    // 加载弹幕
    this.loadDanmakus(id);
    
    // 启用分享菜单（包括朋友圈）
    if (wx.canIUse('showShareMenu')) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    
    // 初始化录音和音频播放器
    this.initRecorder();
    this.initAudioPlayer();
    
    // 加载页面绑定的音效
    this.loadPageSound(id);
  },

  // 页面卸载时清理资源
  onUnload() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
    }
    if (this.recorderManager) {
      this.recorderManager.stop();
    }
  },

  // 更新当前用户信息
  updateCurrentUser() {
    const app = getApp();
    let currentUser = {};
    
    // 从全局数据获取
    if (app.globalData && app.globalData.userInfo) {
      currentUser = { ...app.globalData.userInfo };
    }
    
    // 从本地存储获取
    try {
      const storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo) {
        currentUser = { ...currentUser, ...storedUserInfo };
      }
    } catch (e) {
      console.error('获取本地用户信息失败:', e);
    }
    
    // 确保有openid字段
    if (currentUser._openid && !currentUser.openid) {
      currentUser.openid = currentUser._openid;
    }
    
    console.log('当前用户信息:', currentUser);
    
    this.setData({
      currentUser: currentUser
    });
  },
  
  // 加载弹幕数据
  loadDanmakus(targetId) {
    wx.showLoading({
      title: '加载弹幕中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'danmakuManage',
      data: {
        action: 'get',
        targetId: targetId
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        this.setData({
          danmakuList: res.result.data || []
        });
        
        console.log('加载弹幕成功:', res.result.data);
      } else {
        console.error('加载弹幕失败:', res.result);
        wx.showToast({
          title: '加载弹幕失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('加载弹幕失败:', err);
      
      wx.showToast({
        title: '加载弹幕失败',
        icon: 'none'
      });
    });
  },
  
  // 加载投票限制记录
  loadVoteLimits(userId) {
    try {
      const voteLimitsStr = wx.getStorageSync(`voteLimits_${userId}`);
      const downvoteLimitsStr = wx.getStorageSync(`downvoteLimits_${userId}`);
      const shareInfoStr = wx.getStorageSync(`shareInfo_${userId}`);
      
      if (voteLimitsStr) {
        const voteLimit = JSON.parse(voteLimitsStr);
        // 检查是否是今天
        if (this.isSameDay(new Date(), new Date(voteLimit.lastVoteDate))) {
          this.setData({ 'voteLimit': voteLimit });
        }
      }
      
      if (downvoteLimitsStr) {
        const downvoteLimit = JSON.parse(downvoteLimitsStr);
        // 检查是否是今天
        if (this.isSameDay(new Date(), new Date(downvoteLimit.lastDownvoteDate))) {
          this.setData({ 'downvoteLimit': downvoteLimit });
        }
      }
      
      if (shareInfoStr) {
        const shareInfo = JSON.parse(shareInfoStr);
        this.setData({ 'shareInfo': shareInfo });
      }
    } catch (e) {
      console.error('加载投票限制记录失败:', e);
    }
  },
  
  // 检查是否是同一天
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  },
  
  // 处理投票
  handleVote() {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      this.handleLogin(() => {
        this.processVote();
      });
      return;
    }
    
    this.processVote();
  },
  
  // 处理减票
  handleDownVote() {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      this.handleLogin(() => {
        this.processDownVote();
      });
      return;
    }
    
    this.processDownVote();
  },
  
  // 处理登录
  handleLogin(callback) {
    // getUserProfile必须在用户点击事件的直接回调中调用
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (profileRes) => {
        console.log('获取用户信息成功:', profileRes);
        
        // 显示加载提示
        wx.showLoading({
          title: '登录中...',
          mask: true
        });
        
        // 调用微信登录获取code
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              console.log('获取登录code成功:', loginRes.code);
              
              // 调用云函数进行登录
              wx.cloud.callFunction({
                name: 'login',
                data: {
                  code: loginRes.code
                },
                success: (res) => {
                  console.log('云函数登录成功:', res);
                  
                  if (res.result && res.result.code === 200) {
                    // 将用户信息保存到云数据库
                    this.saveUserInfo(res.result.openid, profileRes.userInfo, callback);
                  } else {
                    wx.hideLoading();
                    wx.showToast({
                      title: '登录失败',
                      icon: 'none'
                    });
                  }
                },
                fail: (err) => {
                  console.error('云函数登录失败:', err);
                  wx.hideLoading();
                  wx.showToast({
                    title: '登录失败',
                    icon: 'none'
                  });
                }
              });
            } else {
              console.error('获取登录code失败:', loginRes);
              wx.hideLoading();
              wx.showToast({
                title: '登录失败',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            console.error('wx.login调用失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '登录失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        
        // 用户拒绝授权，显示提示
        wx.showToast({
          title: '需要授权才能继续',
          icon: 'none'
        });
      }
    });
  },
  
  // 获取用户个人信息
  getUserProfile(openid, callback) {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (profileRes) => {
        console.log('获取用户信息成功:', profileRes);
        
        // 将用户信息保存到云数据库
        this.saveUserInfo(openid, profileRes.userInfo, callback);
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.hideLoading();
        
        // 即使获取用户信息失败，也可以使用默认信息创建用户
        this.saveUserInfo(openid, {
          nickName: '微信用户',
          avatarUrl: '/images/placeholder-user.jpg',
          gender: 0
        }, callback);
      }
    });
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
          
          // 更新当前页面的用户信息
          this.updateCurrentUser();
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          
          // 执行回调函数
          if (typeof callback === 'function') {
            setTimeout(callback, 500);
          }
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
  
  // 处理投票流程
  processVote() {
    const userId = this.data.userInfo.id;
    
    // 检查今日是否已投票
    if (this.data.voteLimit.hasVoted) {
      // 如果今天已经投过票，提示分享
      wx.showModal({
        title: '今日已投票',
        content: '您今天已经为该用户投过票了，分享给好友可以再投一票！',
        confirmText: '去分享',
        success: (res) => {
          if (res.confirm) {
            // 标记分享类型为投票
            this.setData({
              shareType: 'vote'
            });
            
            // 显示分享提示
            wx.showShareMenu({
              withShareTicket: true,
              menus: ['shareAppMessage', 'shareTimeline']
            });
          }
        }
      });
      return;
    }
    
    // 执行投票
    wx.showLoading({
      title: '投票中...',
      mask: true
    });
    
    // 调用云函数进行投票
    wx.cloud.callFunction({
      name: 'voteManage',
      data: {
        action: 'vote',
        targetId: userId,
        count: this.data.customVoteCount
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 更新投票限制记录
        const voteLimit = {
          hasVoted: true,
          lastVoteDate: new Date().toISOString()
        };
        
        // 保存到本地存储
        wx.setStorageSync(`voteLimits_${userId}`, JSON.stringify(voteLimit));
        
        // 更新数据
        this.setData({
          'voteLimit': voteLimit,
          'userInfo.votes': res.result.newVotes
        });
        
        // 播放成功音效
        this.playVoteSound();
        
        // 显示成功提示
        wx.showToast({
          title: '想吃成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.message || '投票失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('投票失败:', err);
      
      wx.showToast({
        title: '投票失败',
        icon: 'none'
      });
    });
  },
  
  // 处理减票流程
  processDownVote() {
    const userId = this.data.userInfo.id;
    
    // 检查今日是否已减票
    if (this.data.downvoteLimit.hasDownvoted) {
      // 如果今天已经减过票，提示分享
      wx.showModal({
        title: '今日已减票',
        content: '您今天已经为该用户减过票了，分享给好友可以再减一票！',
        confirmText: '去分享',
        success: (res) => {
          if (res.confirm) {
            // 标记分享类型为减票
            this.setData({
              shareType: 'downvote'
            });
            
            // 显示分享提示
            wx.showShareMenu({
              withShareTicket: true,
              menus: ['shareAppMessage', 'shareTimeline']
            });
          }
        }
      });
      return;
    }
    
    // 执行减票
    wx.showLoading({
      title: '减票中...',
      mask: true
    });
    
    // 调用云函数进行减票
    wx.cloud.callFunction({
      name: 'voteManage',
      data: {
        action: 'downvote',
        targetId: userId,
        count: 1
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 更新减票限制记录
        const downvoteLimit = {
          hasDownvoted: true,
          lastDownvoteDate: new Date().toISOString()
        };
        
        // 保存到本地存储
        wx.setStorageSync(`downvoteLimits_${userId}`, JSON.stringify(downvoteLimit));
        
        // 更新数据
        this.setData({
          'downvoteLimit': downvoteLimit,
          'userInfo.votes': res.result.newVotes
        });
        
        // 显示成功提示
        wx.showToast({
          title: '拒吃成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.message || '减票失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('减票失败:', err);
      
      wx.showToast({
        title: '减票失败',
        icon: 'none'
      });
    });
  },
  

  // 生成10-15条随机弹幕
  generateRandomDanmaku() {
    const messages = ['太好吃了！', '必须打卡', '味道一般', '下次还会再来', '强烈推荐', '性价比不高'];
    
    // 生成10-15条随机弹幕
    const danmakuList = [];
    const count = Math.floor(Math.random() * 6) + 10;
    
    for (let i = 0; i < count; i++) {
      const text = messages[Math.floor(Math.random() * messages.length)];
      const top = Math.floor(Math.random() * 80) + 10; // 10% - 90%的位置
      const duration = Math.floor(Math.random() * 10000) + 5000; // 5-15秒
      
      danmakuList.push({
        id: `danmaku_${i}`,
        text,
        top,
        duration
      });
    }
    
    this.setData({ danmakuList });
    return danmakuList;
  },
  
  // 弹幕输入处理
  onDanmakuInput(e) {
    this.setData({
      danmakuText: e.detail.value
    });
  },
  
  // 发送弹幕
  sendDanmaku() {
    const text = this.data.danmakuText.trim();
    
    if (!text) {
      wx.showToast({
        title: '请输入弹幕内容',
        icon: 'none'
      });
      return;
    }
    
    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      this.handleLogin(() => {
        this.addDanmaku(text);
      });
      return;
    }
    
    this.addDanmaku(text);
  },
  
  // 添加弹幕
  addDanmaku(text) {
    // 生成随机颜色
    const colors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // 生成随机位置和持续时间
    const top = Math.floor(Math.random() * 80) + 10;
    const duration = Math.floor(Math.random() * 5000) + 5000; // 5-10秒
    
    // 生成唯一ID
    const id = `danmaku_${Date.now()}`;
    
    // 添加到弹幕列表（本地显示）
    const danmakuList = this.data.danmakuList;
    danmakuList.push({
      id,
      text,
      top,
      duration,
      color
    });
    
    // 更新数据
    this.setData({
      danmakuList,
      danmakuText: ''
    });
    
    // 保存到数据库
    const targetId = this.data.userInfo.id;
    
    wx.cloud.callFunction({
      name: 'danmakuManage',
      data: {
        action: 'add',
        targetId: targetId,
        text: text,
        color: color
      }
    })
    .then(res => {
      if (res.result && res.result.success) {
        console.log('弹幕发送成功:', res.result);
      } else {
        console.error('弹幕发送失败:', res.result);
        wx.showToast({
          title: '弹幕发送失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('弹幕发送失败:', err);
      wx.showToast({
        title: '弹幕发送失败',
        icon: 'none'
      });
    });
  },
  
  // 添加事迹
  addAchievement() {
    console.log('点击了添加事迹按钮');
    
    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      console.log('用户未登录，跳转到登录流程');
      this.handleLogin(() => {
        this.showAchievementModal();
      });
      return;
    }
    
    console.log('用户已登录，显示添加事迹弹窗');
    this.showAchievementModal();
  },
  
  // 显示添加事迹弹窗
  showAchievementModal() {
    console.log('准备显示添加事迹弹窗');
    this.setData({
      modalType: 'achievement',
      modalTitle: '添加新事迹',
      newAchievement: ''
    });
    console.log('添加事迹弹窗已显示，modalType:', this.data.modalType);
  },
  
  // 关闭弹窗
  closeModal() {
    this.setData({
      modalType: '',
      modalTitle: '',
      newAchievement: ''
    });
  },
  
  // 阻止事件冒泡
  stopPropagation() {
    return;
  },
  
  // 事迹输入处理
  onAchievementInput(e) {
    // 获取输入值并去除前后空白
    const value = e.detail.value;
    const trimmedValue = value.trim();
    
    this.setData({
      // 如果去除空白后为空字符串，则设置为空，这样可以禁用提交按钮
      newAchievement: trimmedValue === '' ? '' : value
    });
  },
  
  // 提交事迹
  submitAchievement() {
    const content = this.data.newAchievement.trim();
    console.log('提交事迹内容:', content);
    
    if (!content) {
      wx.showToast({
        title: '请输入事迹内容',
        icon: 'none'
      });
      return;
    }
    
    // 检查用户信息是否存在
    if (!this.data.userInfo || !this.data.userInfo.id) {
      console.error('提交事迹失败: 用户信息不存在', this.data.userInfo);
      wx.showToast({
        title: '用户信息不存在',
        icon: 'none'
      });
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '提交中...',
      mask: true
    });
    
    // 获取当前日期
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 创建新事迹对象
    const newAchievement = {
      content,
      date: dateStr,
      type: 'neutral', // 默认为中性
      location: '伦敦', // 默认位置
      id: `achievement_${Date.now()}` // 生成临时ID
    };
    
    console.log('准备提交事迹:', newAchievement);
    
    // 调用云函数保存事迹
    wx.cloud.callFunction({
      name: 'achievementManage',
      data: {
        action: 'add',
        userId: this.data.userInfo.id,
        achievement: newAchievement
      }
    })
    .then(res => {
      console.log('提交事迹返回结果:', res);
      
      // 隐藏加载提示
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 更新本地数据列表
        const achievements = this.data.achievements || [];
        achievements.unshift({
          ...newAchievement,
          _id: res.result.achievementId // 使用服务器返回的ID
        });
        
        // 更新数据并关闭弹窗
        this.setData({
          achievements,
          modalType: '', // 关闭弹窗
          newAchievement: '' // 清空输入
        });
        
        // 显示成功提示
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
      } else {
        // 显示错误提示
        wx.showToast({
          title: res.result?.message || '添加失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('提交事迹失败:', err);
      
      // 隐藏加载提示
      wx.hideLoading();
      
      // 显示错误提示
      wx.showToast({
        title: '添加失败: ' + (err.errMsg || err.message || '未知错误'),
        icon: 'none'
      });
    });
  },
  
  // 初始化录音管理器 [[memory:7653028]]
  initRecorder() {
    this.recorderManager = wx.getRecorderManager();

    this.recorderManager.onStart(() => {
      console.log('录音开始');
      this.setData({ 
        recordingState: 'recording', 
        recordTime: 0, 
        formattedRecordTime: '00:00' 
      });
      
      // 开始计时
      this.recordTimer = setInterval(() => {
        const newTime = this.data.recordTime + 1;
        this.setData({
          recordTime: newTime,
          formattedRecordTime: this.formatTime(newTime)
        });
        
        // 5秒自动停止
        if (newTime >= 5) {
          this.recorderManager.stop();
        }
      }, 1000);
    });

    this.recorderManager.onStop((res) => {
      console.log('录音停止', res);
      clearInterval(this.recordTimer);
      
      if (res.duration < 1000) {
        wx.showToast({ title: '录音时间太短', icon: 'none' });
        this.setData({ recordingState: 'idle' });
        return;
      }
      
      this.setData({
        recordingState: 'recorded',
        tempFilePath: res.tempFilePath,
        tempDuration: res.duration,
        formattedTempDuration: (res.duration / 1000).toFixed(1)
      });
    });

    this.recorderManager.onError((res) => {
      console.error('录音失败', res);
      clearInterval(this.recordTimer);
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ recordingState: 'idle' });
    });
  },

  // 初始化音频播放器 [[memory:7653087]]
  initAudioPlayer() {
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.onPlay(() => console.log('开始播放'));
    this.innerAudioContext.onError((res) => console.error('播放错误', res));
  },

  // 格式化时间
  formatTime(seconds) {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    return `${min}:${sec}`;
  },

  // 加载页面绑定的音效
  loadPageSound(pageId) {
    if (!pageId) return;
    
    wx.cloud.callFunction({
      name: 'soundManage',
      data: {
        action: 'getPageSound',
        pageId: pageId
      }
    }).then(res => {
      if (res.result && res.result.success && res.result.data) {
        this.setData({
          currentPageSound: res.result.data
        });
        console.log('页面音效加载成功:', res.result.data);
      }
    }).catch(err => {
      console.error('加载页面音效失败:', err);
    });
  },

  // 点击录制投票音效按钮
  playSound() {
    if (this.data.recordingState === 'recorded') {
      // 如果已录制，则预览音效
      this.previewRecordedSound();
      return;
    }
    
    // 开始录制
    this.startRecording();
  },

  // 开始录制
  startRecording() {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      this.handleLogin(() => {
        this.processStartRecording();
      });
      return;
    }
    
    this.processStartRecording();
  },

  // 处理开始录制
  processStartRecording() {
    // 停止当前播放的音频
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }

    // 请求录音权限 [[memory:7653095]]
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        const options = { 
          duration: 5000,        // 5秒
          sampleRate: 16000,     // 采样率
          numberOfChannels: 1,   // 单声道
          encodeBitRate: 96000,  // 编码码率
          format: 'mp3'          // 音频格式
        };
        this.recorderManager.start(options);
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '录制投票音效需要您的录音权限',
          confirmText: '去授权',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  // 确认录制（停止录制）
  confirmRecording() {
    if (this.data.recordingState === 'recording') {
      this.recorderManager.stop();
    }
  },

  // 取消录制
  cancelRecording() {
    if (this.data.recordingState === 'recording') {
      this.recorderManager.stop();
    }
    this.setData({ recordingState: 'idle' });
  },

  // 预览录制的音效
  previewRecordedSound() {
    if (!this.data.tempFilePath) return;
    
    this.innerAudioContext.src = this.data.tempFilePath;
    this.innerAudioContext.play();
  },

  // 删除录制的音效
  deleteRecordedSound() {
    this.setData({ 
      recordingState: 'idle',
      tempFilePath: '',
      tempDuration: 0,
      formattedTempDuration: '0'
    });
  },

  // 确认音效（保存并绑定到页面）
  recordSound() {
    if (!this.data.tempFilePath) {
      wx.showToast({
        title: '请先录制音效',
        icon: 'none'
      });
      return;
    }

    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      this.handleLogin(() => {
        this.processConfirmSound();
      });
      return;
    }
    
    this.processConfirmSound();
  },

  // 处理确认音效
  processConfirmSound() {
    const tempFilePath = this.data.tempFilePath;
    const pageId = this.data.userInfo.id;
    
    if (!tempFilePath || !pageId) {
      wx.showToast({
        title: '录音文件或页面信息不完整',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    // 上传音效文件到云存储
    const userInfo = wx.getStorageSync('userInfo') || {};
    const uploadPath = `sounds/vote_${userInfo._id || 'unknown'}_${Date.now()}.mp3`;
    
    wx.cloud.uploadFile({
      cloudPath: uploadPath,
      filePath: tempFilePath
    }).then(uploadRes => {
      const fileID = uploadRes.fileID;
      
      // 保存音效到用户音效库
      return wx.cloud.callFunction({
        name: 'soundManage',
        data: {
          action: 'saveUserSound',
          soundData: {
            fileId: fileID,
            duration: this.data.tempDuration,
            name: '投票音效'
          }
        }
      });
    }).then(saveRes => {
      if (!saveRes.result || !saveRes.result.success) {
        throw new Error(saveRes.result?.message || '保存音效失败');
      }
      
      const soundId = saveRes.result.soundId;
      
      // 绑定音效到当前页面
      return wx.cloud.callFunction({
        name: 'soundManage',
        data: {
          action: 'bindPageSound',
          pageId: pageId,
          soundId: soundId
        }
      });
    }).then(bindRes => {
      wx.hideLoading();
      
      if (bindRes.result && bindRes.result.success) {
        wx.showToast({ title: '音效设置成功', icon: 'success' });
        
        // 重置录制状态
        this.setData({ 
          recordingState: 'idle',
          tempFilePath: '',
          tempDuration: 0,
          formattedTempDuration: '0'
        });
        
        // 重新加载页面音效
        this.loadPageSound(pageId);
      } else {
        wx.showToast({
          title: bindRes.result?.message || '绑定音效失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('确认音效失败:', err);
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none'
      });
    });
  },

  // 播放投票音效（点击想吃按钮时调用）
  playVoteSound() {
    // 如果有页面绑定的音效，播放绑定的音效
    if (this.data.currentPageSound && this.data.currentPageSound.fileId) {
      // 记录播放
      wx.cloud.callFunction({
        name: 'soundManage',
        data: {
          action: 'playPageSound',
          pageId: this.data.userInfo.id
        }
      });
      
      // 播放音效
      this.innerAudioContext.src = this.data.currentPageSound.fileId;
      this.innerAudioContext.play();
    } else {
      // 使用默认音效
      const innerAudioContext = wx.createInnerAudioContext();
      innerAudioContext.src = '/sounds/vote.mp3'; // 假设有这个音效文件
      innerAudioContext.play();
    }
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    const item = this.data.userInfo;
    return {
      title: `${item.name} - 伦敦必吃榜`,
      query: `id=${item.id}`,
      imageUrl: item.avatar
    }
  },
  
  // 分享给朋友
  onShareAppMessage() {
    const userId = this.data.userInfo.id;
    const userName = this.data.userInfo.name;
    
    // 记录分享行为
    if (this.data.shareType) {
      // 更新分享信息
      const shareInfo = {
        ...this.data.shareInfo,
        sharedToFriend: true
      };
      
      // 保存到本地存储
      wx.setStorageSync(`shareInfo_${userId}`, JSON.stringify(shareInfo));
      
      // 更新数据
      this.setData({
        'shareInfo': shareInfo
      });
    }
    
    return {
      title: `伦敦必吃榜 - ${userName}的排名`,
      path: `/pages/detail/detail?id=${userId}`,
      imageUrl: this.data.userInfo.avatar
    };
  },
  
  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 秒差
    
    if (diff < 60) {
      return '刚刚';
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}分钟前`;
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)}小时前`;
    } else if (diff < 2592000) {
      return `${Math.floor(diff / 86400)}天前`;
    } else {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
  },

  // 评论输入处理
  onCommentInput(e) {
    const value = e.detail.value;
    this.setData({
      commentContent: value
    });
  },
  
  // 提交评论
  submitComment() {
    const content = this.data.commentContent.trim();
    if (!content) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none'
      });
      return;
    }
    
    // 检查用户是否已登录
    const app = getApp();
    if (!app.checkUserLogin()) {
      this.handleLogin(() => {
        this.processSubmitComment(content);
      });
      return;
    }
    
    this.processSubmitComment(content);
  },
  
  // 处理评论提交
  processSubmitComment(content) {
    // 检查用户信息
    if (!this.data.userInfo || !this.data.userInfo.id) {
      wx.showToast({
        title: '用户信息不完整',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '提交中...',
      mask: true
    });
    
    const requestData = {
      nominationId: this.data.userInfo.id,
      content: content
    };
    
    // 如果是回复评论
    if (this.data.replyToId) {
      requestData.parentId = this.data.replyToId;
    }
    
    console.log('提交评论数据:', requestData);
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: this.data.replyToId ? 'reply' : 'add',
        data: requestData
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 清空输入框和回复状态
        this.setData({
          commentContent: '',
          replyTo: null,
          replyToId: null
        });
        
        // 微信朋友圈风格 - 不显示成功提示，直接刷新列表
        
        // 刷新评论列表
        this.loadComments(this.data.userInfo.id);
      } else {
        wx.showToast({
          title: res.result.message || '评论失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('评论失败:', err);
      
      wx.showToast({
        title: err.errMsg || '评论失败，请重试',
        icon: 'none',
        duration: 3000
      });
    });
  },
  
  // 回复评论
  replyComment(e) {
    const { id, name } = e.currentTarget.dataset;
    
    // 参数检查
    if (!id || !name) {
      wx.showToast({
        title: '无法回复该评论',
        icon: 'none'
      });
      return;
    }
    
    // 设置回复状态
    this.setData({
      replyTo: name,
      replyToId: id
    });
    
    // 轻微振动反馈，类似微信
    wx.vibrateShort();
  },
  
  // 取消回复
  cancelReply() {
    this.setData({
      replyTo: null,
      replyToId: null
    });
  },
  
  // 点赞评论
  likeComment(e) {
    const commentId = e.currentTarget.dataset.id;
    console.log('点赞评论，commentId:', commentId);
    
    if (!commentId) {
      wx.showToast({
        title: '评论ID不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'like',
        data: {
          commentId: commentId
        }
      }
    })
    .then(res => {
      console.log('点赞云函数返回结果:', res);
      if (res.result && res.result.success) {
        // 更新本地评论的点赞数
        const comments = this.data.comments;
        const updateLikes = (list) => {
          for (let comment of list) {
            if (comment._id === commentId) {
              comment.likes = (comment.likes || 0) + 1;
              return true;
            }
            if (comment.replies && comment.replies.length > 0) {
              if (updateLikes(comment.replies)) return true;
            }
          }
          return false;
        };
        
        updateLikes(comments);
        this.setData({ comments });
        
        wx.showToast({
          title: '点赞成功',
          icon: 'success',
          duration: 1000
        });
      } else {
        wx.showToast({
          title: res.result.message || '点赞失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('点赞失败:', err);
      wx.showToast({
        title: '点赞失败',
        icon: 'none'
      });
    });
  },

  // 删除评论
  deleteComment(e) {
    const { id, type } = e.currentTarget.dataset;
    console.log('删除评论，id:', id, 'type:', type);
    
    if (!id) {
      wx.showToast({
        title: '评论ID不存在',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评论吗？删除后无法恢复。',
      success: (res) => {
        if (res.confirm) {
          this.processDeleteComment(id, type);
        }
      }
    });
  },

  // 处理删除评论
  processDeleteComment(commentId, type) {
    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'delete',
        data: {
          commentId: commentId,
          type: type || 'comment'
        }
      }
    })
    .then(res => {
      console.log('删除云函数返回结果:', res);
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 刷新评论列表
        this.loadComments(this.data.userInfo.id);
      } else {
        wx.showToast({
          title: res.result.message || '删除失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('删除评论失败:', err);
      
      wx.showToast({
        title: err.errMsg || '删除失败，请重试',
        icon: 'none',
        duration: 3000
      });
    });
  },
  
  // 查看更多回复
  showMoreReplies(e) {
    const rootId = e.currentTarget.dataset.id;
    const page = e.currentTarget.dataset.page || 1;
    
    wx.showLoading({
      title: '加载中...'
    });
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'listReplies',
        data: {
          rootId: rootId,
          page: page,
          pageSize: 10
        }
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 更新评论列表中的回复
        const comments = this.data.comments;
        for (let comment of comments) {
          if (comment._id === rootId) {
            comment.replies = res.result.replies || [];
            comment.hasMoreReplies = res.result.total > res.result.replies.length;
            break;
          }
        }
        
        // 记录已展开的评论
        const showingMoreReplies = this.data.showingMoreReplies;
        showingMoreReplies[rootId] = true;
        
        this.setData({ 
          comments,
          showingMoreReplies
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('加载回复失败:', err);
    });
  },

  // 加载事迹列表
  loadAchievements(userId) {
    if (!userId) {
      console.error('加载事迹列表失败: 缺少userId参数');
      return;
    }
    
    console.log('加载事迹列表，userId:', userId);
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'achievementManage',
      data: {
        action: 'get',
        userId: userId
      }
    })
    .then(res => {
      console.log('加载事迹返回结果:', res);
      if (res.result && res.result.success) {
        this.setData({
          achievements: res.result.achievements || []
        });
        console.log('设置achievements数据:', res.result.achievements || []);
      } else {
        console.error('加载事迹失败:', res.result?.message || '未知错误');
        wx.showToast({
          title: '加载事迹失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('加载事迹失败:', err);
      wx.showToast({
        title: '加载事迹失败',
        icon: 'none'
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  // 加载评论列表
  loadComments(userId, isLoadMore = false) {
    const page = isLoadMore ? this.data.commentPage + 1 : 1;
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'list',
        data: {
          nominationId: userId,
          page: page,
          pageSize: 20
        }
      }
    })
    .then(res => {
      if (res.result && res.result.success) {
        const newComments = res.result.comments || [];
        const comments = isLoadMore ? [...this.data.comments, ...newComments] : newComments;
        

        
        this.setData({
          comments: comments,
          commentCount: res.result.total || 0,
          commentPage: page,
          hasMoreComments: comments.length < res.result.total
        });
      } else {
        console.error('加载评论失败:', res.result.message);
      }
    })
    .catch(err => {
      console.error('加载评论失败:', err);
    });
  },
  
  // 加载更多评论
  loadMoreComments() {
    if (this.data.hasMoreComments) {
      this.loadComments(this.data.userInfo.id, true);
    }
  },

  // 加载用户详情
  loadUserDetail(id) {
    // 查找指定ID的用户
    const app = getApp();
    const user = app.globalData.rankings.find(item => item.id === id);
    
    if (!user) {
      // 如果找不到用户，显示错误并返回
      wx.showToast({
        title: '未找到用户信息',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    this.setData({
      userInfo: user
    });
    
    // 加载投票限制记录
    this.loadVoteLimits(id);
    
    console.log('用户详情加载完成:', user);
  }
})
