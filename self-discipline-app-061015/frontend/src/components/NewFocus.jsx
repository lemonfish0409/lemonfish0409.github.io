import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faCog, faTrash } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

const NewFocus = () => {
  // 状态管理
  const [focusDuration, setFocusDuration] = useState(25 * 60); // 默认25分钟
  const [breakDuration, setBreakDuration] = useState(5 * 60); // 默认5分钟
  const [timeLeft, setTimeLeft] = useState(focusDuration);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusSessions, setFocusSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  
  // 计时器引用
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // 加载专注记录
  useEffect(() => {
    fetchFocusSessions();
  }, []);
  
  // 计时器逻辑
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            
            // 如果是专注时间结束，切换到休息时间
            if (!isBreak) {
              setIsBreak(true);
              setTimeLeft(breakDuration);
              // 结束当前专注会话
              if (currentSession) {
                endFocusSession();
              }
              return breakDuration;
            } else {
              // 如果是休息时间结束，重置为专注时间
              setIsBreak(false);
              setIsActive(false);
              setTimeLeft(focusDuration);
              return focusDuration;
            }
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isPaused, isBreak, breakDuration, focusDuration, currentSession]);
  
  // 格式化时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 获取专注记录
  const fetchFocusSessions = async () => {
    try {
      setLoading(true);
      // 尝试从localStorage获取数据
      const localSessions = localStorage.getItem('focus_sessions');
      if (localSessions) {
        setFocusSessions(JSON.parse(localSessions));
      }
      
      // 从API获取数据
      const response = await axios.get('/focus');
      if (response.data.success) {
        const sessions = response.data.data;
        setFocusSessions(sessions);
        // 更新localStorage
        localStorage.setItem('focus_sessions', JSON.stringify(sessions));
      }
    } catch (err) {
      console.error('获取专注记录失败:', err);
      // 如果API失败，仍然使用localStorage的数据
      const localSessions = localStorage.getItem('focus_sessions');
      if (localSessions) {
        setFocusSessions(JSON.parse(localSessions));
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 开始专注
  const startFocus = async () => {
    try {
      setError(null);
      
      // 记录开始时间
      startTimeRef.current = new Date();
      
      // 创建新的专注记录
      const newSession = {
        duration: focusDuration,
        start_time: startTimeRef.current.toISOString(),
        is_forward_timer: false
      };
      
      // 发送API请求
      const response = await axios.post('/focus', newSession);
      
      if (response.data.success) {
        setCurrentSession(response.data.data);
        setIsActive(true);
        setIsPaused(false);
      } else {
        throw new Error(response.data.message || '创建专注记录失败');
      }
    } catch (err) {
      console.error('开始专注失败:', err);
      
      // 即使API失败，也允许用户开始计时（本地模式）
      setCurrentSession({
        id: `local-${Date.now()}`,
        duration: focusDuration,
        start_time: new Date().toISOString(),
        is_local: true
      });
      
      setIsActive(true);
      setIsPaused(false);
    }
  };
  
  // 暂停专注
  const pauseFocus = () => {
    setIsPaused(true);
    clearInterval(timerRef.current);
  };
  
  // 继续专注
  const resumeFocus = () => {
    setIsPaused(false);
  };
  
  // 结束专注
  const endFocusSession = async () => {
    try {
      if (!currentSession) return;
      
      const endTime = new Date();
      const actualDuration = Math.round((endTime - new Date(currentSession.start_time)) / 1000);
      
      // 如果是本地模式的会话
      if (currentSession.is_local) {
        const newSession = {
          ...currentSession,
          end_time: endTime.toISOString(),
          actual_duration: actualDuration
        };
        
        // 更新本地存储
        const sessions = JSON.parse(localStorage.getItem('focus_sessions') || '[]');
        sessions.unshift(newSession);
        localStorage.setItem('focus_sessions', JSON.stringify(sessions));
        setFocusSessions(sessions);
      } else {
        // 发送API请求更新会话
        const response = await axios.put(`/focus/${currentSession.id}`, {
          end_time: endTime.toISOString(),
          actual_duration: actualDuration
        });
        
        if (response.data.success) {
          // 刷新专注记录列表
          fetchFocusSessions();
        }
      }
      
      // 重置状态
      setIsActive(false);
      setIsPaused(false);
      setIsBreak(false);
      setTimeLeft(focusDuration);
      setCurrentSession(null);
      
      // 清除计时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } catch (err) {
      console.error('结束专注失败:', err);
      setError('结束专注失败，请稍后再试');
      
      // 即使API失败，也重置UI状态
      setIsActive(false);
      setIsPaused(false);
      setTimeLeft(focusDuration);
      setCurrentSession(null);
    }
  };
  
  // 删除专注记录
  const deleteFocusSession = async (sessionId) => {
    try {
      setLoading(true);
      
      // 发送API请求删除记录
      const response = await axios.delete(`/focus/${sessionId}`);
      
      if (response.data.success) {
        // 更新本地状态
        const updatedSessions = focusSessions.filter(session => session.id !== sessionId);
        setFocusSessions(updatedSessions);
        
        // 更新localStorage
        localStorage.setItem('focus_sessions', JSON.stringify(updatedSessions));
      } else {
        throw new Error(response.data.message || '删除专注记录失败');
      }
    } catch (err) {
      console.error('删除专注记录失败:', err);
      
      // 即使API失败，也尝试从本地删除
      const updatedSessions = focusSessions.filter(session => session.id !== sessionId);
      setFocusSessions(updatedSessions);
      localStorage.setItem('focus_sessions', JSON.stringify(updatedSessions));
    } finally {
      setLoading(false);
    }
  };
  
  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 格式化持续时间
  const formatDuration = (seconds) => {
    if (!seconds) return '0分钟';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes > 0 ? ` ${minutes}分钟` : ''}`;
    }
    return `${minutes}分钟`;
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 标题栏 */}
      <div className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold text-center">专注</h1>
      </div>
      
      {/* 计时器 */}
      <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md mx-4 my-4">
        <div className={`text-5xl font-bold mb-6 ${isBreak ? 'text-green-500' : 'text-blue-600'}`}>
          {formatTime(timeLeft)}
        </div>
        
        <div className="text-sm text-gray-500 mb-6">
          {isBreak ? '休息时间' : '专注时间'}
        </div>
        
        <div className="flex space-x-4">
          {!isActive ? (
            <>
              <button
                onClick={startFocus}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-full flex items-center justify-center animate__animated animate__fadeIn"
              >
                <FontAwesomeIcon icon={faPlay} className="mr-2" />
                开始
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-6 rounded-full flex items-center justify-center animate__animated animate__fadeIn"
              >
                <FontAwesomeIcon icon={faCog} className="mr-2" />
                设置
              </button>
            </>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={resumeFocus}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-full flex items-center justify-center animate__animated animate__fadeIn"
                >
                  <FontAwesomeIcon icon={faPlay} className="mr-2" />
                  继续
                </button>
              ) : (
                <button
                  onClick={pauseFocus}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-6 rounded-full flex items-center justify-center animate__animated animate__fadeIn"
                >
                  <FontAwesomeIcon icon={faPause} className="mr-2" />
                  暂停
                </button>
              )}
              
              <button
                onClick={endFocusSession}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-6 rounded-full flex items-center justify-center animate__animated animate__fadeIn"
              >
                <FontAwesomeIcon icon={faStop} className="mr-2" />
                结束
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-6 rounded-full flex items-center justify-center animate__animated animate__fadeIn"
              >
                <FontAwesomeIcon icon={faCog} className="mr-2" />
                设置
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate__animated animate__fadeIn">
          <div className="bg-white rounded-lg p-6 w-80">
            <h2 className="text-lg font-bold mb-4">时间设置</h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">专注时长 (分钟)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={focusDuration / 60}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value > 0 && value <= 120) {
                    setFocusDuration(value * 60);
                    if (!isActive) {
                      setTimeLeft(value * 60);
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 mb-2">休息时长 (分钟)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={breakDuration / 60}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value > 0 && value <= 30) {
                    setBreakDuration(value * 60);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-4 mb-4 rounded animate__animated animate__fadeIn">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-sm underline mt-1"
          >
            关闭
          </button>
        </div>
      )}
      
      {/* 专注记录 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <h2 className="text-lg font-bold mb-4">专注记录</h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : focusSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无专注记录
          </div>
        ) : (
          <div className="space-y-3">
            {focusSessions.map((session) => (
              <div 
                key={session.id} 
                className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center animate__animated animate__fadeIn"
              >
                <div>
                  <div className="font-medium">
                    {formatDate(session.start_time)}
                  </div>
                  <div className="text-sm text-gray-500">
                    专注了 {formatDuration(session.actual_duration)}
                  </div>
                </div>
                <button
                  onClick={() => deleteFocusSession(session.id)}
                  className="text-red-500 hover:text-red-700 p-2"
                  title="删除"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewFocus;