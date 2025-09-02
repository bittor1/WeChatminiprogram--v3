// pages/create/create.js
const cloudUtils = require('../../utils/cloudUtils');

Page({
  data: {
    avatar: '',          // 最终确认的头像
    previewImage: '',    // 预览中的头像
    previewConfirmed: false, // 是否确认了预览
    nickname: '',
    currentMethod: '',    // 当前选择的上传方式: camera, album, video
    tempFilePath: '',     // 临时文件路径
    fileType: '',         // 文件类型: image, video
    isProcessing: false,  // 是否正在处理文件
    processingProgress: 0, // 处理进度
    showProgress: false,   // 是否显示进度条
    isFormValid: false,   // 表单是否有效
    cloudGifFileID: ''    // 云端GIF文件ID（视频转GIF后保存）
  },

  onLoad() {
    // 页面加载时的逻辑
    
    // 启用分享菜单（包括朋友圈）
    if (wx.canIUse('showShareMenu')) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
  },

  // 返回首页
  goBackToHome() {
    wx.switchTab({
      url: '/pages/index/index',
    })
  },

  // 选择上传方式
  selectMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      currentMethod: method
    });
  },

  // 上传头像
  uploadAvatar() {
    const method = this.data.currentMethod;
    if (!method) return;

    // 根据选择的方法调用对应的媒体处理函数
    switch (method) {
      case 'camera':
        this.takePhoto();
        break;
      case 'album':
        this.chooseFromAlbum();
        break;
      case 'video':
        this.recordVideo();
        break;
    }
  },

  // 拍照
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        console.log('拍照成功:', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        // 显示预览
        this.setData({
          previewImage: tempFilePath,
          tempFilePath: tempFilePath,
          fileType: 'image',
          previewConfirmed: false
        });
      },
      fail: (err) => {
        console.error('拍照失败:', err);
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        });
      }
    });
  },

  // 从相册选择
  chooseFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image', 'video'], // 支持图片和视频
      sourceType: ['album'],
      maxDuration: 15, // 最长15秒的视频
      camera: 'back',
      success: (res) => {
        console.log('从相册选择成功:', res);
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.tempFilePath;
        const fileType = res.type; // 'image' 或 'video'
        
        if (fileType === 'video') {
          // 显示视频第一帧作为预览
          this.setData({
            previewImage: tempFilePath,
            tempFilePath: tempFilePath,
            fileType: 'video',
            previewConfirmed: false
          });
          
          // 可以选择在这里预处理视频，例如显示时长等信息
          wx.showToast({
            title: '视频将转为GIF',
            icon: 'none'
          });
        } else {
          // 图片直接预览
          this.setData({
            previewImage: tempFilePath,
            tempFilePath: tempFilePath,
            fileType: 'image',
            previewConfirmed: false
          });
        }
      },
      fail: (err) => {
        console.error('从相册选择失败:', err);
        wx.showToast({
          title: '选择失败',
          icon: 'none'
        });
      }
    });
  },

  // 录制视频
  recordVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['camera'],
      maxDuration: 15, // 最长15秒
      camera: 'back',
      success: (res) => {
        console.log('视频录制成功:', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        // 显示视频第一帧作为预览
        this.setData({
          previewImage: tempFilePath,
          tempFilePath: tempFilePath,
          fileType: 'video',
          previewConfirmed: false
        });
        
        wx.showToast({
          title: '视频将转为GIF',
          icon: 'none'
        });
      },
      fail: (err) => {
        console.error('视频录制失败:', err);
        wx.showToast({
          title: '录制失败',
          icon: 'none'
        });
      }
    });
  },

  // 监听昵称输入
  onNicknameInput(e) {
    const nickname = e.detail.value;
    this.setData({
      nickname: nickname
    });
    
    // 检查表单状态
    this.checkFormValidity();
  },

  // 检查表单有效性
  checkFormValidity() {
    const { nickname, avatar } = this.data;
    const isValid = nickname && nickname.trim().length > 0 && avatar;
    
    this.setData({
      isFormValid: isValid
    });
    
    console.log('表单状态检查:', {
      nickname: nickname,
      avatar: avatar,
      isFormValid: isValid
    });
  },

  // 确认预览头像
  confirmPreview() {
    const { fileType, tempFilePath } = this.data;
    
    // 如果是视频，需要转换为GIF
    if (fileType === 'video') {
      this.processVideoToGif(tempFilePath);
    } else {
      // 图片直接确认
      this.setData({
        avatar: tempFilePath,
        previewConfirmed: true
      });
      
      // 检查表单状态
      this.checkFormValidity();
      
      wx.showToast({
        title: '头像已确认',
        icon: 'success'
      });
    }
  },

  // 处理视频转GIF
  processVideoToGif(videoPath) {
    // 显示加载状态
    this.setData({
      isProcessing: true,
      showProgress: true,
      processingProgress: 0
    });
    
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 模拟进度更新
    this.updateProgressInterval = setInterval(() => {
      if (this.data.processingProgress < 90) {
        const progress = this.data.processingProgress + Math.floor(Math.random() * 10) + 1;
        this.setData({
          processingProgress: Math.min(progress, 90)
        });
      }
    }, 500);
    
    // 上传视频到云存储
    const cloudPath = `videos/${Date.now()}.mp4`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: videoPath,
      success: (uploadRes) => {
        console.log('视频上传成功:', uploadRes);
        const fileID = uploadRes.fileID;
        
        // 验证fileID格式
        if (!fileID || !fileID.startsWith('cloud://')) {
          throw new Error('上传返回的文件ID格式无效');
        }
        
        // 调用云函数进行转换（使用优化参数提高处理速度）
        wx.cloud.callFunction({
          name: 'videoToGif',
          data: {
            fileID: fileID,
            width: 100,        // 极小尺寸，极速处理
            height: 0,         // 保持宽高比
            duration: 2,       // 最短时长2秒
            fps: 3             // 最低帧率3fps
          }
        })
        .then(res => {
          console.log('云函数返回结果:', res);
          
          if (!res.result || !res.result.success) {
            throw new Error(res.result?.message || '视频处理失败');
          }
          
          const gifFileID = res.result.fileID;
          if (!gifFileID) {
            throw new Error('未获取到GIF文件ID');
          }
          
          // 下载GIF到本地临时文件，同时传递gifFileID
          return wx.cloud.downloadFile({
            fileID: gifFileID
          }).then(downloadRes => ({
            gifFilePath: downloadRes.tempFilePath,
            gifFileID: gifFileID
          }));
        })
        .then(result => {
          const { gifFilePath, gifFileID } = result;
          
          // 清除进度更新定时器
          clearInterval(this.updateProgressInterval);
          
          // 更新头像 - 同时保存本地路径和云端ID
          this.setData({
            avatar: gifFilePath,           // 本地临时文件用于预览
            cloudGifFileID: gifFileID,     // 云端GIF文件ID用于提交
            previewImage: gifFilePath,
            previewConfirmed: true,
            isProcessing: false,
            processingProgress: 100,
            showProgress: false
          });
          
          // 检查表单状态
          this.checkFormValidity();
          
          wx.hideLoading();
          wx.showToast({
            title: 'GIF生成成功',
            icon: 'success'
          });
        })
        .catch(err => {
          console.error('处理失败:', err);
          this.handleProcessingError(err);
        });
      },
      fail: err => {
        console.error('视频上传失败:', err);
        this.handleProcessingError(err);
      }
    });
  },

  // 处理视频处理错误
  handleProcessingError(error) {
    // 清除进度更新定时器
    clearInterval(this.updateProgressInterval);
    
    // 重置状态
    this.setData({
      isProcessing: false,
      showProgress: false,
      processingProgress: 0
    });
    
    wx.hideLoading();
    
    let errorMessage = '视频处理失败';
    
    if (error && error.message) {
      if (error.message.includes('download') || error.message.includes('DOWNLOAD_FAILED')) {
        errorMessage = '视频文件下载失败，请重试';
      } else if (error.message.includes('ffmpeg') || error.message.includes('PROCESSING_FAILED')) {
        errorMessage = '视频处理失败，请选择其他视频';
      } else if (error.message.includes('upload') || error.message.includes('UPLOAD_FAILED')) {
        errorMessage = '文件上传失败，请检查网络';
      } else if (error.message.includes('INVALID_FILE_ID_FORMAT')) {
        errorMessage = '文件格式错误，请重新选择';
      } else if (error.message.includes('FFMPEG_NOT_FOUND')) {
        errorMessage = 'FFmpeg服务不可用，请联系管理员检查层配置';
      } else if (error.message.includes('FFmpeg')) {
        errorMessage = 'FFmpeg处理失败：' + error.message;
      }
    }
    
    // 如果是云函数返回的详细错误，显示更多信息
    console.error('详细错误信息:', error);
    
    wx.showModal({
      title: '处理失败',
      content: errorMessage,
      showCancel: false,
      confirmText: '知道了'
    });
    
    // 重置状态，允许用户重新选择
    this.setData({
      previewImage: '',
      tempFilePath: '',
      fileType: '',
      previewConfirmed: false
    });
  },

  // 取消预览
  cancelPreview() {
    this.setData({
      previewImage: '',
      currentMethod: '',
      tempFilePath: '',
      fileType: ''
    });
  },
  
  // 移除头像
  removeAvatar() {
    this.setData({
      avatar: '',
      previewImage: '',
      previewConfirmed: false,
      tempFilePath: '',
      fileType: ''
    });
  },

  // 提交表单
  handleSubmit() {
    console.log('提交按钮被点击');
    console.log('当前数据状态:', {
      nickname: this.data.nickname,
      avatar: this.data.avatar,
      previewConfirmed: this.data.previewConfirmed
    });

    if (!this.data.nickname || this.data.nickname.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (!this.data.avatar) {
      wx.showToast({
        title: '请上传头像',
        icon: 'none'
      });
      return;
    }

    // 提交表单，上传到云存储
    wx.showLoading({
      title: '提交中...',
      mask: true
    });
    
    console.log('开始处理头像上传:', {
      avatar: this.data.avatar,
      cloudGifFileID: this.data.cloudGifFileID,
      fileType: this.data.fileType
    });
    
    // 如果已经有云端GIF文件ID（视频转GIF的情况），直接使用
    if (this.data.cloudGifFileID && this.data.fileType === 'video') {
      console.log('使用已生成的GIF文件:', this.data.cloudGifFileID);
      this.saveNominationData(this.data.cloudGifFileID, true);
      return;
    }
    
    // 否则上传头像到云存储（图片的情况）
    const avatarCloudPath = `avatars/${Date.now()}.${this.data.fileType === 'video' ? 'gif' : 'png'}`;
    
    wx.cloud.uploadFile({
      cloudPath: avatarCloudPath,
      filePath: this.data.avatar,
      success: res => {
        const fileID = res.fileID;
        console.log('头像上传成功:', fileID);
        this.saveNominationData(fileID, this.data.fileType === 'video');
      },
      fail: err => {
        console.error('头像上传失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '头像上传失败',
          icon: 'none'
        });
      }
    });
  },

  // 保存提名数据到数据库
  saveNominationData(avatarFileID, isGif) {
    const currentUser = wx.getStorageSync('userInfo') || {};
    const app = getApp();
    
    // 调试信息：检查用户状态
    console.log('用户登录状态调试:', {
      isLoggedIn: app.globalData.isLoggedIn,
      storageUserInfo: currentUser,
      globalUserInfo: app.globalData.userInfo,
      token: wx.getStorageSync('token')
    });
    
    // 保存数据到数据库
    wx.cloud.callFunction({
      name: 'nominationManage',
      data: {
        action: 'createNomination',
        nominationData: {
          name: this.data.nickname,
          avatarUrl: avatarFileID,
          isGif: isGif,
          votes: 0,
          trend: 'stable',
          hotLevel: 1,
          creatorId: currentUser.id || 'current_user',
          createdAt: wx.cloud.database().serverDate(),
          _createTime: new Date().getTime()
        }
      }
    })
    .then(res => {
      console.log('数据保存成功:', res);
      
      if (!res.result || !res.result.success) {
        throw new Error(res.result ? res.result.message : '保存失败');
      }
      
      // 刷新首页数据
      getApp().refreshRankingData();
      
      wx.hideLoading();
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
      
      // 延迟后返回首页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }, 1500);
    })
    .catch(err => {
      console.error('保存数据失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    });
  },

  // 分享到好友
  onShareAppMessage() {
    // 构建更吸引人的分享标题
    const title = '快来提名你心目中的伦敦必吃人物！';
    const path = '/pages/create/create';
    
    return {
      title: title,
      path: path,
      imageUrl: '/placeholder.jpg' // 使用项目中的默认图片
    };
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    // 为朋友圈创建吸引人的标题
    const title = '伦敦必吃榜 - 快来提名你心目中的人气王！';
    
    return {
      title: title,
      query: '',
      imageUrl: '/placeholder.jpg' // 使用项目中的默认图片
    };
  },

  // 组件销毁时清除定时器
  onUnload() {
    if (this.updateProgressInterval) {
      clearInterval(this.updateProgressInterval);
    }
  }
})