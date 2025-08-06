// Web Worker for background timer functionality
// 用于后台计时的Web Worker

let timerId = null;
let isRunning = false;
let startTime = null;
let pausedTime = 0;
let totalPausedDuration = 0;
let lastPauseTime = null;

// 监听主线程消息
self.addEventListener('message', function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'START_TIMER':
        startTimer(data);
        break;
      case 'PAUSE_TIMER':
        pauseTimer();
        break;
      case 'RESUME_TIMER':
        resumeTimer();
        break;
      case 'STOP_TIMER':
        stopTimer();
        break;
      case 'GET_STATUS':
        sendStatus();
        break;
      case 'SYNC_TIME':
        syncTime(data);
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// 启动计时器
function startTimer(config) {
  try {
    const { 
      sessionId, 
      duration, 
      isForwardTimer = false, 
      actualStartTime,
      resumeFromPause = false 
    } = config;
    
    if (isRunning && timerId) {
      clearInterval(timerId);
    }
    
    isRunning = true;
    
    // 如果是从暂停状态恢复，不重置开始时间
    if (!resumeFromPause) {
      startTime = actualStartTime || Date.now();
      totalPausedDuration = 0;
      pausedTime = 0;
    } else if (lastPauseTime) {
      // 计算本次暂停的时长
      const currentPauseDuration = Date.now() - lastPauseTime;
      totalPausedDuration += currentPauseDuration;
      lastPauseTime = null;
    }
    
    // 启动定时器，每秒更新一次
    timerId = setInterval(() => {
      try {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime - totalPausedDuration) / 1000);
        
        let currentTime;
        let progress;
        
        if (isForwardTimer) {
          // 正向计时
          currentTime = elapsed;
          progress = 0; // 正向计时没有进度概念
        } else {
          // 倒计时
          currentTime = Math.max(0, duration - elapsed);
          progress = duration > 0 ? ((duration - currentTime) / duration) * 100 : 0;
          
          // 检查是否时间到
          if (currentTime <= 0) {
            clearInterval(timerId);
            timerId = null;
            isRunning = false;
            
            self.postMessage({
              type: 'TIMER_COMPLETE',
              data: {
                sessionId,
                actualDuration: elapsed,
                totalPausedDuration,
                endTime: new Date().toISOString()
              }
            });
            return;
          }
        }
        
        // 发送时间更新
        self.postMessage({
          type: 'TIMER_UPDATE',
          data: {
            sessionId,
            currentTime,
            elapsed,
            progress,
            actualDuration: elapsed,
            totalPausedDuration,
            isRunning: true,
            isPaused: false
          }
        });
        
      } catch (error) {
        console.error('Timer update error:', error);
        self.postMessage({
          type: 'ERROR',
          data: {
            message: 'Timer update failed: ' + error.message
          }
        });
      }
    }, 1000);
    
    // 发送启动确认
    self.postMessage({
      type: 'TIMER_STARTED',
      data: {
        sessionId,
        startTime,
        isForwardTimer,
        duration
      }
    });
    
  } catch (error) {
    console.error('Start timer error:', error);
    self.postMessage({
      type: 'ERROR',
      data: {
        message: 'Failed to start timer: ' + error.message
      }
    });
  }
}

// 暂停计时器
function pauseTimer() {
  try {
    if (isRunning && timerId) {
      clearInterval(timerId);
      timerId = null;
      isRunning = false;
      lastPauseTime = Date.now();
      
      self.postMessage({
        type: 'TIMER_PAUSED',
        data: {
          pauseTime: lastPauseTime,
          totalPausedDuration
        }
      });
    }
  } catch (error) {
    console.error('Pause timer error:', error);
    self.postMessage({
      type: 'ERROR',
      data: {
        message: 'Failed to pause timer: ' + error.message
      }
    });
  }
}

// 恢复计时器
function resumeTimer() {
  try {
    if (!isRunning && lastPauseTime) {
      // 计算暂停时长
      const pauseDuration = Date.now() - lastPauseTime;
      totalPausedDuration += pauseDuration;
      lastPauseTime = null;
      
      // 重新启动计时器（不重置开始时间）
      isRunning = true;
      
      timerId = setInterval(() => {
        try {
          const now = Date.now();
          const elapsed = Math.floor((now - startTime - totalPausedDuration) / 1000);
          
          self.postMessage({
            type: 'TIMER_UPDATE',
            data: {
              currentTime: elapsed,
              elapsed,
              actualDuration: elapsed,
              totalPausedDuration,
              isRunning: true,
              isPaused: false
            }
          });
          
        } catch (error) {
          console.error('Resume timer update error:', error);
        }
      }, 1000);
      
      self.postMessage({
        type: 'TIMER_RESUMED',
        data: {
          resumeTime: Date.now(),
          totalPausedDuration
        }
      });
    }
  } catch (error) {
    console.error('Resume timer error:', error);
    self.postMessage({
      type: 'ERROR',
      data: {
        message: 'Failed to resume timer: ' + error.message
      }
    });
  }
}

