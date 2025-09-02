// pages/detail/detail.js
var app = getApp();

Page({
  data: {
    // 提名条目信息
    entryInfo: {},
    entryId: '',
    
    // 投票相关
    voteLimit: 10,
    downvoteLimit: 5,
    userVotes: 0,
    userDownvotes: 0,
    
    // 评论相关
    comments: [],
    commentContent: '',
    commentCount: 0,
    commentPage: 1,
    hasMoreComments: true,
    replyTo: null,
    showingMoreReplies: {},
    
    // 弹幕相关
    danmakus: [],
    danmakuText: '',
    danmakuList: [],
    
    // 事迹相关
    achievements: [],
    newAchievement: '',
    modalType: '',
    modalTitle: '',
    
    // 音效相关
    recordingState: 'idle', // 'idle', 'recording', 'recorded'
    recordTime: 0,
    tempSoundPath: '',
    soundDuration: 0,
    formattedRecordTime: '00:00',
    formattedTempDuration: '0',
    isPreviewPlaying: false,
    recorderManager: null,
    innerAudioContext: null,
    recordTimer: null,
    
    // 分享相关
    shareInfo: {
      title: '',
      path: '',
      imageUrl: ''
    },
    shareType: 'friend',
    
    // 授权对话框
    showAuthDialog: false,
    _pendingAction: null, // 待执行的操作
    
    // 投票奖励系统
    showShareModal: false, // 显示分享弹窗
    todayVoteStatus: {
      upVote: { hasVoted: false, rewardCount: 0 },
      downVote: { hasVoted: false, rewardCount: 0 }
    },
    shareModalType: '', // 'vote' 或 'downvote'
    shareModalVoteType: '', // 当前分享的投票类型
    isPendingShareReward: false, // 是否等待分享奖励
    
    // 加载状态
    isLoading: false
  },

  onLoad: function(options) {
    console.log('Detail页面加载，参数:', options);
    
    // 获取条目ID
    var entryId = options.id;
    
    if (entryId) {
      this.setData({
        entryId: entryId
      });
      
      // 初始化音频管理器
      this.initAudioManagers();
      
      // 加载页面数据
      this.loadEntryDetail();
      this.loadComments();
      this.loadDanmakus();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow: function() {
    // 重新加载数据以确保最新状态
    if (this.data.entryId) {
      this.loadEntryDetail();
    }
  },

  onUnload: function() {
    // 清理音频资源
    try {
      if (this.data.recorderManager) {
        this.data.recorderManager.stop();
      }
    } catch (e) {
      console.warn('清理录音管理器失败:', e);
    }
    
    try {
      if (this.data.innerAudioContext) {
        // 尝试多种清理方法
        if (typeof this.data.innerAudioContext.destroy === 'function') {
          this.data.innerAudioContext.destroy();
        } else if (typeof this.data.innerAudioContext.stop === 'function') {
          this.data.innerAudioContext.stop();
        }
        // 清除引用
        this.data.innerAudioContext = null;
      }
    } catch (e) {
      console.warn('清理音频上下文失败:', e);
    }
    
    try {
      if (this.data.recordTimer) {
        clearInterval(this.data.recordTimer);
        this.data.recordTimer = null;
      }
    } catch (e) {
      console.warn('清理计时器失败:', e);
    }
  },

  // 初始化音频管理器
  initAudioManagers: function() {
    var recorderManager = wx.getRecorderManager();
    var innerAudioContext = wx.createInnerAudioContext();
    
    // 录音事件监听
    var self = this;
    recorderManager.onStart(function() {
      console.log('录音开始');
    });
    
    recorderManager.onStop(function(res) {
      console.log('录音结束', res);
      self.handleRecordingStop(res);
    });
    
    recorderManager.onError(function(err) {
      console.error('录音错误', err);
      wx.showToast({
        title: '录音失败',
        icon: 'error'
      });
      self.setData({
        recordingState: 'idle'
      });
    });
    
    // 播放事件监听
    innerAudioContext.onPlay(function() {
      console.log('音频播放开始');
      self.setData({
        isPreviewPlaying: true
      });
    });
    
    innerAudioContext.onEnded(function() {
      console.log('音频播放结束');
      self.setData({
        isPreviewPlaying: false
      });
    });
    
    innerAudioContext.onError(function(err) {
      console.error('音频播放错误', err);
      self.setData({
        isPreviewPlaying: false
      });
    });
    
    this.setData({
      recorderManager: recorderManager,
      innerAudioContext: innerAudioContext
    });
  },

  // 加载条目详情
  loadEntryDetail: function() {
    wx.showLoading({
      title: '加载中...'
    });
    
    // 直接从entries集合获取条目信息
    wx.cloud.database().collection('entries').doc(this.data.entryId).get().then(res => {
      wx.hideLoading();
      console.log('条目详情加载结果:', res);
      
      if (res.data) {
        var entryInfo = res.data;
        this.setData({
          entryInfo: entryInfo,
          shareInfo: {
            title: '来看看' + entryInfo.name + '的得吃档案',
            path: '/pages/detail/detail?id=' + this.data.entryId,
            imageUrl: entryInfo.avatarUrl || entryInfo.avatar || '/images/placeholder-user.jpg'
          }
        });
        
        // 条目信息加载完成后，再加载事迹和投票状态
        this.loadAchievements();
        
        // 安全加载投票状态，避免影响主流程
        try {
          this.loadTodayVoteStatus();
        } catch (error) {
          console.warn('加载投票状态失败，但不影响主流程:', error);
        }
      } else {
        wx.showToast({
          title: '条目不存在',
          icon: 'error'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载条目详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    });
  },

  // 加载事迹列表
  loadAchievements: function() {
    // 事迹是关联到条目创建者的，需要从entryInfo获取创建者ID
    if (!this.data.entryInfo.createdBy) {
      console.log('条目信息不完整，跳过加载事迹');
      return;
    }
    
    wx.cloud.callFunction({
      name: 'achievementManage',
      data: {
        action: 'get',
        userId: this.data.entryInfo.createdBy
      }
    }).then(res => {
      console.log('事迹加载结果:', res);
      
      if (res.result && res.result.success) {
        this.setData({
          achievements: res.result.achievements || []
        });
      }
    }).catch(err => {
      console.error('加载事迹失败:', err);
    });
  },

  // 加载评论列表
  loadComments: function(isLoadMore) {
    var page = isLoadMore ? this.data.commentPage + 1 : 1;
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'list',
        data: {
          nominationId: this.data.entryId,
          page: page,
          limit: 10
        }
      }
    }).then(res => {
      console.log('评论加载结果:', res);
      
      if (res.result && res.result.success) {
        var newComments = res.result.comments || [];
        var comments = isLoadMore ? this.data.comments.concat(newComments) : newComments;
        
        this.setData({
          comments: comments,
          commentCount: res.result.total || 0,
          commentPage: page,
          hasMoreComments: newComments.length >= 10
        });
      }
    }).catch(err => {
      console.error('加载评论失败:', err);
    });
  },

  // 加载弹幕列表
  loadDanmakus: function() {
    wx.cloud.callFunction({
      name: 'danmakuManage',
              data: {
          action: 'get',
          targetId: this.data.entryId
        }
    }).then(res => {
      console.log('弹幕加载结果:', res);
      
      if (res.result && res.result.success) {
        this.setData({
          danmakus: res.result.data || [],
          danmakuList: res.result.data || []
        });
      }
    }).catch(err => {
      console.error('加载弹幕失败:', err);
    });
  },

  // 想吃功能
  handleVote: function() {
    this.requireLogin(() => {
      wx.showLoading({
        title: '想吃中...'
      });
      
      wx.cloud.callFunction({
        name: 'voteManage',
        data: {
          action: 'vote',
          targetId: this.data.entryId
        }
      }).then(res => {
        wx.hideLoading();
        console.log('想吃结果:', res);
        
        if (res.result && res.result.success) {
          // 首次投票成功
          this.playVoteSound();
          this.loadEntryDetail();
          this.loadTodayVoteStatus();
          
          // 刷新全局排行榜数据，确保主页数据一致
          var app = getApp();
          app.refreshRankingData();
          
          wx.showToast({
            title: '想吃成功',
            icon: 'success'
          });
        } else if (res.result && res.result.code === 'NEED_SHARE') {
          // 需要通过分享获得奖励
          this.showShareRewardModal('vote', res.result);
        } else {
          wx.showToast({
            title: res.result.message || '想吃失败',
            icon: 'error'
          });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('想吃失败:', err);
        wx.showToast({
          title: '想吃失败',
          icon: 'error'
        });
      });
    }, '想吃');
  },

  // 拒吃功能
  handleDownVote: function() {
    this.requireLogin(() => {
      wx.showLoading({
        title: '拒吃中...'
      });
      
      wx.cloud.callFunction({
        name: 'voteManage',
        data: {
          action: 'downvote',
          targetId: this.data.entryId
        }
      }).then(res => {
        wx.hideLoading();
        console.log('拒吃结果:', res);
        
        if (res.result && res.result.success) {
          // 首次投票成功
          this.loadEntryDetail();
          this.loadTodayVoteStatus();
          
          // 刷新全局排行榜数据，确保主页数据一致
          var app = getApp();
          app.refreshRankingData();
          
          wx.showToast({
            title: '拒吃成功',
            icon: 'success'
          });
        } else if (res.result && res.result.code === 'NEED_SHARE') {
          // 需要通过分享获得奖励
          this.showShareRewardModal('downvote', res.result);
        } else {
          wx.showToast({
            title: res.result.message || '拒吃失败',
            icon: 'error'
          });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('拒吃失败:', err);
        wx.showToast({
          title: '拒吃失败',
          icon: 'error'
        });
      });
    }, '拒吃');
  },

  // 播放想吃音效
  playVoteSound: function() {
    // 获取页面音效设置
    wx.cloud.callFunction({
      name: 'soundManage',
      data: {
        action: 'getPageSound',
        pageId: 'detail_想吃'
      }
    }).then(res => {
      if (res.result && res.result.success && res.result.soundUrl) {
        var audio = wx.createInnerAudioContext();
        audio.src = res.result.soundUrl;
        audio.play();
        
        audio.onError((err) => {
          console.error('音效播放失败:', err);
        });
      }
    }).catch(err => {
      console.error('获取音效失败:', err);
    });
  },

  // 评论输入
  onCommentInput: function(e) {
    this.setData({
      commentContent: e.detail.value
    });
  },

  // 提交评论
  submitComment: function() {
    var content = this.data.commentContent.trim();
    if (!content) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none'
      });
      return;
    }
    
    this.requireLogin(() => {
      this.processSubmitComment(content);
    }, '评论');
  },

  // 处理评论提交
  processSubmitComment: function(content) {
    wx.showLoading({
      title: '提交中...'
    });
    
    var action = this.data.replyTo ? 'reply' : 'add';
    var data = {
      nominationId: this.data.entryId,
      content: content
    };
    
    if (this.data.replyTo) {
      data.parentId = this.data.replyTo._id;
      data.replyToUserId = this.data.replyTo._id;
    }
    
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: action,
        data: data
      }
    }).then(res => {
      wx.hideLoading();
      console.log('评论提交结果:', res);
      
      if (res.result && res.result.success) {
        this.setData({
          commentContent: '',
          replyTo: null
        });
        
        // 重新加载评论
        this.loadComments();
        
        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.message || '评论失败',
          icon: 'error'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('评论失败:', err);
      wx.showToast({
        title: '评论失败',
        icon: 'error'
      });
    });
  },

  // 回复评论
  replyComment: function(e) {
    var dataset = e.currentTarget.dataset;
    var replyInfo = {
      _id: dataset.id,
      creatorName: dataset.name
    };
    
    this.requireLogin(() => {
      this.setData({
        replyTo: replyInfo
      });
      
      // 聚焦到输入框
      wx.nextTick(() => {
        var query = this.createSelectorQuery();
        query.select('.comment-input').node((res) => {
          if (res && res.node) {
            res.node.focus();
          }
        }).exec();
      });
    }, '回复评论');
  },

  // 取消回复
  cancelReply: function() {
    this.setData({
      replyTo: null
    });
  },

  // 点赞评论
  likeComment: function(e) {
    var commentId = e.currentTarget.dataset.id;
    
    this.requireLogin(() => {
      wx.cloud.callFunction({
        name: 'commentManage',
        data: {
          action: 'like',
          data: {
            commentId: commentId
          }
        }
      }).then(res => {
        console.log('点赞结果:', res);
        
        if (res.result && res.result.success) {
          // 重新加载评论
          this.loadComments();
        }
      }).catch(err => {
        console.error('点赞失败:', err);
      });
    }, '点赞评论');
  },

  // 显示更多回复
  showMoreReplies: function(e) {
    var commentId = e.currentTarget.dataset.id;
    var showingMoreReplies = Object.assign({}, this.data.showingMoreReplies);
    showingMoreReplies[commentId] = true;
    
    this.setData({
      showingMoreReplies: showingMoreReplies
    });
    
    // 加载更多回复
    wx.cloud.callFunction({
      name: 'commentManage',
      data: {
        action: 'listReplies',
        data: {
          parentId: commentId
        }
      }
    }).then(res => {
      if (res.result && res.result.success) {
        // 更新评论列表中的回复
        var comments = this.data.comments.map(comment => {
          if (comment._id === commentId) {
            comment.replies = res.result.replies || [];
          }
          return comment;
        });
        
        this.setData({
          comments: comments
        });
      }
    }).catch(err => {
      console.error('加载回复失败:', err);
    });
  },

  // 加载更多评论
  loadMoreComments: function() {
    if (!this.data.hasMoreComments) {
      return;
    }
    
    this.loadComments(true);
  },

  // 弹幕输入
  onDanmakuInput: function(e) {
    this.setData({
      danmakuText: e.detail.value
    });
  },

  // 发送弹幕（WXML绑定方法）
  sendDanmaku: function() {
    this.submitDanmaku();
  },

  // 提交弹幕
  submitDanmaku: function() {
    var text = this.data.danmakuText.trim();
    if (!text) {
      wx.showToast({
        title: '请输入弹幕内容',
        icon: 'none'
      });
      return;
    }
    
    this.requireLogin(() => {
      wx.cloud.callFunction({
        name: 'danmakuManage',
        data: {
          action: 'add',
          targetId: this.data.entryId,
          text: text,
          color: '#ffffff'
        }
      }).then(res => {
        console.log('弹幕提交结果:', res);
        
        if (res.result && res.result.success) {
          this.setData({
            danmakuText: ''
          });
          
          // 重新加载弹幕
          this.loadDanmakus();
          
          wx.showToast({
            title: '弹幕发送成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.result.message || '弹幕发送失败',
            icon: 'error'
          });
        }
      }).catch(err => {
        console.error('弹幕发送失败:', err);
        wx.showToast({
          title: '弹幕发送失败',
          icon: 'error'
        });
      });
    }, '发送弹幕');
  },

  // 事迹输入
  onAchievementInput: function(e) {
    this.setData({
      newAchievement: e.detail.value
    });
  },

  // 添加事迹
  addAchievement: function() {
    this.requireLogin(() => {
      this.showAchievementModal();
    }, '添加事迹');
  },

  // 显示事迹模态框
  showAchievementModal: function() {
    this.setData({
      modalType: 'achievement',
      modalTitle: '添加新事迹'
    });
  },

  // 关闭模态框
  closeModal: function() {
    this.setData({
      modalType: '',
      newAchievement: ''
    });
  },

  // 提交事迹
  submitAchievement: function() {
    var content = this.data.newAchievement.trim();
    if (!content) {
      wx.showToast({
        title: '请输入事迹内容',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '提交中...'
    });
    
    wx.cloud.callFunction({
      name: 'achievementManage',
      data: {
        action: 'add',
        userId: this.data.entryInfo.createdBy,
        achievement: {
          content: content,
          createTime: new Date()
        }
      }
    }).then(res => {
      wx.hideLoading();
      console.log('事迹提交结果:', res);
      
      if (res.result && res.result.success) {
        // 重新加载事迹列表以确保数据完整性
        this.loadAchievements();
        
        this.setData({
          modalType: '',
          newAchievement: ''
        });
        
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.message || '添加失败',
          icon: 'error'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('事迹添加失败:', err);
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      });
    });
  },

  // 删除事迹
  deleteAchievement: function(e) {
    var achievementId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条事迹吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...'
          });
          
          wx.cloud.callFunction({
            name: 'achievementManage',
            data: {
              action: 'delete',
              achievementId: achievementId
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              // 从列表中移除
              var achievements = this.data.achievements.filter(item => item._id !== achievementId);
              this.setData({
                achievements: achievements
              });
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: res.result.message || '删除失败',
                icon: 'error'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('删除事迹失败:', err);
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          });
        }
      }
    });
  },

  // 录制音效
  recordSound: function() {
    this.requireLogin(() => {
      if (this.data.recordingState === 'idle') {
        this.startRecording();
      } else if (this.data.recordingState === 'recorded') {
        this.saveRecordedSound();
      }
    }, '录制音效');
  },

  // 开始录音
  startRecording: function() {
    wx.authorize({
      scope: 'scope.record'
    }).then(() => {
      this.setData({
        recordingState: 'recording',
        recordTime: 0
      });
      
      // 开始录音
      this.data.recorderManager.start({
        duration: 5000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'mp3'
      });
      
      // 开始计时
      this.startRecordTimer();
    }).catch(err => {
      console.error('录音授权失败:', err);
      wx.showToast({
        title: '需要录音权限',
        icon: 'none'
      });
    });
  },

  // 开始录音计时
  startRecordTimer: function() {
    var self = this;
    this.data.recordTimer = setInterval(function() {
      var recordTime = self.data.recordTime + 0.1;
      self.setData({
        recordTime: recordTime,
        formattedRecordTime: self.formatRecordTime(recordTime)
      });
      
      if (recordTime >= 5) {
        self.confirmRecording();
      }
    }, 100);
  },

  // 确认录音
  confirmRecording: function() {
    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
    }
    
    this.data.recorderManager.stop();
  },

  // 取消录音
  cancelRecording: function() {
    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
    }
    
    this.data.recorderManager.stop();
    
    this.setData({
      recordingState: 'idle',
      recordTime: 0,
      formattedRecordTime: '00:00'
    });
  },

  // 处理录音结束
  handleRecordingStop: function(res) {
    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
    }
    
    if (res.tempFilePath) {
      this.setData({
        recordingState: 'recorded',
        tempSoundPath: res.tempFilePath,
        soundDuration: res.duration || this.data.recordTime,
        formattedTempDuration: (res.duration / 1000 || this.data.recordTime).toFixed(1)
      });
    } else {
      this.setData({
        recordingState: 'idle'
      });
    }
  },

  // 预览录音
  previewRecordedSound: function() {
    if (this.data.tempSoundPath) {
      this.data.innerAudioContext.src = this.data.tempSoundPath;
      this.data.innerAudioContext.play();
    }
  },

  // 删除录音
  deleteRecordedSound: function() {
    this.setData({
      recordingState: 'idle',
      tempSoundPath: '',
      soundDuration: 0,
      formattedTempDuration: '0'
    });
  },

  // 保存录音
  saveRecordedSound: function() {
    if (!this.data.tempSoundPath) {
      wx.showToast({
        title: '没有录音文件',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '上传中...'
    });
    
    // 上传音频文件
    wx.cloud.uploadFile({
      cloudPath: 'user_sounds/' + Date.now() + '.mp3',
      filePath: this.data.tempSoundPath
    }).then(res => {
      console.log('音频上传结果:', res);
      
      if (res.fileID) {
        // 保存音效设置
        return wx.cloud.callFunction({
          name: 'soundManage',
          data: {
            action: 'bindPageSound',
            pageId: 'detail_想吃',
            soundId: res.fileID
          }
        });
      } else {
        throw new Error('文件上传失败');
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        this.setData({
          recordingState: 'idle',
          tempSoundPath: '',
          soundDuration: 0
        });
        
        wx.showToast({
          title: '音效设置成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '设置失败',
          icon: 'error'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('音效保存失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    });
  },

  // 播放音效
  playSound: function() {
    this.playVoteSound();
  },

  // 格式化录音时间
  formatRecordTime: function(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  },

  // 格式化时间
  formatTime: function(date) {
    if (!date) return '';
    
    var now = new Date();
    var target = new Date(date);
    var diff = now.getTime() - target.getTime();
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) { // 1天内
      return Math.floor(diff / 3600000) + '小时前';
    } else {
      return target.getMonth() + 1 + '月' + target.getDate() + '日';
    }
  },

  // 通用的需要登录功能触发器（参考index页面的逻辑）
  requireLogin: function(action, actionName) {
    var app = getApp();
    
    if (app.globalData.isLoggedIn) {
      // 已登录，直接执行操作
      if (typeof action === 'function') {
        action();
      }
      return;
    }
    
    // 未登录，触发登录流程
    wx.showLoading({ title: '登录中...', mask: true });
    
    app.triggerLogin().then(loginResult => {
      wx.hideLoading();
      console.log('登录结果:', loginResult);
      
      if (loginResult && loginResult.success) {
        if (loginResult.needsUserInfo) {
          // 需要完善用户信息，显示授权弹窗
          this.setData({
            showAuthDialog: true,
            _pendingAction: action // 保存待执行的操作
          });
        } else {
          // 登录成功且信息完整，更新页面状态并执行操作
          app.globalData.isLoggedIn = true;
          
          if (typeof action === 'function') {
            action();
          }
        }
      } else {
        wx.showToast({
          title: (loginResult && loginResult.message) || '登录失败',
          icon: 'error'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({
        title: '登录失败',
        icon: 'error'
      });
    });
  },

  // 处理授权成功
  handleAuthSuccess: function(e) {
    console.log('授权成功:', e.detail);
    
    var app = getApp();
    
    // 更新全局用户状态
    app.globalData.isLoggedIn = true;
    app.globalData.needsUserInfo = false;
    app.globalData.userInfo = Object.assign(app.globalData.userInfo, e.detail.userInfo);
    
    this.setData({
      showAuthDialog: false
    });
    
    // 执行待处理的操作
    if (this.data._pendingAction && typeof this.data._pendingAction === 'function') {
      this.data._pendingAction();
      this.setData({
        _pendingAction: null
      });
    }
    
    wx.showToast({
      title: '授权成功',
      icon: 'success'
    });
  },

  // 处理授权取消
  handleAuthCancel: function() {
    console.log('用户取消授权');
    this.setData({
      showAuthDialog: false,
      _pendingAction: null
    });
    
    wx.showToast({
      title: '已取消授权',
      icon: 'none'
    });
  },

  // 分享给好友
  onShareAppMessage: function() {
    // 如果是等待分享奖励的状态，分享完成后给奖励
    if (this.data.isPendingShareReward) {
      var self = this;
      // 延迟执行奖励，让分享操作先完成
      setTimeout(function() {
        self.setData({
          isPendingShareReward: false
        });
        self.getShareReward();
      }, 1000);
    }
    
    return Object.assign({}, this.data.shareInfo, {
      title: this.data.shareInfo.title || '来看看这个人的得吃档案',
      path: this.data.shareInfo.path || '/pages/detail/detail?id=' + this.data.entryId,
      imageUrl: this.data.shareInfo.imageUrl || '/images/placeholder-user.jpg'
    });
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: this.data.shareInfo.title || '来看看这个人的得吃档案',
      path: this.data.shareInfo.path || '/pages/detail/detail?id=' + this.data.entryId,
      imageUrl: this.data.shareInfo.imageUrl || '/images/placeholder-user.jpg'
    };
  },

  // 加载今日投票状态
  loadTodayVoteStatus: function() {
    // 如果未登录，不加载投票状态
    if (!getApp().globalData.isLoggedIn) {
      return;
    }

    wx.cloud.callFunction({
      name: 'voteManage',
      data: {
        action: 'getTodayVoteStatus',
        targetId: this.data.entryId
      }
    }).then(res => {
      console.log('今日投票状态:', res);
      if (res.result && res.result.success) {
        this.setData({
          todayVoteStatus: {
            upVote: res.result.upVote || { hasVoted: false, rewardCount: 0 },
            downVote: res.result.downVote || { hasVoted: false, rewardCount: 0 }
          }
        });
      }
    }).catch(err => {
      console.error('加载今日投票状态失败:', err);
    });
  },

  // 显示分享奖励弹窗
  showShareRewardModal: function(type, voteResult) {
    var maxRewards = 5;
    var currentRewards = voteResult.rewardCount || 0;
    var voteType = voteResult.voteType;
    
    if (currentRewards >= maxRewards) {
      wx.showToast({
        title: '今日奖励次数已达上限',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showShareModal: true,
      shareModalType: type,
      shareModalVoteType: voteType,
      'todayVoteStatus.currentRewardCount': currentRewards // 临时存储当前类型的奖励次数
    });
  },

  // 关闭分享弹窗
  closeShareModal: function() {
    this.setData({
      showShareModal: false,
      shareModalType: ''
    });
  },

  // 取消分享
  cancelShare: function() {
    this.closeShareModal();
    wx.showToast({
      title: '已取消分享',
      icon: 'none'
    });
  },

  // 确认分享获得奖励
  confirmShare: function() {
    // 设置分享标记，然后关闭弹窗
    this.setData({
      isPendingShareReward: true
    });
    this.closeShareModal();
    
    // 直接显示分享菜单
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage']
    });
    
    // 提示用户分享
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 获得分享奖励
  getShareReward: function() {
    wx.showLoading({
      title: '获得奖励中...'
    });

    wx.cloud.callFunction({
      name: 'voteManage',
      data: {
        action: 'getShareReward',
        targetId: this.data.entryId,
        voteType: this.data.shareModalVoteType
      }
    }).then(res => {
      wx.hideLoading();
      console.log('分享奖励结果:', res);
      
      if (res.result && res.result.success) {
        // 更新对应类型的奖励状态
        var voteType = this.data.shareModalVoteType;
        var updateKey = voteType === 'up' ? 'todayVoteStatus.upVote.rewardCount' : 'todayVoteStatus.downVote.rewardCount';
        var updateData = {};
        updateData[updateKey] = res.result.rewardCount;
        
        this.setData(updateData);
        
        // 刷新页面数据以显示更新后的票数
        this.loadEntryDetail();
        
        // 刷新全局排行榜数据，确保主页数据一致
        var app = getApp();
        app.refreshRankingData();
        
        wx.showToast({
          title: res.result.message || '奖励获得成功！',
          icon: 'success'
        });
        
        // 播放音效
        this.playVoteSound();
      } else {
        wx.showToast({
          title: res.result.message || '获得奖励失败',
          icon: 'error'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获得分享奖励失败:', err);
      wx.showToast({
        title: '网络错误',
        icon: 'error'
      });
    });
  }
});