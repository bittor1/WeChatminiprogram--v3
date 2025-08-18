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
   * 组件的初始数据
   */
  data: {
    visible: false,
    activeSubDrawer: '', // 当前活跃的子抽屉: orders, nominations, messages, sounds, about
    subDrawerVisible: false, // 子抽屉是否可见
    unreadMessageCount: 0, // 未读消息数量
    userStatistics: null, // 用户统计数据
    isLoading: false
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
        
        // 如果是消息子抽屉，标记所有消息为已读
        if (action === 'messages' && this.data.unreadMessageCount > 0) {
          this.markAllMessagesAsRead();
        }
      }, 50);
    },
    
    // 标记所有消息为已读
    markAllMessagesAsRead() {
      if (this.data.unreadMessageCount === 0) return;
      
      wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'markAllAsRead'
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          this.setData({
            unreadMessageCount: 0
          });
        }
      })
      .catch(err => {
        console.error('标记所有消息已读失败:', err);
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
            wx.removeStorageSync('userInfo');
            this.triggerEvent('logout');
            this.hideDrawer();
            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            });
          }
        }
      });
    }
  }
}) 