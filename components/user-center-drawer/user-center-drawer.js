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
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    visible: false,
    debugMessages: []
  },

  /**
   * 组件的生命周期函数
   */
  lifetimes: {
    attached() {
      // 组件被创建时执行
      console.log('用户中心抽屉组件已创建');
      this.debugLog('组件已创建');
    },
    ready() {
      // 组件挂载后执行
      console.log('用户中心抽屉组件已挂载');
      this.debugLog('组件已挂载');
      
      // 检查初始show属性值
      if (this.properties.show) {
        console.log('初始化时，show属性为true，显示抽屉');
        this.setData({ visible: true });
        this.debugLog('初始化时显示抽屉');
      }
    }
  },

  /**
   * 监听器
   */
  observers: {
    'show': function(show) {
      console.log('用户中心显示状态变更:', show);
      this.debugLog(`显示状态变更: ${show}`);
      
      if (show) {
        console.log('显示抽屉');
        this.setData({
          visible: true
        });
        this.debugLog('显示抽屉');
      } else {
        console.log('准备隐藏抽屉');
        // 确认当前是由父组件主动关闭，而不是内部事件触发的关闭
        if (!this._internalClosing) {
          this.hideDrawer();
        }
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 添加调试日志
    debugLog(message) {
      const timestamp = new Date().toLocaleTimeString();
      const debugMessages = this.data.debugMessages;
      debugMessages.push(`${timestamp}: ${message}`);
      if (debugMessages.length > 10) {
        debugMessages.shift(); // 只保留最近10条日志
      }
      this.setData({ debugMessages });
    },
    
    // 隐藏抽屉
    hideDrawer() {
      console.log('隐藏抽屉');
      this.debugLog('隐藏抽屉');
      
      // 设置内部关闭标志，防止观察者重复调用
      this._internalClosing = true;
      
      this.setData({
        visible: false
      });
      
      // 延迟关闭抽屉
      setTimeout(() => {
        this.triggerEvent('close');
        this.debugLog('触发close事件');
        
        // 重置内部关闭标志
        this._internalClosing = false;
      }, 300);
    },
    
    // 关闭抽屉
    onClose() {
      console.log('关闭按钮被点击');
      this.debugLog('关闭按钮被点击');
      this.hideDrawer();
    },
    
    // 点击遮罩关闭抽屉
    onMaskTap() {
      console.log('遮罩被点击');
      this.debugLog('遮罩被点击');
      this.hideDrawer();
    },
    
    // 阻止冒泡
    stopPropagation(e) {
      // 阻止事件冒泡
      this.debugLog('阻止事件冒泡');
      return false;
    },
    
    // 菜单项点击 - 防止意外关闭
    handleMenuItemTap(e) {
      // 阻止冒泡，确保不会触发其他事件
      e.stopPropagation();
    },
    
    // 跳转到个人主页
    navigateToProfile() {
      // 这里使用当前用户ID跳转到他的个人页面
      const userInfo = this.data.userInfo || {};
      const id = userInfo.id || '1';
      
      // 先关闭抽屉，防止冲突
      this.hideDrawer();
      
      // 延迟导航，确保抽屉动画已经开始
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/detail/detail?id=${id}`,
          success: () => {
            console.log('成功跳转到详情页');
            this.debugLog('成功跳转到详情页');
          },
          fail: (err) => {
            console.error('跳转失败', err);
            this.debugLog(`跳转失败: ${JSON.stringify(err)}`);
          }
        });
      }, 200);
    },
    
    // 跳转到订单页
    navigateToOrders() {
      this.hideDrawer();
      
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/orders/orders',
          success: () => this.debugLog('成功跳转到订单页'),
          fail: (err) => this.debugLog(`跳转失败: ${JSON.stringify(err)}`)
        });
      }, 200);
    },
    
    // 跳转到提名页
    navigateToNominations() {
      this.hideDrawer();
      
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/create/create',
          success: () => this.debugLog('成功跳转到提名页'),
          fail: (err) => this.debugLog(`跳转失败: ${JSON.stringify(err)}`)
        });
      }, 200);
    },
    
    // 跳转到投票记录
    navigateToVotes() {
      this.hideDrawer();
      
      setTimeout(() => {
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
      }, 200);
    },
    
    // 跳转到音效设置
    navigateToSoundSettings() {
      this.hideDrawer();
      
      setTimeout(() => {
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
      }, 200);
    },
    
    // 跳转到关于页
    navigateToAbout() {
      this.hideDrawer();
      
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/about/about',
          success: () => this.debugLog('成功跳转到关于页'),
          fail: (err) => this.debugLog(`跳转失败: ${JSON.stringify(err)}`)
        });
      }, 200);
    },
    
    // 退出登录
    logout() {
      wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            // 清除登录信息
            wx.removeStorageSync('userInfo');
            
            // 通知外部组件用户已退出
            this.triggerEvent('logout');
            
            // 关闭抽屉
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