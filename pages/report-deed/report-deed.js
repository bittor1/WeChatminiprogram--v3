// pages/report-deed/report-deed.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    users: [],
    selectedUser: null,
    content: '',
    location: '',
    date: '',
    type: 'success', // 默认为成功事迹
    isFormValid: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 加载用户列表
    this.loadUsers();
    
    // 设置默认日期为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.setData({
      date: `${year}-${month}-${day}`
    });
    
    // 检查表单有效性
    this.checkFormValidity();
  },

  /**
   * 加载用户列表
   */
  loadUsers: function () {
    // 这里应该调用云函数获取用户列表
    // 为了演示，使用模拟数据
    const mockUsers = [
      { id: '1', name: '张三', avatar: 'https://placekitten.com/80/80' },
      { id: '2', name: '李四', avatar: 'https://placekitten.com/81/81' },
      { id: '3', name: '王五', avatar: 'https://placekitten.com/82/82' },
      { id: '4', name: '赵六', avatar: 'https://placekitten.com/83/83' }
    ];
    
    this.setData({
      users: mockUsers
    });
  },

  /**
   * 用户选择变更
   */
  onUserChange: function (e) {
    const index = e.detail.value;
    this.setData({
      selectedUser: this.data.users[index]
    });
    this.checkFormValidity();
  },

  /**
   * 内容输入变更
   */
  onContentInput: function (e) {
    this.setData({
      content: e.detail.value
    });
    this.checkFormValidity();
  },

  /**
   * 地点输入变更
   */
  onLocationInput: function (e) {
    this.setData({
      location: e.detail.value
    });
    this.checkFormValidity();
  },

  /**
   * 日期选择变更
   */
  onDateChange: function (e) {
    this.setData({
      date: e.detail.value
    });
    this.checkFormValidity();
  },

  /**
   * 类型选择变更
   */
  onTypeChange: function (e) {
    this.setData({
      type: e.detail.value
    });
    this.checkFormValidity();
  },

  /**
   * 检查表单有效性
   */
  checkFormValidity: function () {
    const { selectedUser, content, date } = this.data;
    const isValid = selectedUser && content.trim().length > 0 && date;
    
    this.setData({
      isFormValid: isValid
    });
  },

  /**
   * 取消按钮点击事件
   */
  onCancel: function () {
    wx.navigateBack();
  },

  /**
   * 提交按钮点击事件
   */
  onSubmit: function () {
    if (!this.data.isFormValid) return;
    
    // 显示加载提示
    wx.showLoading({
      title: '提交中...',
      mask: true
    });
    
    // 构建事迹数据
    const deedData = {
      userId: this.data.selectedUser.id,
      nickname: this.data.selectedUser.name,
      avatarUrl: this.data.selectedUser.avatar,
      content: this.data.content,
      location: this.data.location,
      date: this.data.date,
      type: this.data.type,
      createTime: new Date().getTime()
    };
    
    // 这里应该调用云函数保存事迹
    // 为了演示，使用setTimeout模拟网络请求
    setTimeout(() => {
      wx.hideLoading();
      
      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 2000
      });
      
      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1000);
  }
}) 