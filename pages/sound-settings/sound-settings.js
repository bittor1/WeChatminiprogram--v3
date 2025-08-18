// pages/sound-settings/sound-settings.js
Page({
  data: {
    enabled: false,
    soundUrl: '',
    recordingState: 'idle', // idle, recording, recorded
    recordTime: 0,
    formattedRecordTime: '00:00',
    tempFilePath: '',
    tempDuration: 0,
    formattedTempDuration: '0',
  },

  onLoad() {
    this.loadSettings();
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // 【关键修正】将管理器实例作为页面直接属性
    this.recorderManager = null;
    this.recordTimer = null;
    this.innerAudioContext = null;

    this.initRecorder();
    this.initAudioPlayer();
  },

  onUnload() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
    }
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
    }
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager();

    this.recorderManager.onStart(() => {
      console.log('recorder start');
      this.setData({ recordingState: 'recording', recordTime: 0, formattedRecordTime: '00:00' });
      
      this.recordTimer = setInterval(() => {
        const newTime = this.data.recordTime + 1;
        this.setData({
          recordTime: newTime,
          formattedRecordTime: this.formatTime(newTime)
        });
      }, 1000);
    });

    this.recorderManager.onStop((res) => {
      console.log('recorder stop', res);
      clearInterval(this.recordTimer);
      if (res.duration < 1000) {
        wx.showToast({ title: '录音时间太短', icon: 'none' });
        this.setData({ recordingState: 'idle' });
        return;
      }
      this.setData({
        recordingState: 'recorded',
        tempFilePath: res.tempFilePath,
        tempDuration: res.duration,
        formattedTempDuration: (res.duration / 1000).toFixed(1)
      });
    });

    this.recorderManager.onError((res) => {
      console.error('recorder error', res);
      clearInterval(this.recordTimer);
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ recordingState: 'idle' });
    });
  },

  initAudioPlayer() {
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.onPlay(() => console.log('开始播放'));
    this.innerAudioContext.onError((res) => console.error('播放错误', res));
  },

  formatTime(seconds) {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    return `${min}:${sec}`;
  },

  async loadSettings() {
    try {
      if (!wx.cloud) return;
      const userInfo = wx.getStorageSync('userInfo') || {};
      const res = await wx.cloud.callFunction({
        name: 'soundManage',
        data: { action: 'getSoundSettings', userId: userInfo.id }
      });
      if (res.result && res.result.success) {
        const data = res.result.data || {};
        this.setData({ enabled: !!data.enabled, soundUrl: data.soundUrl || '' });
      }
    } catch (e) {
      console.error('获取音效设置失败', e);
    }
  },

  async toggleEnable(e) {
    const enabled = e.detail.value;
    this.setData({ enabled });
    try {
      await wx.cloud.callFunction({
        name: 'soundManage',
        data: { action: 'updateSoundSettings', settingData: { enabled, soundUrl: this.data.soundUrl } }
      });
    } catch (e) {
      console.error('更新音效开关失败', e);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  previewSound() {
    if (!this.data.soundUrl || this.data.recordingState !== 'idle') return;
    this.innerAudioContext.src = this.data.soundUrl;
    this.innerAudioContext.play();
  },

  playTempSound() {
    if (!this.data.tempFilePath) return;
    this.innerAudioContext.src = this.data.tempFilePath;
    this.innerAudioContext.play();
  },

  recordNew() {
    if (this.innerAudioContext) {
        this.innerAudioContext.stop();
    }

    wx.authorize({
      scope: 'scope.record',
      success: () => {
        const options = { duration: 60000, sampleRate: 44100, numberOfChannels: 1, encodeBitRate: 192000, format: 'mp3' };
        this.recorderManager.start(options);
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '录制投票音效需要您的录音权限',
          confirmText: '去授权',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  stopRecord() {
    this.recorderManager.stop();
  },

  async uploadAndSave() {
    if (!this.data.tempFilePath) {
      wx.showToast({ title: '没有录音文件', icon: 'none' });
      return;
    }
    const tempFilePath = this.data.tempFilePath;
    try {
      wx.showLoading({ title: '保存中...' });
      const userInfo = wx.getStorageSync('userInfo') || {};
      const uploadRes = await wx.cloud.uploadFile({ cloudPath: `sounds/${userInfo._id || 'unknown'}_${Date.now()}.mp3`, filePath: tempFilePath });
      const fileID = uploadRes.fileID;
      await wx.cloud.callFunction({
        name: 'soundManage',
        data: { action: 'updateSoundSettings', settingData: { enabled: true, soundUrl: fileID } }
      });
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ enabled: true, soundUrl: fileID, recordingState: 'idle' });
    } catch (e) {
      wx.hideLoading();
      console.error('上传音效失败', e);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  goBack() { 
    wx.navigateBack(); 
  },
 
  // 分享到好友
  onShareAppMessage() {
    return {
      title: '定制你的专属伦敦必吃榜音效',
      path: '/pages/sound-settings/sound-settings',
      imageUrl: '/public/placeholder.jpg'
    };
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '定制你的专属伦敦必吃榜音效',
      query: '',
      imageUrl: '/public/placeholder.jpg'
    };
  }
}); 