// components/auth-dialog/auth-dialog.js
const app = getApp();

Component({
  data: {
    show: false,
    avatarUrl: '',
    nickname: '',
    callbacks: {},
    isSaving: false // 用于防止重复提交
  },
  methods: {
    preventBubble: function() {
      // 阻止事件冒泡
    },
    showDialog(callbacks = {}) {
      this.setData({
        show: true,
        avatarUrl: '',
        nickname: '',
        callbacks: callbacks
      });
    },

    hideDialog() {
      this.setData({ show: false });
    },

    preventClose() {
      // 阻止点击遮罩关闭
    },
    
    onChooseAvatar(e) {
      if (this.data.isSaving) return;
      const { avatarUrl } = e.detail;
      this.setData({
        avatarUrl: avatarUrl,
        tempAvatarPath: avatarUrl
      });
    },

    onNicknameInput(e) {
      this.setData({
        nickname: e.detail.value
      });
    },

    async handleSaveAndLogin() {
      if (!this.data.tempAvatarPath || !this.data.nickname.trim()) {
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
          cloudPath: `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`,
          filePath: this.data.tempAvatarPath,
        });
        const fileID = uploadResult.fileID;

        // 调用云函数进行登录/注册
        const loginResult = await wx.cloud.callFunction({
          name: 'userManage',
          data: {
            action: 'login',
            userData: {
              nickname: this.data.nickname,
              avatarUrl: fileID // 使用云存储文件ID
            }
          }
        });

        if (loginResult.result.success) {
          wx.setStorageSync('userInfo', loginResult.result.user);
          app.globalData.userInfo = loginResult.result.user;
          this.hideDialog();
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });

          // 触发登录成功事件
          this.triggerEvent('loginsuccess');
        } else {
          throw new Error(loginResult.result.message);
        }
      } catch (err) {
        console.error('登录或上传失败', err);
        wx.showToast({
          title: err.message || '登录失败，请重试',
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
        this.setData({ isSaving: false });
      }
    }
  }
}); 