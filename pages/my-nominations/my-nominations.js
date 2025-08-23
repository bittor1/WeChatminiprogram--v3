// pages/my-nominations/my-nominations.js
Page({
  data: {
    loading: true,
    nominations: []
  },

  onLoad() {
    this.fetchNominations();
    
    // 启用分享菜单（包括朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShow() {
    if (!this.data.loading) {
      this.fetchNominations();
    }
  },

  async fetchNominations() {
    this.setData({ loading: true });
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      let list = [];
      if (wx.cloud) {
        const db = wx.cloud.database();
        // 以创建人或关联openid筛选
        const res = await db.collection('entries')
          .where({ creatorId: userInfo.id || '', _openid: db.command.exists(true) })
          .orderBy('_createTime', 'desc')
          .get();
        list = (res.data || []).filter(item => item.creatorId === userInfo.id);
      }
      this.setData({ nominations: list, loading: false });
    } catch (e) {
      console.error('获取我的提名失败', e);
      this.setData({ nominations: [], loading: false });
    }
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack();
  },

  goToCreate() {
    wx.navigateTo({ url: '/pages/create/create' });
  },

  // 分享到好友
  onShareAppMessage() {
    return {
      title: '看看我提名的伦敦必吃榜人物',
      path: '/pages/my-nominations/my-nominations',
      imageUrl: '/placeholder.jpg'
    };
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '看看我提名的伦敦必吃榜人物',
      query: '',
      imageUrl: '/placeholder.jpg'
    };
  }
}); 