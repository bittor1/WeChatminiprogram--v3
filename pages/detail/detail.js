// pages/detail/detail.js
const app = getApp();

Page({
  data: {
    userInfo: {},
    danmakuText: '',
    commentText: '',
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
      // 如果没有提供ID，显示错误并返回
      wx.showToast({
        title: '未找到用户信息',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    // 查找指定ID的用户
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

    // 生成随机弹幕动画
    this.generateDanmakuItems();
    
    // 加载投票限制记录
    this.loadVoteLimits(id);
    
    // 获取 auth-dialog 组件实例
    this.authDialog = this.selectComponent("#authDialog");

    // 启用分享菜单（包括朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
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
        this.setData({ 'shareInfo': JSON.parse(shareInfoStr) });
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
  
  // 返回首页
  goBackToHome() {
    wx.navigateBack({
      delta: 1
    });
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

  // 发送弹幕前检查登录
  sendDanmaku() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      this.authDialog.showDialog({
        success: (userInfo) => {
          this.doSendDanmaku();
        }
      });
      return;
    }
    this.doSendDanmaku();
  },

  // 实际发送弹幕
  doSendDanmaku() {
    if (!this.data.danmakuText.trim()) return;
    
    // 直接发送弹幕，无需付费
    const newDanmaku = {
      id: `dmk_${Date.now()}`,
      text: this.data.danmakuText,
      top: Math.floor(Math.random() * 98) + 1, // 修改为1-99%的范围，覆盖整个页面
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
  
  // 发送评论前检查登录
  sendComment() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      this.authDialog.showDialog({
        success: (userInfo) => {
          this.doSendComment();
        }
      });
      return;
    }
    this.doSendComment();
  },

  // 实际发送评论
  doSendComment() {
    if (!this.data.commentText.trim()) return;
    
    const userInfo = wx.getStorageSync('userInfo') || {};
    const userName = userInfo.name || '我';
    
    const newComment = {
      id: `cmt_${Date.now()}`,
      user: userName,
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
  
  // 处理投票 - 先检查登录
  handleVote() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      this.authDialog.showDialog({
        success: (userInfo) => {
          this.checkVoteLimit();
        }
      });
      return;
    }
    this.checkVoteLimit();
  },
  
  // 检查投票限制
  checkVoteLimit() {
    if (this.data.voteLimit.hasVoted) {
      // 已经投过票，提示转发获取更多机会
      this.setData({
        modalTitle: '获取更多投票机会',
        modalType: 'share',
        shareType: 'vote'
      });
    } else {
      // 今天第一次投票，直接投1票
      this.freeVote();
    }
  },
  
  // 免费投1票
  async freeVote() {
    const userInfo = this.data.userInfo;
    userInfo.votes += 1;
    
    // 记录投票信息
    const voteLimit = {
      hasVoted: true,
      lastVoteDate: new Date().toISOString()
    };
    
    this.setData({
      userInfo,
      voteLimit
    });
    
    // 保存投票限制记录
    try {
      wx.setStorageSync(`voteLimits_${userInfo.id}`, JSON.stringify(voteLimit));
    } catch (e) {
      console.error('保存投票限制记录失败:', e);
    }
    
    wx.showToast({
      title: '投票成功',
      icon: 'success'
    });

    // 播放投票音效
    this.playVoteSound(userInfo.id);
  },
  
  // 处理转发获得的投票
  handleShareVote() {
    const userInfo = this.data.userInfo;
    
    // 检查用户今天是否已经通过分享获取过投票
    const lastShareVoteTime = wx.getStorageSync(`lastShareVoteTime_${userInfo.id}`) || 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (lastShareVoteTime >= today) {
      // 如果今天已经奖励过，则直接返回，不重复奖励
      wx.showToast({
        title: '今日已获得分享投票',
        icon: 'none'
      });
      return;
    }
    
    // 增加投票
    userInfo.votes += 1;
    
    this.setData({
      userInfo,
      modalType: '' // 使用正确的变量关闭弹窗
    });
    
    // 记录本次奖励的时间戳，防止用户重复获取
    wx.setStorageSync(`lastShareVoteTime_${userInfo.id}`, now.getTime());
    
    // 保存到云端（如果需要）
    this.saveVoteToCloud(userInfo.id, 1, 'share');
    
    wx.showToast({
      title: '分享成功！已获得投票',
      icon: 'success'
    });
  },
  
  // 处理转发获得的减票
  handleShareDownVote() {
    const userInfo = this.data.userInfo;
    
    // 检查用户今天是否已经通过分享获取过减票
    const lastShareDownVoteTime = wx.getStorageSync(`lastShareDownVoteTime_${userInfo.id}`) || 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (lastShareDownVoteTime >= today) {
      // 如果今天已经奖励过，则直接返回，不重复奖励
      wx.showToast({
        title: '今日已获得分享减票',
        icon: 'none'
      });
      return;
    }
    
    // 减票
    userInfo.votes -= 1;
    
    this.setData({
      userInfo,
      modalType: '' // 使用正确的变量关闭弹窗
    });
    
    // 记录本次奖励的时间戳，防止用户重复获取
    wx.setStorageSync(`lastShareDownVoteTime_${userInfo.id}`, now.getTime());
    
    // 保存到云端（如果需要）
    this.saveVoteToCloud(userInfo.id, -1, 'share');
    
    wx.showToast({
      title: '分享成功！已减少票数',
      icon: 'success'
    });
  },
  
  // 处理减票前检查登录
  handleDownVote() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      this.authDialog.showDialog({
        success: (userInfo) => {
          this.checkDownVoteLimit();
        }
      });
      return;
    }
    this.checkDownVoteLimit();
  },
  
  // 检查减票限制
  checkDownVoteLimit() {
    if (this.data.downvoteLimit.hasDownvoted) {
      // 已经减过票，提示转发获取更多机会
      this.setData({
        modalTitle: '获取减票机会',
        modalType: 'downvoteShare',
        shareType: 'downvote'
      });
    } else {
      // 今天第一次减票，直接减1票
      this.processDownVote();
    }
  },
  
  // 显示减票选项 - 不再使用
  showDownVoteOptions() {
    wx.showActionSheet({
      itemList: ['减1票', '转发获得减票机会'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 减1票
          this.processDownVote();
        } else if (res.tapIndex === 1) {
          // 转发获得减票机会
          this.setData({
            modalTitle: '获取减票机会',
            modalType: 'downvoteShare',
            shareType: 'downvote'
          });
        }
      }
    });
  },
  
  // 播放音效前检查登录
  playSound() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      this.authDialog.showDialog({
        success: (userInfo) => {
          this.startRecording();
        }
      });
      return;
    }
    this.startRecording();
  },

  // 开始录音
  startRecording() {
    // 先检查是否已有录音权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record']) {
          // 已有权限，直接开始录音
          this.doStartRecording();
        } else {
          // 请求录音权限
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              // 用户同意，开始录音
              this.doStartRecording();
            },
            fail: (err) => {
              console.log('录音授权失败:', err);
              // 用户拒绝授权，引导用户开启
              wx.showModal({
                title: '需要录音权限',
                content: '录制想吃音效需要您的录音权限',
                confirmText: '去授权',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.record']) {
                          this.doStartRecording();
                        } else {
                          wx.showToast({
                            title: '未获得录音权限',
                            icon: 'none'
                          });
                        }
                      },
                      fail: (err) => {
                        console.error('打开设置页失败:', err);
                        wx.showToast({
                          title: '打开设置页失败',
                          icon: 'none'
                        });
                      }
                    });
                  }
                }
              });
            }
          });
        }
      },
      fail: (err) => {
        console.error('获取设置信息失败:', err);
        wx.showToast({
          title: '获取权限信息失败',
          icon: 'none'
        });
      }
    });
  },

  // 实际开始录音
  doStartRecording() {
    const recorderManager = wx.getRecorderManager();
    
    // 设置录音参数
    const options = {
      duration: 10000, // 最长10秒
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 192000,
      format: 'mp3'
    };
    
    // 录音开始事件
    recorderManager.onStart(() => {
      wx.showToast({
        title: '正在录音...',
        icon: 'loading',
        duration: 10000
      });
      
      this.setData({
        isRecording: true
      });
    });
    
    // 录音错误事件
    recorderManager.onError((res) => {
      console.error('录音失败:', res);
      this.setData({
        isRecording: false
      });
      
      wx.showToast({
        title: '录音失败',
        icon: 'error'
      });
    });
    
    // 录音结束事件
    recorderManager.onStop((res) => {
      this.setData({
        tempSoundPath: res.tempFilePath,
        isRecording: false
      });
      
      wx.hideToast();
      wx.showToast({
        title: '录音完成',
        icon: 'success'
      });
    });
    
    // 开始录音
    recorderManager.start(options);
  },

  // 确认音效
  recordSound() {
    if (!this.data.tempSoundPath) {
      wx.showToast({
        title: '请先录制音效',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '保存中...',
    });
    
    // 上传录音文件到云存储
    wx.cloud.uploadFile({
      cloudPath: `sounds/${this.data.userInfo.id}_${Date.now()}.mp3`,
      filePath: this.data.tempSoundPath,
      success: res => {
        // 更新用户音效设置
        wx.cloud.callFunction({
          name: 'soundManage',
          data: {
            action: 'updateSoundSettings',
            settingData: {
              enabled: true,
              soundUrl: res.fileID
            }
          },
          success: result => {
            wx.hideLoading();
            wx.showToast({
              title: '音效保存成功',
              icon: 'success'
            });
          },
          fail: err => {
            console.error('保存音效失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'error'
            });
          }
        });
      },
      fail: err => {
        console.error('上传音效失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'error'
        });
      }
    });
  },
  
  // 添加战绩前检查登录
  addAchievement() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      this.authDialog.showDialog({
        success: (userInfo) => {
          this.showAchievementModal();
        }
      });
      return;
    }
    this.showAchievementModal();
  },
  
  // 显示添加事迹弹窗
  showAchievementModal() {
    this.setData({
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
      content: this.data.newAchievement,
      date: this.formatDate(new Date()),
      type: 'neutral'
    };
    
    const achievements = [newAchievement, ...this.data.achievements];
    this.setData({
      achievements,
      modalType: ''
    });
    
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },
  
  // 处理减票逻辑
  processDownVote() {
    // 减1票
    const userInfo = this.data.userInfo;
    userInfo.votes -= 1;
    
    // 记录减票信息
    const downvoteLimit = {
      hasDownvoted: true,
      lastDownvoteDate: new Date().toISOString()
    };
    
    this.setData({
      userInfo,
      downvoteLimit,
      modalType: ''
    });
    
    // 保存减票限制记录
    try {
      wx.setStorageSync(`downvoteLimits_${userInfo.id}`, JSON.stringify(downvoteLimit));
    } catch (e) {
      console.error('保存减票限制记录失败:', e);
    }
    
    wx.showToast({
      title: '减票成功',
      icon: 'success'
    });
  },
  
  // 关闭弹窗
  closeModal() {
    this.setData({
      modalType: ''
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
    // 检查是否是新提名的用户（没有任何评论和战绩）
    if (!this.data.userInfo || !this.data.userInfo.id) {
      console.log('用户信息不完整，不生成随机弹幕');
      this.setData({ danmakuList: [] });
      return;
    }

    // 新用户不生成随机弹幕
    if (this.data.achievements.length === 0 && this.data.comments.length === 0) {
      console.log('新提名用户，不生成随机弹幕');
      this.setData({ danmakuList: [] });
      return;
    }

    const danmakuTexts = [
      '太有才了',
      '哈哈哈笑死我了',
      '这是什么神仙',
      '我来了我来了',
      '蹭个榜哈哈',
      '为什么他会上榜',
      '想吃+1',
      '简直太强了',
      '吃货本货啊',
      '明天我们一起去吃'
    ];
    
    const danmakuList = [];
    
    // 生成10-20条随机弹幕，增加弹幕数量
    const count = Math.floor(Math.random() * 10) + 10;
    
    for (let i = 0; i < count; i++) {
      danmakuList.push({
        id: `dm_${i}`,
        text: danmakuTexts[Math.floor(Math.random() * danmakuTexts.length)],
        top: Math.floor(Math.random() * 98) + 1, // 修改为1-99%的范围，覆盖整个页面
        duration: Math.floor(Math.random() * 10000) + 5000
      });
    }
    
    this.setData({ danmakuList });
  },

  // 用于分享到好友
  onShareAppMessage(options) {
    console.log('执行onShareAppMessage');
    
    // 立即关闭弹窗
    this.setData({ modalType: '' });
    
    // 获取用户信息
    const userInfo = this.data.userInfo || {};
    const userName = userInfo.name || '用户';
    
    // 获取分享类型
    const from = options ? options.from : '';
    const target = options && options.target ? options.target : null;
    const shareType = target && target.dataset ? target.dataset.shareType : 'normal';
    
    console.log('分享类型:', shareType, '用户:', userName);
    
    // 构建分享内容
    const shareContent = {
      title: `来看看${userName}的得吃档案，这么受欢迎？`,
      path: `/pages/detail/detail?id=${userInfo.id || '1'}`,
      imageUrl: userInfo.avatar || '/public/placeholder.jpg',
      promise: null
    };
    
    // 如果是特定类型的分享，处理奖励逻辑
    if ((shareType === 'vote' || shareType === 'downvote') && userInfo.id) {
      // 使用promise属性处理异步奖励逻辑
      shareContent.promise = new Promise((resolve) => {
        // 处理分享奖励
        this.processShareReward(shareType, userInfo);
        resolve();
      });
    }
    
    return shareContent;
  },
  
  // 用于分享到朋友圈
  onShareTimeline() {
    return {
      title: `来看看${this.data.userInfo.name}的得吃档案`,
      query: `id=${this.data.userInfo.id}`,
      imageUrl: this.data.userInfo.avatar // 使用用户头像作为分享图
    };
  },

  // 获取用户音效设置
  async getUserSoundSettings(userId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'soundManage',
        data: {
          action: 'getSoundSettings',
          userId: userId
        }
      });
      
      return res.result.success ? res.result.data : null;
    } catch (err) {
      console.error('获取音效设置失败:', err);
      return null;
    }
  },

  // 播放投票音效
  async playVoteSound(userId) {
    const settings = await this.getUserSoundSettings(userId);
    
    if (settings && settings.enabled && settings.soundUrl) {
      const innerAudioContext = wx.createInnerAudioContext();
      innerAudioContext.src = settings.soundUrl;
      innerAudioContext.play();
      
      innerAudioContext.onError((res) => {
        console.error('音效播放失败:', res);
      });
    }
  },

  // 保存投票到云端（如果需要）
  async saveVoteToCloud(userId, voteChange, source) {
    try {
      await wx.cloud.callFunction({
        name: 'voteManage',
        data: {
          action: 'updateVotes',
          userId: userId,
          voteChange: voteChange,
          source: source
        }
      });
      console.log(`投票已保存到云端，用户ID: ${userId}, 变化: ${voteChange}, 来源: ${source}`);
    } catch (err) {
      console.error('保存投票到云端失败:', err);
    }
  },

  // 播放预览
  playPreview() {
    try {
      if (this.data.isPreviewPlaying) {
        // 如果正在播放，则停止
        if (this.data.innerAudioContext) {
          this.data.innerAudioContext.stop();
        }
        this.setData({
          isPreviewPlaying: false
        });
        return;
      }
      
      // 开始播放预览
      const innerAudioContext = wx.createInnerAudioContext();
      innerAudioContext.src = this.data.tempSoundPath;
      
      innerAudioContext.onPlay(() => {
        console.log('开始播放预览');
        this.setData({
          isPreviewPlaying: true,
          innerAudioContext: innerAudioContext
        });
      });
      
      innerAudioContext.onEnded(() => {
        console.log('预览播放结束');
        this.setData({
          isPreviewPlaying: false
        });
      });
      
      innerAudioContext.onError((res) => {
        console.error('预览播放失败:', res);
        this.setData({
          isPreviewPlaying: false
        });
        wx.showToast({
          title: '播放失败',
          icon: 'error'
        });
      });
      
      innerAudioContext.play();
    } catch (error) {
      console.error('播放预览出错:', error);
      this.setData({
        isPreviewPlaying: false
      });
      wx.showToast({
        title: '播放失败',
        icon: 'error'
      });
    }
  },

  // 删除录音并重新录制
  deleteAndRerecord() {
    try {
      // 如果有正在播放的音频，先停止
      if (this.data.innerAudioContext) {
        this.data.innerAudioContext.stop();
      }
      
      // 重置状态
      this.setData({
        tempSoundPath: '',
        soundDuration: 0,
        isPreviewPlaying: false,
        innerAudioContext: null
      });
      
      // 开始新的录音
      this.startRecording();
    } catch (error) {
      console.error('删除录音出错:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  }
})
