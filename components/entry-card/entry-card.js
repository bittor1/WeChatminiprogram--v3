Component({
  /**
   * 组件的属性列表
   */
  properties: {
    entry: {
      type: Object,
      value: {}
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    isEditing: false,
    editName: '',
    editAvatarUrl: '',
    tempFilePath: '',
    fileType: '',
    convertedGifUrl: '' // 保存已转换的GIF URL
  },



  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 卡片点击 - 跳转到详情页
     */
    onCardTap(e) {
      const entryId = e.currentTarget.dataset.id;
      if (!entryId) {
        console.warn('Entry ID not found');
        return;
      }

      // 跳转到详情页
      wx.navigateTo({
        url: `/pages/detail/detail?id=${entryId}`,
        fail: (err) => {
          console.error('导航失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    },

    /**
     * 编辑按钮点击
     */
    onEditTap(e) {
      console.log('=== 编辑按钮被点击 ===');
      const entryId = e.currentTarget.dataset.id;
      if (!entryId) {
        console.warn('Entry ID not found for edit');
        return;
      }

      // 进入编辑模式
      this.setData({
        isEditing: true,
        editName: this.properties.entry.name || '',
        editAvatarUrl: this.properties.entry.avatarUrl || ''
      });
      console.log('进入编辑模式，当前数据:', this.data);
    },

    /**
     * 头像编辑点击
     */
    onAvatarEditTap(e) {
      console.log('=== 头像编辑被点击 ===');
      wx.chooseMedia({
        count: 1,
        mediaType: ['image', 'video'],
        sourceType: ['album'],
        maxDuration: 15,
        success: (res) => {
          console.log('=== 选择媒体成功 ===', res);
          const tempFile = res.tempFiles[0];
          const tempFilePath = tempFile.tempFilePath;
          const fileType = res.type;
          
          console.log('媒体信息:', { tempFilePath, fileType, tempFile });
          
          if (fileType === 'video') {
            // 视频选择后立即开始转GIF
            console.log('检测到视频，立即开始转GIF处理...');
            wx.showLoading({ title: '转换GIF中...' });
            
            // 先上传视频到云存储
            const cloudPath = `temp_videos/${Date.now()}.mp4`;
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: tempFilePath
            }).then(uploadRes => {
              console.log('临时视频上传成功:', uploadRes.fileID);
              
              // 调用视频转GIF云函数
              return wx.cloud.callFunction({
                name: 'videoToGif',
                data: {
                  fileID: uploadRes.fileID,
                  duration: 4,
                  fps: 30
                }
              });
            }).then(gifRes => {
              wx.hideLoading();
              console.log('视频转GIF完成:', gifRes.result);
              
              if (gifRes.result && gifRes.result.success) {
                const gifUrl = gifRes.result.fileID;
                console.log('GIF转换成功，显示预览:', gifUrl);
                
                this.setData({
                  editAvatarUrl: gifUrl,
                  tempFilePath: '', // 清空原视频路径
                  fileType: 'gif', // 标记为已转换的GIF
                  convertedGifUrl: gifUrl // 保存转换后的GIF URL
                });
                
                wx.showToast({
                  title: 'GIF转换完成',
                  icon: 'success'
                });
              } else {
                console.error('GIF转换失败:', gifRes.result);
                this.setData({
                  editAvatarUrl: tempFile.thumbTempFilePath || this.properties.entry.avatarUrl,
                  tempFilePath: tempFilePath,
                  fileType: fileType
                });
                wx.showToast({
                  title: 'GIF转换失败',
                  icon: 'none'
                });
              }
            }).catch(error => {
              wx.hideLoading();
              console.error('视频转GIF出错:', error);
              this.setData({
                editAvatarUrl: tempFile.thumbTempFilePath || this.properties.entry.avatarUrl,
                tempFilePath: tempFilePath,
                fileType: fileType
              });
              wx.showToast({
                title: '处理失败，请重试',
                icon: 'none'
              });
            });
          } else {
            // 图片直接设置
            this.setData({
              editAvatarUrl: tempFilePath,
              tempFilePath: tempFilePath,
              fileType: fileType
            });
          }
          
          console.log('设置数据后:', this.data);
        },
        fail: (err) => {
          console.error('选择媒体失败:', err);
          wx.showToast({
            title: '选择失败',
            icon: 'none'
          });
        }
      });
    },

    /**
     * 姓名输入
     */
    onNameInput(e) {
      this.setData({
        editName: e.detail.value
      });
    },

    /**
     * 保存编辑
     */
    onSaveTap(e) {
      console.log('onSaveTap被调用');
      const entryId = e.currentTarget.dataset.id;
      const editName = this.data.editName.trim();
      
      console.log('tempFilePath:', this.data.tempFilePath, 'fileType:', this.data.fileType);
      
      if (!editName) {
        wx.showToast({
          title: '请输入姓名',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({ title: '保存中...' });

      // 如果有新头像需要上传，或者有已转换的GIF
      if (this.data.tempFilePath || this.data.convertedGifUrl) {
        if (this.data.convertedGifUrl) {
          console.log('使用已转换的GIF:', this.data.convertedGifUrl);
          // 直接保存已转换的GIF
          this.saveEntry(entryId, editName, this.data.convertedGifUrl);
        } else {
          console.log('调用uploadAndSave');
          this.uploadAndSave(entryId, editName);
        }
      } else {
        console.log('调用saveEntry');
        // 只更新姓名
        this.saveEntry(entryId, editName, this.data.editAvatarUrl);
      }
    },

    /**
     * 取消编辑
     */
    onCancelTap(e) {
      this.setData({
        isEditing: false,
        editName: '',
        editAvatarUrl: '',
        tempFilePath: '',
        fileType: '',
        convertedGifUrl: ''
      });
    },

    /**
     * 上传头像并保存
     */
    uploadAndSave(entryId, name) {
      console.log('uploadAndSave开始，fileType:', this.data.fileType);
      const cloudPath = `avatars/${Date.now()}.${this.data.fileType === 'video' ? 'mp4' : 'jpg'}`;
      
      // 上传文件到云存储
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: this.data.tempFilePath
      })
      .then(uploadRes => {
        let avatarUrl = uploadRes.fileID;
        
        // 如果是视频，需要转换为GIF
        if (this.data.fileType === 'video') {
          console.log('视频上传成功，开始转GIF');
          return wx.cloud.callFunction({
            name: 'videoToGif',
            data: {
              fileID: uploadRes.fileID,
              duration: 4,
              fps: 30
            }
          }).then(gifRes => {
            console.log('视频转GIF结果:', gifRes.result);
            if (gifRes.result && gifRes.result.success) {
              avatarUrl = gifRes.result.fileID;
              console.log('GIF转换成功');
            } else {
              console.error('GIF转换失败');
            }
            return avatarUrl;
          });
        } else {
          return avatarUrl;
        }
      })
      .then(finalAvatarUrl => {
        this.saveEntry(entryId, name, finalAvatarUrl);
      })
      .catch(err => {
        wx.hideLoading();
        console.error('上传失败:', err);
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      });
    },

    /**
     * 保存条目信息
     */
    saveEntry(entryId, name, avatarUrl) {
      wx.cloud.callFunction({
        name: 'nominationManage',
        data: {
          action: 'updateNomination',
          nominationData: {
            _id: entryId,
            name: name,
            avatarUrl: avatarUrl
          }
        }
      })
      .then(res => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 更新本地数据
          const updatedEntry = {
            ...this.properties.entry,
            name: name,
            avatarUrl: avatarUrl
          };
          
                      // 退出编辑模式
            this.setData({
              isEditing: false,
              editName: '',
              editAvatarUrl: '',
              tempFilePath: '',
              fileType: '',
              convertedGifUrl: ''
            });
          
          // 通知父组件更新
          this.triggerEvent('updated', {
            entryId: entryId,
            entry: updatedEntry
          });
        } else {
          wx.showToast({
            title: res.result.message || '保存失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('保存失败:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      });
    },

    /**
     * 防止卡片点击事件（操作区域点击不应该跳转）
     */
    preventCardTap(e) {
      // 什么都不做，只是阻止事件冒泡
      return false;
    },

    /**
     * 测试方法 - 可以在控制台调用
     */
    testComponent() {
      console.log('=== 组件测试 ===');
      console.log('当前数据:', this.data);
      console.log('entry属性:', this.properties.entry);
      console.log('isEditing:', this.data.isEditing);
      console.log('tempFilePath:', this.data.tempFilePath);
      console.log('fileType:', this.data.fileType);
      wx.showToast({
        title: '组件测试成功',
        icon: 'success'
      });
    },

    /**
     * 删除按钮点击
     */
    onDeleteTap(e) {
      const entryId = e.currentTarget.dataset.id;
      if (!entryId) {
        console.warn('Entry ID not found for delete');
        return;
      }

      // 显示确认对话框
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这个提名吗？删除后无法恢复。',
        confirmText: '删除',
        confirmColor: '#F56565',
        success: (res) => {
          if (res.confirm) {
            this.performDelete(entryId);
          }
        }
      });
    },

    /**
     * 执行删除操作
     */
    performDelete(entryId) {
      wx.showLoading({ title: '删除中...' });
      
      wx.cloud.callFunction({
        name: 'nominationManage',
        data: {
          action: 'deleteNomination',
          nominationId: entryId
        }
      })
      .then(res => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          
          // 触发父组件的删除事件，用于刷新列表
          this.triggerEvent('deleted', {
            entryId: entryId,
            entry: this.properties.entry
          });
        } else {
          wx.showToast({
            title: res.result.message || '删除失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('删除失败:', err);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      });
    }
  }
});