// 停止计时器
function stopTimer() {
  try {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    
    const now = Date.now();
    let finalPausedDuration = totalPausedDuration;
    
    // 如果当前是暂停状态，需要加上最后一次暂停的时间
    if (lastPauseTime) {
      finalPausedDuration += (now - lastPauseTime);
    }
    
    const actualDuration = startTime ? Math.floor((now - startTime - finalPausedDuration) / 1000) : 0;
    
    // 重置所有状态
    isRunning = false;
    startTime = null;
    totalPausedDuration = 0;
    lastPauseTime = null;
    pausedTime = 0;
    
    self.postMessage({
      type: 'TIMER_STOPPED',
      data: {
        endTime: new Date().toISOString(),
        actualDuration: Math.max(0, actualDuration),
        totalPausedDuration: finalPausedDuration
      }
    });
    
  } catch (error) {
    console.error('Stop timer error:', error);
    self.postMessage({
      type: 'ERROR',
      data: {
        message: 'Failed to stop timer: ' + error.message
      }
    });
  }
}

// 发送当前状态
function sendStatus() {
  try {
    const now = Date.now();
    let currentElapsed = 0;
    let currentPausedDuration = totalPausedDuration;
    
    if (startTime) {
      if (lastPauseTime) {
        // 当前是暂停状态
        currentPausedDuration += (now - lastPauseTime);
      }
      currentElapsed = Math.floor((now - startTime - currentPausedDuration) / 1000);
    }
    
    self.postMessage({
      type: 'TIMER_STATUS',
      data: {
        isRunning,
        isPaused: lastPauseTime !== null,
        startTime,
        currentElapsed: Math.max(0, currentElapsed),
        totalPausedDuration: currentPausedDuration,
        lastPauseTime
      }
    });
  } catch (error) {
    console.error('Send status error:', error);
    self.postMessage({
      type: 'ERROR',
      data: {
        message: 'Failed to get status: ' + error.message
      }
    });
  }
}

// 同步时间（用于页面重新激活时的时间校准）
function syncTime(data) {
  try {
    const { 
      serverStartTime, 
      serverPausedDuration, 
      serverLastPauseTime,
      isCurrentlyRunning,
      isCurrentlyPaused
    } = data;
    
    if (serverStartTime) {
      startTime = new Date(serverStartTime).getTime();
      totalPausedDuration = serverPausedDuration || 0;
      lastPauseTime = serverLastPauseTime ? new Date(serverLastPauseTime).getTime() : null;
      isRunning = isCurrentlyRunning || false;
      
      // 如果服务器状态显示正在运行但本地没有运行，重启计时器
      if (isCurrentlyRunning && !isCurrentlyPaused && !timerId) {
        // 重新启动计时器
        timerId = setInterval(() => {
          try {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime - totalPausedDuration) / 1000);
            
            self.postMessage({
              type: 'TIMER_UPDATE',
              data: {
                currentTime: elapsed,
                elapsed,
                actualDuration: elapsed,
                totalPausedDuration,
                isRunning: true,
                isPaused: false
              }
            });
            
          } catch (error) {
            console.error('Sync timer update error:', error);
          }
        }, 1000);
      }
      
      self.postMessage({
        type: 'TIMER_SYNCED',
        data: {
          startTime,
          totalPausedDuration,
          lastPauseTime,
          isRunning
        }
      });
    }
  } catch (error) {
    console.error('Sync time error:', error);
    self.postMessage({
      type: 'ERROR',
      data: {
        message: 'Failed to sync time: ' + error.message
      }
    });
  }
}

// 错误处理
self.addEventListener('error', function(error) {
  console.error('Worker error:', error);
  self.postMessage({
    type: 'ERROR',
    data: {
      message: 'Worker error: ' + error.message,
      filename: error.filename,
      lineno: error.lineno
    }
  });
});

// Worker初始化完成
self.postMessage({
  type: 'WORKER_READY',
  data: {
    message: 'Timer worker initialized successfully'
  }
});