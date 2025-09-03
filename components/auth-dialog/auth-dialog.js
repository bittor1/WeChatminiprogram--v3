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
    isSaving: false,
    retryCount: 0,
    showRetryTip: false
  },
  
  methods: {
    // 选择头像 - 使用新的chooseAvatar接口
    onChooseAvatar(e) {
      console.log('=== 头像选择事件 ===');
      console.log('事件详情:', e.detail);
      
      const { avatarUrl } = e.detail;
      console.log('选择的头像路径:', avatarUrl);
      console.log('头像路径类型:', typeof avatarUrl);
      console.log('头像路径长度:', avatarUrl ? avatarUrl.length : 0);
      
      if (!avatarUrl || avatarUrl.trim() === '') {
        console.error('❌ 头像路径为空');
        wx.showToast({
          title: '头像选择失败，请重试',
          icon: 'none'
        });
        return;
      }
      
      this.setData({
        avatarUrl
      }, () => {
        console.log('✅ 头像状态已更新:', this.data.avatarUrl);
        console.log('当前昵称状态:', this.data.nickname);
        console.log('按钮启用状态:', this.isFormValid());
      });
    },
    
    // 输入昵称 - 支持type="nickname"的快速选择
    onNicknameInput(e) {
      const nickname = e.detail.value;
      console.log('=== 昵称输入事件 ===');
      console.log('输入的昵称:', nickname);
      console.log('昵称长度:', nickname ? nickname.length : 0);
      
      this.setData({
        nickname: nickname
      }, () => {
        console.log('✅ 昵称状态已更新:', this.data.nickname);
        console.log('当前头像状态:', this.data.avatarUrl);
        console.log('按钮启用状态:', this.isFormValid());
      });
    },

    // 检查表单是否有效
    isFormValid() {
      const hasAvatar = !!(this.data.avatarUrl && this.data.avatarUrl.trim());
      const hasNickname = !!(this.data.nickname && this.data.nickname.trim());
      const isValid = hasAvatar && hasNickname && !this.data.isSaving;
      
      console.log('表单验证结果:');
      console.log('- 头像是否有效:', hasAvatar, '(', this.data.avatarUrl, ')');
      console.log('- 昵称是否有效:', hasNickname, '(', this.data.nickname, ')');
      console.log('- 是否正在保存:', this.data.isSaving);
      console.log('- 最终验证结果:', isValid);
      
      return isValid;
    },

    // 获取验证错误信息
    getValidationError() {
      if (!this.data.avatarUrl || !this.data.avatarUrl.trim()) {
        return '请选择头像';
      }
      if (!this.data.nickname || !this.data.nickname.trim()) {
        return '请输入昵称';
      }
      if (this.data.isSaving) {
        return '正在处理中，请稍候';
      }
      return '请完善用户信息';
    },

    // 确认登录
    async handleConfirm() {
      console.log('=== 确认登录事件 ===');
      console.log('当前表单状态:', {
        avatarUrl: this.data.avatarUrl,
        nickname: this.data.nickname,
        isSaving: this.data.isSaving
      });
      
      if (!this.isFormValid()) {
        console.error('❌ 表单验证失败');
        const errorMsg = this.getValidationError();
        wx.showToast({
          title: errorMsg,
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
        console.log('📤 开始上传头像到云存储...');
        console.log('头像文件路径:', this.data.avatarUrl);
        
        // 1. 上传头像到云存储
        console.log('📤 准备上传文件，路径检查:', this.data.avatarUrl);
        
        // 检查临时文件路径是否有效
        console.log('🔍 临时文件路径格式检查:', {
          avatarUrl: this.data.avatarUrl,
          type: typeof this.data.avatarUrl,
          length: this.data.avatarUrl ? this.data.avatarUrl.length : 0,
          startsWithWxfile: this.data.avatarUrl ? this.data.avatarUrl.startsWith('wxfile://') : false,
          startsWithTmp: this.data.avatarUrl ? this.data.avatarUrl.includes('tmp') : false
        });
        
        if (!this.data.avatarUrl || this.data.avatarUrl.trim() === '') {
          throw new Error('头像临时文件路径为空，请重新选择头像');
        }
        
        // 验证临时文件路径格式（支持多种格式）
        const isValidTempPath = this.data.avatarUrl.startsWith('wxfile://') || 
                               this.data.avatarUrl.startsWith('http://tmp/') ||
                               this.data.avatarUrl.includes('tmp');
        
        if (!isValidTempPath) {
          console.error('❌ 临时文件路径格式异常:', this.data.avatarUrl);
          throw new Error('头像临时文件路径格式异常，请重新选择头像');
        }
        
        console.log('✅ 临时文件路径验证通过:', this.data.avatarUrl);
        
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`,
          filePath: this.data.avatarUrl
        });
        
        console.log('📤 头像上传结果:', uploadResult);
        const fileID = uploadResult.fileID;
        
        if (!fileID) {
          throw new Error('头像上传失败，未获取到文件ID');
        }
        
        console.log('✅ 头像上传成功，文件ID:', fileID);

        // 2. 调用云函数更新用户信息
        console.log('☁️ 开始调用云函数更新用户信息...');
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

        console.log('☁️ 云函数调用结果:', updateResult);

        if (updateResult.result && updateResult.result.success) {
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
        this.setData({ 
          retryCount: this.data.retryCount + 1,
          showRetryTip: this.data.retryCount >= 1
        });
        
        let errorMessage = '登录失败，请重试';
        
        // 根据错误类型提供更具体的提示
        if (err.message && err.message.includes('uploadFile')) {
          errorMessage = '头像上传失败，请检查网络后重试';
        } else if (err.message && err.message.includes('云函数')) {
          errorMessage = '用户信息保存失败，请重试';
        } else if (err.message && err.message.includes('ENOENT')) {
          errorMessage = '临时文件已失效，请重新选择头像';
          // 显示重试提示
          this.setData({ showRetryTip: true });
        } else if (err.message && err.message.includes('临时文件路径无效')) {
          errorMessage = '请重新选择头像';
          this.setData({ showRetryTip: true });
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 3000
        });
      } finally {
        wx.hideLoading();
        this.setData({ isSaving: false });
      }
    },

    // 重置头像选择（供用户手动重试）
    resetAvatar() {
      console.log('🔄 用户手动重置头像');
      this.setData({
        avatarUrl: '',
        showRetryTip: false
      });
      wx.showToast({
        title: '请重新选择头像',
        icon: 'none'
      });
    },

    // 隐藏对话框
    hideDialog() {
      this.setData({
        avatarUrl: '',
        nickname: '',
        isSaving: false,
        retryCount: 0,
        showRetryTip: false
      });
      this.triggerEvent('close');
    },

    // 阻止事件冒泡
    preventBubble() {
      // 阻止点击弹窗内容区域时关闭弹窗
    }
  }
}); 