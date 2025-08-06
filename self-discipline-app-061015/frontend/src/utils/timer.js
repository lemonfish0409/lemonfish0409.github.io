/**
 * 计时器工具函数库
 * 提供专注计时相关的核心功能
 */

// 格式化时间显示 (秒 -> 00:00)
export const formatTime = (seconds) => {
  try {
    if (seconds === undefined || seconds === null) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } catch (err) {
    console.error('格式化时间错误:', err);
    return '00:00';
  }
};

// 格式化实际专注时长显示 (秒 -> x小时y分钟z秒)
export const formatActualDuration = (seconds) => {
  try {
    if (!seconds || seconds < 0) return '0秒';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    } else if (mins > 0) {
      return `${mins}分钟${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  } catch (err) {
    console.error('格式化实际时长错误:', err);
    return '0秒';
  }
};

// 计算实际专注时长（秒）
export const calculateActualDuration = (startTime, endTime, pausedTime = 0) => {
  if (!startTime || !endTime) return 0;
  
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // 计算实际时长（毫秒转秒）- 减去暂停时间
    const actualDuration = Math.round((end - start) / 1000) - pausedTime;
    
    // 确保时长为正数
    return Math.max(0, actualDuration);
  } catch (err) {
    console.error('计算实际时长错误:', err);
    return 0;
  }
};

// 计算进度条百分比
export const calculateProgress = (time, initialTime, isBreak, breakTime, isForwardTimer, elapsedTime) => {
  try {
    if (isForwardTimer) {
      // 正向计时没有固定终点，所以进度条不会填满
      const maxTime = 3 * 60 * 60; // 3小时（秒）
      return Math.min((elapsedTime / maxTime) * 100, 100);
    } else {
      const total = isBreak ? breakTime : initialTime;
      const remaining = time;
      return ((total - remaining) / total) * 100;
    }
  } catch (err) {
    console.error('计算进度条错误:', err);
    return 0;
  }
};

// 创建简单的音频提示
export const createAudioContext = () => {
  try {
    // 创建简单的提示音
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
    
    return audioContext;
  } catch (e) {
    console.log('音效播放失败:', e);
    return null;
  }
};

// 更新统计数据
export const updateStatsWithFocusSession = (session) => {
  if (!session || !session.end_time) return;
  
  try {
    // 触发localStorage变化，Stats组件会监听这个变化并更新
    console.log('专注会话已完成，实际时长:', session.actual_duration, '秒');
    
    // 手动触发storage事件
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'focus_sessions',
      newValue: localStorage.getItem('focus_sessions')
    }));
  } catch (err) {
    console.error('更新统计数据失败:', err);
  }
};

// 创建新的专注会话
export const createNewSession = (isForwardTimer, initialTime) => {
  const startTime = new Date().toISOString();
  
  return {
    id: Date.now().toString(),
    duration: isForwardTimer ? 0 : initialTime,
    start_time: startTime,
    end_time: null,
    actual_duration: 0,
    paused_duration: 0,
    is_forward_timer: isForwardTimer
  };
};

// 请求通知权限
export const requestNotificationPermission = async () => {
  if (Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    try {
      await Notification.requestPermission();
    } catch (err) {
      console.error('请求通知权限失败:', err);
    }
  }
};

// 发送通知
export const sendNotification = (title, body) => {
  if (Notification && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch (err) {
      console.error('发送通知失败:', err);
    }
  }
};