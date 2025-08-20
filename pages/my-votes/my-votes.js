// pages/my-votes/my-votes.js
Page({
  data: {
    messages: [],
    activeTab: 'all',
    currentPage: 1,
    pageSize: 15,
    hasMore: true,
    unreadCounts: {
      all: 0,
      comment: 0,
      vote: 0,
      system: 0
    }
  },
  
  onLoad() {
    this.loadMessages();
    this.getUnreadCounts();
    
    // 启用分享菜单（包括朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  
  onShow() {
    // 每次显示页面时更新未读数量
    this.getUnreadCounts();
  },
  
  // 加载消息列表
  async loadMessages(page = 1, append = false) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const result = await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'list',
          data: {
            page,
            pageSize: this.data.pageSize,
            type: this.data.activeTab === 'all' ? '' : this.data.activeTab
          }
        }
      });
      
      wx.hideLoading();
      
      if (result.result && result.result.success) {
        const { messages, total } = result.result;
        
        this.setData({
          messages: append ? [...this.data.messages, ...messages] : messages,
          hasMore: page * this.data.pageSize < total,
          currentPage: page
        });
      } else {
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载消息失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 获取未读消息数量
  async getUnreadCounts() {
    try {
      // 获取总未读数量
      const result = await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'getUnreadCount'
        }
      });
      
      if (result.result && result.result.success) {
        const allCount = result.result.count;
        
        // 获取各类型未读数量
        const types = ['comment', 'vote', 'system'];
        const counts = {};
        
        for (const type of types) {
          const typeResult = await wx.cloud.callFunction({
            name: 'messageManage',
            data: {
              action: 'list',
              data: { 
                type,
                status: 0,
                page: 1,
                pageSize: 1
              }
            }
          });
          
          if (typeResult.result && typeResult.result.success) {
            counts[type] = typeResult.result.total || 0;
          } else {
            counts[type] = 0;
          }
        }
        
        this.setData({
          unreadCounts: {
            all: allCount,
            comment: counts.comment || 0,
            vote: counts.vote || 0,
            system: counts.system || 0
          }
        });
      }
    } catch (error) {
      console.error('获取未读数量失败:', error);
    }
  },
  
  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) {
      this.setData({
        activeTab: tab,
        currentPage: 1,
        messages: [],
        hasMore: true
      });
      this.loadMessages();
    }
  },
  
  // 加载更多消息
  loadMoreMessages() {
    if (this.data.hasMore) {
      const nextPage = this.data.currentPage + 1;
      this.loadMessages(nextPage, true);
    }
  },
  
  // 标记所有消息为已读
  async markAllRead() {
    try {
      wx.showLoading({ title: '处理中...' });
      
      const result = await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'markAllRead'
        }
      });
      
      wx.hideLoading();
      
      if (result.result && result.result.success) {
        // 更新本地消息状态
        const messages = this.data.messages.map(msg => ({
          ...msg,
          status: 1
        }));
        
        this.setData({
          messages,
          unreadCounts: {
            all: 0,
            comment: 0,
            vote: 0,
            system: 0
          }
        });
        
        wx.showToast({
          title: '已全部标记为已读',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('标记全部已读失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 点击消息
  async onMessageTap(e) {
    const { id, related, nomination } = e.currentTarget.dataset;
    
    // 标记为已读
    try {
      await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'markRead',
          data: { messageId: id }
        }
      });
      
      // 更新本地消息状态
      const messages = [...this.data.messages];
      const targetIndex = messages.findIndex(msg => msg._id === id);
      if (targetIndex !== -1) {
        messages[targetIndex].status = 1;
        this.setData({ messages });
      }
      
      // 更新未读数量
      this.getUnreadCounts();
      
      // 如果有关联的提名，跳转到提名详情
      if (nomination) {
        wx.navigateTo({
          url: `/pages/detail/detail?id=${nomination}`
        });
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  },
  
  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) {
      return '刚刚';
    } else if (diff < 3600) {
      return Math.floor(diff / 60) + '分钟前';
    } else if (diff < 86400) {
      return Math.floor(diff / 3600) + '小时前';
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },
  
  goBack() { 
    wx.navigateBack(); 
  },
  
  // 分享到好友
  onShareAppMessage() {
    return {
      title: '查看我在伦敦必吃榜的活动',
      path: '/pages/my-votes/my-votes',
      imageUrl: '/placeholder.jpg'
    };
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '查看我在伦敦必吃榜的活动',
      query: '',
      imageUrl: '/placeholder.jpg'
    };
  }
}); 