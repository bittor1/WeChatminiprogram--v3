// components/user-center-drawer/user-center-drawer.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    userInfo: {
      type: Object,
      value: null
    },
    topOffset: {
      type: Number,
      value: 0
    }
  },
  
  /**
   * 组件使用的其他组件
   */
  usingComponents: {
    'entry-card': '/components/entry-card/entry-card'
  },

  /**
   * 组件的初始数据
   */
  data: {
    visible: false,
    activeSubDrawer: '', // 当前活跃的子抽屉: orders, nominations, messages, sounds, about
    subDrawerVisible: false, // 子抽屉是否可见
    unreadMessageCount: 0, // 未读消息数量
    userStatistics: null, // 用户统计数据
    isLoading: false,
    
    // 我的提名相关
    nominations: [],
    nominationsLoading: false,
    nominationsRefreshing: false,
    
    // 我的消息相关
    messages: [],
    messagesLoading: false,
    activeMessageTab: 'all',
    messageCounts: { all: 0, comment: 0, vote: 0 },
    
    // 我的音效相关
    userSounds: [],
    soundsLoading: false,
    showSoundsLibrary: false,
    soundEnabled: false,
    currentSoundUrl: '',
    currentSoundName: '',
    recordingState: 'idle', // idle, recording, recorded
    recordTime: 0,
    formattedRecordTime: '00:00',
    tempFilePath: '',
    
    // 音频管理器
    recorderManager: null,
    innerAudioContext: null,
    recordTimer: null
  },

  /**
   * 组件的生命周期函数
   */
  lifetimes: {
    attached() {
      // 组件被创建时执行
    },
    ready() {
      // 组件挂载后执行
      
      // 检查初始show属性值
      if (this.properties.show) {
        this.setData({ visible: true });
      }
    },
    detached() {
      // 组件被移除时执行，确保清理所有状态
      this.setData({
        visible: false,
        activeSubDrawer: '',
        subDrawerVisible: false
      });
    }
  },

  /**
   * 监听器
   */
  observers: {
    'show': function(show) {
      if (show) {
        this.setData({
          visible: true
        });
        
        // 当抽屉显示时，加载未读消息数量和用户统计
        if (this.properties.userInfo) {
          this.loadUnreadMessageCount();
          this.loadUserStatistics();
        }
      } else {
        // 确认当前是由父组件主动关闭，而不是内部事件触发的关闭
        if (!this._internalClosing) {
          this.hideDrawer();
        }
      }
    },
    'userInfo': function(userInfo) {
      // 当用户信息变化时，如果抽屉可见，重新加载未读消息和统计
      if (userInfo && this.data.visible) {
        this.loadUnreadMessageCount();
        this.loadUserStatistics();
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 加载未读消息数量
    loadUnreadMessageCount() {
      if (!this.properties.userInfo || this.data.isLoading) return;
      
      this.setData({ isLoading: true });
      
      wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'getUserMessages'
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          this.setData({
            unreadMessageCount: res.result.unreadCount || 0,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
        }
      })
      .catch(err => {
        console.error('获取未读消息失败:', err);
        this.setData({ isLoading: false });
      });
    },
    
    // 加载用户统计数据
    loadUserStatistics() {
      if (!this.properties.userInfo || this.data.isLoading) return;
      
      wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getUserStats'
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          this.setData({
            userStatistics: res.result.data
          });
        }
      })
      .catch(err => {
        console.error('获取用户统计数据失败:', err);
      });
    },
    
    // 隐藏主抽屉
    hideDrawer() {
      // 设置内部关闭标志，防止观察者重复调用
      this._internalClosing = true;
      
      // 先隐藏子抽屉（如果有）
      if (this.data.subDrawerVisible) {
        this.hideSubDrawer();
      }
      
      this.setData({
        visible: false
      });
      
      // 延迟关闭抽屉
      setTimeout(() => {
        this.triggerEvent('close');
        
        // 重置内部关闭标志
        this._internalClosing = false;
        
        // 确保子抽屉相关状态被完全重置
        this.setData({
          activeSubDrawer: '',
          subDrawerVisible: false
        });
      }, 300);
    },
    
    // 显示子抽屉
    showSubDrawer(e) {
      const action = e.currentTarget.dataset.action;
      
      // 检查用户是否已登录（除了关于页面）
      if (!this.properties.userInfo && action !== 'about') {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }
      
      // 先重置所有子抽屉状态，确保不会有多个子抽屉同时显示
      this.setData({
        activeSubDrawer: '',
        subDrawerVisible: false
      });
      
      // 延迟一帧后设置新的活跃子抽屉，确保DOM有时间更新
      setTimeout(() => {
        this.setData({
          activeSubDrawer: action,
          subDrawerVisible: true
        });
        
        // 根据不同action加载对应数据
        this.loadSubDrawerData(action);
      }, 50);
    },
    
    // 加载子抽屉数据
    loadSubDrawerData(action) {
      switch (action) {
        case 'nominations':
          this.loadUserNominations();
          break;
        case 'messages':
          this.loadUserMessages();
          break;
        case 'sounds':
          this.loadUserSounds();
          break;
        default:
          break;
      }
    },
    
    // 标记所有消息为已读
    markAllMessagesAsRead: function() {
      console.log('✅ 全部已读按钮被点击');
      if (this.data.unreadMessageCount === 0) {
        console.log('📭 没有未读消息');
        wx.showToast({
          title: '暂无未读消息',
          icon: 'none'
        });
        return;
      }
      
      console.log('📮 开始标记消息为已读，未读数量:', this.data.unreadMessageCount);
      wx.showLoading({
        title: '处理中...'
      });
      
      wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'markAllAsRead'
        }
      })
      .then(function(res) {
        wx.hideLoading();
        console.log('标记已读结果:', res);
        if (res.result && res.result.success) {
          console.log('✅ 标记成功');
          this.setData({
            unreadMessageCount: 0
          });
          // 刷新消息列表
          this.loadUserMessages();
          wx.showToast({
            title: '已全部标记为已读',
            icon: 'success'
          });
        } else {
          console.log('❌ 标记失败:', res.result ? res.result.message : '未知错误');
          wx.showToast({
            title: '操作失败',
            icon: 'error'
          });
        }
      }.bind(this))
      .catch(function(err) {
        wx.hideLoading();
        console.error('标记所有消息已读失败:', err);
        wx.showToast({
          title: '网络错误',
          icon: 'error'
        });
      });
    },
    
    // 隐藏子抽屉
    hideSubDrawer() {
      this.setData({
        subDrawerVisible: false
      });
      
      // 延迟清除活跃子抽屉，以便动画完成
      setTimeout(() => {
        if (!this.data.subDrawerVisible) {
          this.setData({ activeSubDrawer: '' });
        }
      }, 300);
    },
    
    // 点击遮罩关闭抽屉
    onMaskTap() {
      // 如果子抽屉可见，则隐藏子抽屉，否则隐藏主抽屉
      if (this.data.subDrawerVisible) {
        this.hideSubDrawer();
      } else {
        this.hideDrawer();
      }
    },
    
    // 阻止冒泡
    stopPropagation(e) {
      // 阻止事件冒泡
      return false;
    },
    
    // 菜单项点击 - 防止意外关闭
    handleMenuItemTap(e) {
      // 不使用e.stopPropagation()，因为某些情况下可能不存在
      // 仅作为菜单点击处理函数，依靠外层的catchtap来阻止冒泡
      return;
    },
    
    // 退出登录
    logout() {
      wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            // 调用应用级别的退出登录方法
            const app = getApp();
            if (app.handleUserLogout) {
              app.handleUserLogout();
            } else {
              // 兼容旧版本
              wx.removeStorageSync('userInfo');
              wx.removeStorageSync('token');
            }
            
            this.triggerEvent('logout');
            this.hideDrawer();
            
            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            });
          }
        }
      });
    },

    // 重新触发无感登录
    openScanLogin() {
      // 关闭用户中心抽屉
      this.hideDrawer();
      
      // 显示加载提示
      wx.showLoading({
        title: '正在登录...',
        mask: true
      });
      
      // 使用新的登录流程
      const app = getApp();
      
      app.triggerLogin().then(loginResult => {
        wx.hideLoading();
        
        if (loginResult.success) {
          if (loginResult.needsUserInfo) {
            // 需要完善用户信息，提示用户
            wx.showToast({
              title: '请完善用户信息',
              icon: 'none',
              duration: 2000
            });
            
            // 关闭抽屉，让用户去主页完成授权
            this.triggerEvent('close');
          } else {
            // 登录成功
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
            
            // 触发登录成功事件
            this.triggerEvent('login', { userInfo: app.globalData.userInfo });
          }
        } else {
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('登录失败:', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      });
    },
    
    // ==================== 我的提名功能 ====================
    
    // 加载用户提名
    loadUserNominations() {
      console.log('=== 开始加载用户提名 ===');
      console.log('userInfo:', this.properties.userInfo);
      console.log('nominationsLoading:', this.data.nominationsLoading);
      
      if (!this.properties.userInfo || this.data.nominationsLoading) return;
      
      this.setData({ nominationsLoading: true });
      
      wx.cloud.callFunction({
        name: 'nominationManage',
        data: {
          action: 'getUserNominations'
        }
      })
      .then(function(res) {
        wx.hideLoading();
        console.log('加载提名结果:', res);
        if (res.result && res.result.success) {
          var nominations = res.result.data || [];
          
          // 格式化时间
          nominations.forEach(function(item) {
            item.formattedCreateTime = this.formatTime(item._createTime);
          }.bind(this));
          
          this.setData({
            nominations: nominations,
            nominationsLoading: false
          });
          console.log('✅ 提名加载成功，数量:', nominations.length);
        } else {
          console.log('❌ 提名加载失败:', res.result ? res.result.message : '未知错误');
          this.setData({ nominationsLoading: false });
        }
      }.bind(this))
      .catch(function(err) {
        wx.hideLoading();
        console.error('获取我的提名失败:', err);
        this.setData({ nominationsLoading: false });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }.bind(this));
    },
    
    // 刷新提名
    refreshNominations: function() {
      console.log('🔄 刷新提名按钮被点击');
      wx.showLoading({
        title: '刷新中...'
      });
      this.loadUserNominations();
    },
    
    // 查看提名详情
    viewNominationDetail(e) {
      const id = e.currentTarget.dataset.id;
      this.hideDrawer();
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}`
      });
    },
    
    // 编辑提名
    editNomination(e) {
      const id = e.currentTarget.dataset.id;
      wx.showToast({
        title: '编辑功能开发中',
        icon: 'none'
      });
    },
    
    // 删除提名
    deleteNomination(e) {
      const id = e.currentTarget.dataset.id;
      const name = e.currentTarget.dataset.name;
      
      wx.showModal({
        title: '确认删除',
        content: `确定要删除提名"${name}"吗？此操作不可撤销。`,
        success: (res) => {
          if (res.confirm) {
            this.performDeleteNomination(id);
          }
        }
      });
    },

    /**
     * 测试entry-card组件连通性
     */
    testEntryCard() {
      console.log('=== 测试entry-card组件连通性 ===');
      console.log('当前nominations数据:', this.data.nominations);
      console.log('nominations长度:', this.data.nominations.length);
      
      if (this.data.nominations.length > 0) {
        console.log('尝试查找entry-card组件...');
        // 使用微信小程序的方式查找组件
        const query = this.createSelectorQuery();
        query.select('.entry-card').boundingClientRect();
        query.exec((res) => {
          console.log('entry-card元素查询结果:', res);
        });
      } else {
        console.log('没有nominations数据，无法测试组件');
      }
    },

    // entry-card 组件事件处理
    onEntryUpdated(e) {
      const { entryId, entry } = e.detail;
      console.log('接收到条目更新事件:', { entryId, entry });
      
      // 更新本地列表中的对应项
      const nominations = this.data.nominations.map(item => {
        if (item._id === entryId) {
          const updatedItem = { ...item, ...entry };
          console.log('更新条目:', { 原始: item, 更新后: updatedItem });
          return updatedItem;
        }
        return item;
      });
      
      this.setData({
        nominations: nominations
      });
      console.log('nominations数组已更新');
      
      // 通知首页刷新数据，确保名字更改同步到首页和详情页
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      
      // 如果当前页面是首页并且有 refreshData 方法
      if (currentPage && currentPage.route === 'pages/index/index' && typeof currentPage.refreshData === 'function') {
        console.log('更新完成，刷新首页数据');
        currentPage.refreshData();
      }
      
      // 也可以通过全局数据更新，确保其他页面也能获取到最新数据
      const app = getApp();
      if (app && typeof app.refreshRankingData === 'function') {
        app.refreshRankingData();
      }
    },

    onEntryDeleted(e) {
      const { entryId } = e.detail;
      
      // 从本地列表中移除该项
      const nominations = this.data.nominations.filter(item => item._id !== entryId);
      
      this.setData({
        nominations: nominations
      });
      
      // 通知首页刷新数据，确保删除操作同步到首页
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      
      // 如果当前页面是首页并且有 refreshData 方法
      if (currentPage && currentPage.route === 'pages/index/index' && typeof currentPage.refreshData === 'function') {
        console.log('删除完成，刷新首页数据');
        currentPage.refreshData();
      }
      
      // 也可以通过全局数据更新，确保其他页面也能获取到最新数据
      const app = getApp();
      if (app && typeof app.refreshRankingData === 'function') {
        app.refreshRankingData();
      }
    },

    onEntryLongPress(e) {
      const { id } = e.detail;
      wx.showActionSheet({
        itemList: ['查看详情', '编辑', '分享', '删除'],
        success: (res) => {
          switch (res.tapIndex) {
            case 0:
              this.onEntryView(e);
              break;
            case 1:
              this.onEntryEdit(e);
              break;
            case 2:
              // 分享功能
              wx.showToast({ title: '分享功能待开发', icon: 'none' });
              break;
            case 3:
              this.onEntryDelete(e);
              break;
          }
        }
      });
    },

    // 下拉刷新提名列表
    onNominationsRefresh() {
      this.setData({ nominationsRefreshing: true });
      this.loadUserNominations().finally(() => {
        this.setData({ nominationsRefreshing: false });
      });
    },
    
    // 执行删除提名
    performDeleteNomination(id) {
      wx.showLoading({ title: '删除中...' });
      
      wx.cloud.callFunction({
        name: 'nominationManage',
        data: {
          action: 'deleteNomination',
          nominationId: id
        }
      })
      .then(res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          this.loadUserNominations(); // 重新加载列表
        } else {
          wx.showToast({
            title: res.result.message || '删除失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('删除提名失败:', err);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      });
    },
    
    // 跳转到创建页面
    goToCreate() {
      this.hideDrawer();
      wx.navigateTo({
        url: '/pages/create/create'
      });
    },
    
    // ==================== 我的消息功能 ====================
    
    // 加载用户消息
    loadUserMessages() {
      if (!this.properties.userInfo || this.data.messagesLoading) return;
      
      this.setData({ messagesLoading: true });
      
      wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'getUserMessages',
          messageType: this.data.activeMessageTab
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          const messages = res.result.data || [];
          // 格式化时间
          messages.forEach(item => {
            item.formattedTime = this.formatTime(item._createTime);
          });
          
          this.setData({
            messages: messages,
            messageCounts: res.result.counts || { all: 0, comment: 0, vote: 0 },
            messagesLoading: false
          });
        } else {
          this.setData({ messagesLoading: false });
        }
      })
      .catch(err => {
        console.error('获取我的消息失败:', err);
        this.setData({ messagesLoading: false });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
    },
    
    // 切换消息分类
    switchMessageTab(e) {
      const tab = e.currentTarget.dataset.tab;
      this.setData({ activeMessageTab: tab });
      this.loadUserMessages();
    },
    
    // 回复消息
    replyMessage(e) {
      const id = e.currentTarget.dataset.id;
      wx.showToast({
        title: '回复功能开发中',
        icon: 'none'
      });
    },
    
    // 删除消息
    deleteMessage(e) {
      const id = e.currentTarget.dataset.id;
      
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条消息吗？',
        success: (res) => {
          if (res.confirm) {
            this.performDeleteMessage(id);
          }
        }
      });
    },
    
    // 执行删除消息
    performDeleteMessage(id) {
      wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'deleteMessage',
          messageId: id
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          this.loadUserMessages(); // 重新加载列表
        } else {
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('删除消息失败:', err);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      });
    },
    
    // ==================== 我的音效功能 ====================
    
    // 初始化录音管理器
    initRecorderManager() {
      if (!this.data.recorderManager) {
        const recorderManager = wx.getRecorderManager();
        
        recorderManager.onStart(() => {
          console.log('录音开始');
          this.startRecordTimer();
        });
        
        recorderManager.onStop((res) => {
          console.log('录音结束', res);
          this.stopRecordTimer();
          this.setData({
            recordingState: 'recorded',
            tempFilePath: res.tempFilePath
          });
        });
        
        recorderManager.onError((err) => {
          console.error('录音出错', err);
          this.stopRecordTimer();
          this.setData({ recordingState: 'idle' });
          wx.showToast({
            title: '录音失败',
            icon: 'none'
          });
        });
        
        this.setData({ recorderManager });
      }
    },
    
    // 初始化音频播放器
    initAudioPlayer() {
      if (!this.data.innerAudioContext) {
        const innerAudioContext = wx.createInnerAudioContext();
        this.setData({ innerAudioContext });
      }
    },
    
    // 加载用户音效
    loadUserSounds() {
      if (!this.properties.userInfo || this.data.soundsLoading) return;
      
      this.setData({ soundsLoading: true });
      
      wx.cloud.callFunction({
        name: 'soundManage',
        data: {
          action: 'getUserSounds'
        }
      })
      .then(function(res) {
        wx.hideLoading();
        console.log('加载音效结果:', res);
        if (res.result && res.result.success) {
          var sounds = res.result.data || [];
          // 格式化时间和时长
          sounds.forEach(function(item) {
            item.formattedCreateTime = this.formatTime(item._createTime);
            item.formattedDuration = (item.duration || 0).toFixed(1);
          }.bind(this));
          
          this.setData({
            userSounds: sounds,
            soundsLoading: false
          });
          console.log('✅ 音效加载成功，数量:', sounds.length);
        } else {
          console.log('❌ 音效加载失败:', res.result ? res.result.message : '未知错误');
          this.setData({ soundsLoading: false });
        }
      }.bind(this))
      .catch(function(err) {
        wx.hideLoading();
        console.error('获取音效库失败:', err);
        this.setData({ soundsLoading: false });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }.bind(this));
      
      // 同时加载当前音效设置
      this.loadSoundSettings();
    },
    
    // 加载音效设置
    loadSoundSettings() {
      const soundEnabled = wx.getStorageSync('soundEnabled') || false;
      const currentSoundUrl = wx.getStorageSync('currentSoundUrl') || '';
      const currentSoundName = wx.getStorageSync('currentSoundName') || '';
      
      this.setData({
        soundEnabled,
        currentSoundUrl,
        currentSoundName
      });
    },
    
    // 刷新音效
    refreshSounds: function() {
      console.log('🔄 刷新音效按钮被点击');
      wx.showLoading({
        title: '刷新中...'
      });
      this.loadUserSounds();
    },
    
    // 切换音效启用状态
    toggleSoundEnabled(e) {
      const enabled = e.detail.value;
      this.setData({ soundEnabled: enabled });
      wx.setStorageSync('soundEnabled', enabled);
    },
    
    // 预览当前音效
    previewCurrentSound() {
      if (!this.data.currentSoundUrl) return;
      
      this.data.innerAudioContext.src = this.data.currentSoundUrl;
      this.data.innerAudioContext.play();
    },
    
    // 开始录音
    startRecording() {
      this.initRecorderManager();
      
      this.setData({
        recordingState: 'recording',
        recordTime: 0,
        formattedRecordTime: '00:00'
      });
      
      this.data.recorderManager.start({
        format: 'mp3',
        sampleRate: 44100
      });
    },
    
    // 停止录音
    stopRecording() {
      this.data.recorderManager.stop();
    },
    
    // 开始录音计时
    startRecordTimer() {
      this.data.recordTimer = setInterval(() => {
        const recordTime = this.data.recordTime + 1;
        this.setData({
          recordTime,
          formattedRecordTime: this.formatDuration(recordTime)
        });
      }, 1000);
    },
    
    // 停止录音计时
    stopRecordTimer() {
      if (this.data.recordTimer) {
        clearInterval(this.data.recordTimer);
        this.setData({ recordTimer: null });
      }
    },
    
    // 播放录音
    playRecording() {
      if (!this.data.tempFilePath) return;
      
      this.initAudioPlayer();
      this.data.innerAudioContext.src = this.data.tempFilePath;
      this.data.innerAudioContext.play();
    },
    
    // 保存录音
    saveRecording() {
      if (!this.data.tempFilePath) return;
      
      wx.showLoading({ title: '保存中...' });
      
      // 上传音效文件
      wx.cloud.uploadFile({
        cloudPath: `sounds/${Date.now()}.mp3`,
        filePath: this.data.tempFilePath
      })
      .then(uploadRes => {
        // 保存音效记录
        return wx.cloud.callFunction({
          name: 'soundManage',
          data: {
            action: 'saveSoundRecord',
            fileId: uploadRes.fileID,
            duration: this.data.recordTime,
            name: '投票音效'
          }
        });
      })
      .then(res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          this.setData({ recordingState: 'idle' });
          this.loadUserSounds(); // 重新加载音效库
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('保存音效失败:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      });
    },
    
    // 取消录音
    cancelRecording() {
      this.setData({
        recordingState: 'idle',
        tempFilePath: '',
        recordTime: 0,
        formattedRecordTime: '00:00'
      });
    },
    
    // 切换音效库显示
    toggleSoundsLibrary() {
      this.setData({
        showSoundsLibrary: !this.data.showSoundsLibrary
      });
    },
    
    // 预览用户音效
    previewUserSound(e) {
      const fileId = e.currentTarget.dataset.fileId;
      if (!fileId) return;
      
      // 下载并播放
      wx.cloud.downloadFile({
        fileID: fileId
      })
      .then(res => {
        this.initAudioPlayer();
        this.data.innerAudioContext.src = res.tempFilePath;
        this.data.innerAudioContext.play();
      })
      .catch(err => {
        console.error('预览音效失败:', err);
        wx.showToast({
          title: '预览失败',
          icon: 'none'
        });
      });
    },
    
    // 应用用户音效
    applyUserSound(e) {
      const fileId = e.currentTarget.dataset.fileId;
      const name = e.currentTarget.dataset.name;
      
      // 下载音效文件到本地
      wx.cloud.downloadFile({
        fileID: fileId
      })
      .then(res => {
        this.setData({
          currentSoundUrl: res.tempFilePath,
          currentSoundName: name
        });
        
        // 保存到本地存储
        wx.setStorageSync('currentSoundUrl', res.tempFilePath);
        wx.setStorageSync('currentSoundName', name);
        
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('应用音效失败:', err);
        wx.showToast({
          title: '设置失败',
          icon: 'none'
        });
      });
    },
    
    // 删除用户音效
    deleteUserSound(e) {
      const soundId = e.currentTarget.dataset.soundId;
      const name = e.currentTarget.dataset.name;
      
      wx.showModal({
        title: '确认删除',
        content: `确定要删除音效"${name}"吗？`,
        success: (res) => {
          if (res.confirm) {
            this.performDeleteUserSound(soundId);
          }
        }
      });
    },
    
    // 执行删除音效
    performDeleteUserSound(soundId) {
      wx.cloud.callFunction({
        name: 'soundManage',
        data: {
          action: 'deleteSound',
          soundId: soundId
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          this.loadUserSounds(); // 重新加载音效库
        } else {
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('删除音效失败:', err);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      });
    },
    
    // ==================== 工具方法 ====================
    
    // 格式化时间
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) { // 1分钟内
        return '刚刚';
      } else if (diff < 3600000) { // 1小时内
        return `${Math.floor(diff / 60000)}分钟前`;
      } else if (diff < 86400000) { // 1天内
        return `${Math.floor(diff / 3600000)}小时前`;
      } else {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      }
    },
    
    // 格式化时长
    formatDuration(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

  }
}) 