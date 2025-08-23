# 快速开发方案 - uni-app + uView UI

## 1. 快速初始化项目（5分钟）

```bash
# 使用 HBuilderX（推荐）或命令行
npm install -g @vue/cli
vue create -p dcloudio/uni-preset-vue london-food-rank

# 安装 uView UI
npm install uview-ui
```

## 2. 主要页面代码示例

### 首页 - 排行榜（pages/index/index.vue）
```vue
<template>
  <view class="container">
    <!-- 搜索栏 -->
    <u-search 
      v-model="keyword" 
      placeholder="搜索餐厅名称"
      @search="handleSearch"
    ></u-search>
    
    <!-- 统计卡片 -->
    <view class="stats-card">
      <u-row>
        <u-col span="4">
          <view class="stat-item">
            <text class="stat-num">{{ stats.total }}</text>
            <text class="stat-label">总餐厅</text>
          </view>
        </u-col>
        <u-col span="4">
          <view class="stat-item">
            <text class="stat-num">{{ stats.votes }}</text>
            <text class="stat-label">总票数</text>
          </view>
        </u-col>
        <u-col span="4">
          <view class="stat-item">
            <text class="stat-num">{{ stats.users }}</text>
            <text class="stat-label">参与人数</text>
          </view>
        </u-col>
      </u-row>
    </view>
    
    <!-- 排行榜列表 -->
    <u-list @scrolltolower="loadMore">
      <u-list-item v-for="(item, index) in list" :key="item._id">
        <u-cell-group>
          <u-cell @click="goDetail(item)">
            <view slot="title" class="restaurant-item">
              <text class="rank">{{ index + 1 }}</text>
              <u-avatar :src="item.avatar" size="40"></u-avatar>
              <view class="info">
                <text class="name">{{ item.name }}</text>
                <text class="votes">{{ item.votes }} 票</text>
              </view>
              <u-button 
                type="primary" 
                size="mini"
                @click.stop="handleVote(item)"
              >
                投票
              </u-button>
            </view>
          </u-cell>
        </u-cell-group>
      </u-list-item>
    </u-list>
    
    <!-- 悬浮按钮 -->
    <u-fixed bottom="100" right="30">
      <u-button 
        type="primary" 
        shape="circle"
        icon="plus"
        @click="goCreate"
      ></u-button>
    </u-fixed>
  </view>
</template>

<script>
export default {
  data() {
    return {
      keyword: '',
      list: [],
      stats: {
        total: 0,
        votes: 0,
        users: 0
      }
    }
  },
  
  onLoad() {
    this.loadData()
  },
  
  methods: {
    // 加载数据
    async loadData() {
      const db = wx.cloud.database()
      const res = await db.collection('entries')
        .orderBy('votes', 'desc')
        .get()
      
      this.list = res.data
    },
    
    // 投票
    async handleVote(item) {
      // 检查登录
      if (!this.checkLogin()) return
      
      // 调用云函数
      wx.cloud.callFunction({
        name: 'voteManage',
        data: {
          action: 'vote',
          entryId: item._id
        }
      }).then(res => {
        if (res.result.success) {
          item.votes++
          this.$u.toast('投票成功')
        } else {
          this.$u.toast(res.result.message)
        }
      })
    },
    
    // 跳转详情
    goDetail(item) {
      uni.navigateTo({
        url: `/pages/detail/detail?id=${item._id}`
      })
    },
    
    // 创建提名
    goCreate() {
      if (!this.checkLogin()) return
      uni.navigateTo({
        url: '/pages/create/create'
      })
    },
    
    // 检查登录
    checkLogin() {
      const userInfo = uni.getStorageSync('userInfo')
      if (!userInfo) {
        this.$u.toast('请先登录')
        return false
      }
      return true
    }
  }
}
</script>

<style lang="scss">
.container {
  padding: 20rpx;
}

.stats-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin: 20rpx 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  
  .stat-item {
    text-align: center;
    
    .stat-num {
      display: block;
      font-size: 48rpx;
      font-weight: bold;
      color: #ff6b6b;
    }
    
    .stat-label {
      display: block;
      font-size: 24rpx;
      color: #666;
      margin-top: 10rpx;
    }
  }
}

.restaurant-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  
  .rank {
    font-size: 36rpx;
    font-weight: bold;
    color: #ff6b6b;
    margin-right: 20rpx;
    min-width: 60rpx;
  }
  
  .info {
    flex: 1;
    margin-left: 20rpx;
    
    .name {
      display: block;
      font-size: 32rpx;
      font-weight: 500;
    }
    
    .votes {
      display: block;
      font-size: 24rpx;
      color: #666;
      margin-top: 8rpx;
    }
  }
}
</style>
```

## 3. 关键优势

### 开发效率提升点：
1. **组件开箱即用**：搜索框、列表、按钮、头像等直接使用
2. **样式统一**：uView 提供统一的设计规范
3. **交互简单**：Toast、Loading、Modal 等一行代码搞定
4. **响应式数据**：Vue 的双向绑定让数据处理极其简单

### 时间对比：
- 原生开发一个页面：2-3小时
- uni-app + uView：30分钟

## 4. 快速部署

```bash
# 编译到微信小程序
npm run dev:mp-weixin

# 用 HBuilderX 打开 dist/dev/mp-weixin
# 或用微信开发者工具打开
```

## 5. 云函数对接（保持不变）

uni-app 完美支持微信云开发，原有的云函数无需修改：

```javascript
// 初始化云开发
wx.cloud.init({
  env: 'cloud1-2g2sby6z920b76cb'
})

// 调用云函数
wx.cloud.callFunction({
  name: 'userManage',
  data: { action: 'login' }
})
```

## 预计开发时间

- 页面搭建：1天
- 功能对接：1天  
- 测试优化：0.5天
- **总计：2.5天完成整个应用**

比原生开发节省 60% 以上的时间！