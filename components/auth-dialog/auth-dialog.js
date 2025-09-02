// components/auth-dialog/auth-dialog.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },
  
  data: {
    avatarUrl: '',
    nickname: '',
    isSaving: false
  },
  
  methods: {
    // 选择头像 - 使用新的chooseAvatar接口
    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      console.log('选择头像:', avatarUrl);
      this.setData({
        avatarUrl
      });
    },
    
    // 输入昵称 - 支持type="nickname"的快速选择
    onNicknameInput(e) {
      this.setData({
        nickname: e.detail.value
      });
    },

    // 确认登录
    async handleConfirm() {
      if (!this.data.avatarUrl || !this.data.nickname.trim()) {
        wx.showToast({
          title: '请选择头像并输入昵称',
          icon: 'none'
        });
        return;
      }
      
      if (this.data.isSaving) return;
      this.setData({ isSaving: true });

      wx.showLoading({
        title: '正在登录...',
        mask: true
      });
      
      try {
        // 1. 上传头像到云存储
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`,
          filePath: this.data.avatarUrl
        });
        const fileID = uploadResult.fileID;

        // 2. 调用云函数更新用户信息
        const updateResult = await wx.cloud.callFunction({
          name: 'userManage',
          data: {
            action: 'updateUserInfo',
            userData: {
              nickname: this.data.nickname,
              avatarUrl: fileID,
              isInfoComplete: true
            }
          }
        });

        if (updateResult.result.success) {
          const updatedUserInfo = updateResult.result.user;
          
          // 保存更新后的用户信息
          wx.setStorageSync('userInfo', updatedUserInfo);
          
          // 更新应用全局数据
          const app = getApp();
          app.globalData.userInfo = updatedUserInfo;
          app.globalData.isLoggedIn = true;
          app.globalData.needsUserInfo = false;
          
          this.hideDialog();
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });

          // 触发登录成功事件
          this.triggerEvent('loginsuccess', { userInfo: updatedUserInfo });
        } else {
          throw new Error(updateResult.result.message || '登录失败');
        }
      } catch (err) {
        console.error('登录失败:', err);
        wx.showToast({
          title: err.message || '登录失败，请重试',
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
        this.setData({ isSaving: false });
      }
    },

    // 隐藏对话框
    hideDialog() {
      this.setData({
        avatarUrl: '',
        nickname: '',
        isSaving: false
      });
      this.triggerEvent('close');
    },

    // 阻止事件冒泡
    preventBubble() {
      // 阻止点击弹窗内容区域时关闭弹窗
    }
  }
}); 