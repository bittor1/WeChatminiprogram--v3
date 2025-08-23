// pages/detail/detail.js
const app = getApp();

Page({
  data: {
    userInfo: {},
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
    isRecording: false, // 是否正在录音
    tempSoundPath: '', // 临时录音文件路径
    soundDuration: 0, // 录音时长（秒）
    isPreviewPlaying: false, // 是否正在播放预览
    recorderManager: null, // 录音管理器
    innerAudioContext: null, // 音频播放器
    achievements: [], // 空数组，等待从服务器加载或用户添加
    comments: [], // 空数组，等待从服务器加载或用户添加
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
    shareType: '' // 'vote' 或 'downvote'，用于标记分享来源
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
  
  // 播放投票音效
  playVoteSound() {
    // 使用内置音效
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = '/sounds/vote.mp3'; // 假设有这个音效文件
    innerAudioContext.play();
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
    this.setData({
      commentContent: e.detail.value
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
    wx.showLoading({
      title: '提交中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'add',
        data: {
          nominationId: this.data.userInfo.id, // 假设userInfo.id是目标ID
          content: content
        }
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 清空输入框
        this.setData({
          commentContent: ''
        });
        
        // 显示成功提示
        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });
        
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
        title: '评论失败',
        icon: 'none'
      });
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
  loadComments(userId) {
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'list',
        data: {
          nominationId: userId,
          page: 1,
          pageSize: 20
        }
      }
    })
    .then(res => {
      if (res.result && res.result.success) {
        this.setData({
          comments: res.result.comments || [],
          commentCount: res.result.comments?.length || 0 // 更新评论计数
        });
      } else {
        console.error('加载评论失败:', res.result.message);
      }
    })
    .catch(err => {
      console.error('加载评论失败:', err);
    });
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
