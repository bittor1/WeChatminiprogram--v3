const { formatTimeAgo } = require("./formatters.js");

const mockEntries = [
  {
    id: "1",
    name: "张小明",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    wantCount: 1234,
    timeAgo: formatTimeAgo(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
  },
  {
    id: "2",
    name: "李小红",
    avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face",
    wantCount: 567,
    timeAgo: formatTimeAgo(new Date(Date.now() - 5 * 60 * 60 * 1000)), // 5 hours ago
  },
  {
    id: "3",
    name: "王大力",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    wantCount: 89,
    timeAgo: formatTimeAgo(new Date(Date.now() - 24 * 60 * 60 * 1000)), // 1 day ago
  },
  {
    id: "4",
    name: "陈美丽",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    wantCount: 12567,
    timeAgo: formatTimeAgo(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)), // 3 days ago
  },
  {
    id: "5",
    name: "刘强东",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    wantCount: 2345,
    timeAgo: formatTimeAgo(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), // 1 week ago
  },
];

module.exports = {
  mockEntries,
};
