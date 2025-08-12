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
    showProgress: false   // 是否显示进度条
  },

  onLoad() {
    // 页面加载时的逻辑
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
      processingProgress: 0,
      showProgress: true
    });
    
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 模拟进度更新
    this.updateProgressInterval = setInterval(() => {
      let progress = this.data.processingProgress;
      if (progress < 90) {
        progress += Math.floor(Math.random() * 10) + 1;
        this.setData({
          processingProgress: Math.min(progress, 90)
        });
      }
    }, 500);
    
    // 上传视频到云存储
    const cloudPath = `videos/${Date.now()}.mp4`;
    
    cloudUtils.uploadFileToCloud(videoPath, cloudPath)
      .then(fileID => {
        console.log('视频上传成功:', fileID);
        
        // 调用云函数进行转换
        return cloudUtils.convertVideoToGif(fileID, {
          width: 200,
          height: 200,
          duration: 5,
          fps: 10
        });
      })
      .then(gifFileID => {
        console.log('GIF转换成功:', gifFileID);
        // 下载GIF到本地临时文件
        return cloudUtils.downloadFileFromCloud(gifFileID);
      })
      .then(gifFilePath => {
        clearInterval(this.updateProgressInterval);
        
        // 更新头像
        this.setData({
          avatar: gifFilePath,
          previewImage: gifFilePath,
          previewConfirmed: true,
          isProcessing: false,
          processingProgress: 100,
          showProgress: false
        });
        
        wx.hideLoading();
        wx.showToast({
          title: 'GIF生成成功',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('处理失败:', err);
        this.handleProcessingError();
      });
  },

  // 处理错误
  handleProcessingError() {
    clearInterval(this.updateProgressInterval);
    
    this.setData({
      isProcessing: false,
      showProgress: false
    });
    
    wx.hideLoading();
    wx.showToast({
      title: '处理失败，请重试',
      icon: 'none'
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

  // 监听昵称输入
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  // 提交表单
  handleSubmit() {
    if (!this.data.nickname.trim()) {
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
    
    // 上传头像到云存储
    const avatarCloudPath = `avatars/${Date.now()}.${this.data.fileType === 'video' ? 'gif' : 'png'}`;
    
    cloudUtils.uploadFileToCloud(this.data.avatar, avatarCloudPath)
      .then(fileID => {
        console.log('头像上传成功:', fileID);
        
        // 保存数据到数据库
        return cloudUtils.saveNominationToDb({
          name: this.data.nickname,
          avatarUrl: fileID,
          isGif: this.data.fileType === 'video',
          votes: 0,
          trend: 'stable',
          hotLevel: 1,
          createdAt: wx.cloud.database().serverDate(),
          _createTime: new Date().getTime()
        });
      })
      .then(id => {
        console.log('数据保存成功:', id);
        
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
        console.error('提交失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        });
      });
  },

  // 组件销毁时清除定时器
  onUnload() {
    if (this.updateProgressInterval) {
      clearInterval(this.updateProgressInterval);
    }
  }
})