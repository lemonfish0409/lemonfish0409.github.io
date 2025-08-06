import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faClock, faPlay, faPause, faStop, faCog, faBell, 
  faHourglassStart, faHourglassHalf, faHourglassEnd,
  faCalendarAlt, faListAlt, faPlus, faCheck, faTimes
} from '@fortawesome/free-solid-svg-icons';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import Plan from './Plan';
import 'animate.css';

const Focus = () => {
  // 状态管理
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusDuration, setFocusDuration] = useState(0); // 计算出的专注时长（秒）
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 音效
  const alarmSound = useRef(null);

  // 初始化音效
  useEffect(() => {
    try {
      alarmSound.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
      
      return () => {
        if (alarmSound.current) {
          alarmSound.current.pause();
          alarmSound.current = null;
        }
      };
    } catch (err) {
      console.error('音效初始化失败:', err);
      // 音效失败不影响主要功能
    }
  }, []);

  // 获取计划列表
  const fetchPlans = () => {
    try {
      // 从localStorage获取计划数据
      const plansData = JSON.parse(localStorage.getItem('plans_data') || '[]');
      // 过滤出未完成的计划
      const pendingPlans = plansData.filter(plan => !plan.completed);
      setPlans(pendingPlans);
      setError(null);
    } catch (err) {
      console.error('获取计划列表失败:', err);
      setError('获取计划列表失败，请稍后再试');
    }
  };

  // 初始加载计划
  useEffect(() => {
    fetchPlans();
  }, []);

  // 定时检查计划更新
  useEffect(() => {
    // 每30秒检查一次计划更新
    const intervalId = setInterval(() => {
      fetchPlans();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // 获取历史专注记录
  useEffect(() => {
    const fetchSessions = () => {
      try {
        // 从localStorage获取专注会话数据
        const focusSessions = JSON.parse(localStorage.getItem('focus_sessions') || '[]');
        setSessions(focusSessions);
        setError(null);
      } catch (err) {
        console.error('获取专注记录失败:', err);
        setError('获取专注记录失败，请稍后再试');
      }
    };

    fetchSessions();
  }, []);

  // 计算专注时长
  useEffect(() => {
    if (startTime && endTime) {
      try {
        const start = new Date(`${new Date().toISOString().split('T')[0]}T${startTime}`);
        const end = new Date(`${new Date().toISOString().split('T')[0]}T${endTime}`);
        
        if (end > start) {
          const duration = differenceInSeconds(end, start);
          setFocusDuration(duration);
        } else {
          // 如果结束时间早于开始时间，可能是跨天的情况
          const endNextDay = new Date(`${new Date().toISOString().split('T')[0]}T${endTime}`);
          endNextDay.setDate(endNextDay.getDate() + 1);
          const duration = differenceInSeconds(endNextDay, start);
          setFocusDuration(duration);
        }
      } catch (err) {
        console.error('计算专注时长失败:', err);
        setFocusDuration(0);
      }
    } else {
      setFocusDuration(0);
    }
  }, [startTime, endTime]);

  // 填充当前时间
  const fillCurrentTime = (field) => {
    try {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      
      if (field === 'start') {
        setStartTime(currentTime);
      } else if (field === 'end') {
        setEndTime(currentTime);
      }
    } catch (err) {
      console.error('填充当前时间失败:', err);
      setError('获取当前时间失败，请手动输入');
    }
  };

  // 处理计划选择
  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
  };

  // 处理新计划创建
  const handlePlanCreated = (newPlan) => {
    setPlans([newPlan, ...plans]);
    setSelectedPlan(newPlan);
    setShowAddPlanModal(false);
  };

  // 提交专注记录
  const handleSubmitFocus = async () => {
    if (!selectedPlan) {
      setError('请选择一个计划');
      return;
    }

    if (!startTime || !endTime) {
      setError('请填写开始时间和结束时间');
      return;
    }

    if (focusDuration <= 0) {
      setError('专注时长必须大于0');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 创建专注会话记录
      const startDateTime = new Date(`${new Date().toISOString().split('T')[0]}T${startTime}`);
      const endDateTime = new Date(`${new Date().toISOString().split('T')[0]}T${endTime}`);
      
      // 如果结束时间早于开始时间，认为是跨天的情况
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      
      const newSession = {
        id: Date.now().toString(),
        plan_id: selectedPlan.id,
        plan_title: selectedPlan.title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        actual_duration: focusDuration,
        created_at: new Date().toISOString()
      };
      
      // 获取现有会话并添加新会话
      const existingSessions = JSON.parse(localStorage.getItem('focus_sessions') || '[]');
      
      // 检查是否有时间重叠的会话
      const hasOverlap = existingSessions.some(session => {
        const sessionStart = new Date(session.start_time);
        const sessionEnd = new Date(session.end_time);
        
        return (
          (startDateTime <= sessionEnd && endDateTime >= sessionStart) ||
          (startDateTime >= sessionStart && startDateTime <= sessionEnd) ||
          (endDateTime >= sessionStart && endDateTime <= sessionEnd)
        );
      });
      
      if (hasOverlap) {
        setError('该时间段与已有专注记录重叠，请调整时间');
        setIsSubmitting(false);
        return;
      }
      
      const updatedSessions = [newSession, ...existingSessions];
      
      // 保存到本地存储
      localStorage.setItem('focus_sessions', JSON.stringify(updatedSessions));
      
      // 更新计划状态为已完成
      const plansData = JSON.parse(localStorage.getItem('plans_data') || '[]');
      const updatedPlans = plansData.map(plan => 
        plan.id === selectedPlan.id ? { ...plan, completed: true } : plan
      );
      
      localStorage.setItem('plans_data', JSON.stringify(updatedPlans));
      
      // 更新状态
      setSessions(updatedSessions);
      setPlans(updatedPlans.filter(plan => !plan.completed));
      setSelectedPlan(null);
      setStartTime('');
      setEndTime('');
      setFocusDuration(0);
      setError(null);
      
      // 播放完成音效
      if (alarmSound.current) {
        try {
          await alarmSound.current.play();
        } catch (e) {
          console.log('播放音效失败:', e);
          // 音效播放失败不影响主要功能
        }
      }
      
      // 显示通知
      try {
        if (Notification && Notification.permission === 'granted') {
          new Notification('专注记录已保存', {
            body: `您已完成 ${formatDuration(focusDuration)} 的专注`,
            icon: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.4/svgs/solid/check-circle.svg'
          });
        }
      } catch (e) {
        console.log('通知显示失败:', e);
        // 通知失败不影响主要功能
      }
    } catch (err) {
      console.error('提交专注记录失败:', err);
      setError('提交专注记录失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 格式化时间显示
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString;
  };

  // 格式化日期显示
  const formatDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'yyyy-MM-dd HH:mm');
    } catch (err) {
      return dateString;
    }
  };

  // 格式化持续时间显示
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟${remainingSeconds}秒`;
    } else if (minutes > 0) {
      return `${minutes}分钟${remainingSeconds}秒`;
    } else {
      return `${remainingSeconds}秒`;
    }
  };

  // 请求通知权限
  const requestNotificationPermission = async () => {
    try {
      if (Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    } catch (err) {
      console.error('请求通知权限失败:', err);
      // 通知权限失败不影响主要功能
    }
  };

  // 初始化时请求通知权限
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // 删除专注记录
  const handleDeleteSession = (sessionId) => {
    try {
      const existingSessions = JSON.parse(localStorage.getItem('focus_sessions') || '[]');
      const updatedSessions = existingSessions.filter(session => session.id !== sessionId);
      
      localStorage.setItem('focus_sessions', JSON.stringify(updatedSessions));
      setSessions(updatedSessions);
    } catch (err) {
      console.error('删除专注记录失败:', err);
      setError('删除专注记录失败，请稍后再试');
    }
  };

  // 处理触摸事件
  const handleTouch = (callback) => (e) => {
    e.preventDefault(); // 防止默认行为
    callback();
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-50">
      {/* 标题 */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faClock} className="mr-2" />
          专注时间
        </h1>
        <p className="text-gray-600">
          选择计划，记录专注时间
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 animate__animated animate__fadeIn" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={handleTouch(() => setError(null))}
            onTouchEnd={handleTouch(() => setError(null))}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* 专注表单 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 animate__animated animate__fadeIn">
        <h2 className="text-lg font-semibold mb-4">记录专注时间</h2>
        
        {/* 计划选择 */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            选择计划 <span className="text-red-500">*</span>
          </label>
          
          {plans.length > 0 ? (
            <div className="space-y-2">
              {plans.map(plan => (
                <div 
                  key={plan.id}
                  onClick={() => handlePlanSelect(plan)}
                  onTouchEnd={handleTouch(() => handlePlanSelect(plan))}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${ 
                    selectedPlan && selectedPlan.id === plan.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 ${
                      selectedPlan && selectedPlan.id === plan.id 
                        ? 'bg-blue-500 text-white' 
                        : 'border border-gray-400'
                    }`}>
                      {selectedPlan && selectedPlan.id === plan.id && <FontAwesomeIcon icon={faCheck} className="text-xs" />}
                    </div>
                    <div>
                      <p className="font-medium">{plan.title}</p>
                      <p className="text-xs text-gray-500">
                        创建于 {format(new Date(plan.created_at), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FontAwesomeIcon icon={faListAlt} className="text-gray-400 text-3xl mb-2" />
              <p className="text-gray-500 mb-2">暂无可用计划</p>
              <button
                onClick={() => setShowAddPlanModal(true)}
                onTouchEnd={handleTouch(() => setShowAddPlanModal(true))}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                创建新计划
              </button>
            </div>
          )}
          
          {plans.length > 0 && (
            <button
              onClick={() => setShowAddPlanModal(true)}
              onTouchEnd={handleTouch(() => setShowAddPlanModal(true))}
              className="mt-2 text-blue-500 hover:underline flex items-center text-sm"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              创建新计划
            </button>
          )}
        </div>
        
        {/* 时间选择 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 开始时间 */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              开始时间 <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{minHeight: '44px'}} // 确保iOS上的触摸目标足够大
              />
              <button
                onClick={() => fillCurrentTime('start')}
                onTouchEnd={handleTouch(() => fillCurrentTime('start'))}
                className="px-3 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{minWidth: '60px'}} // 确保触摸目标足够大
              >
                现在
              </button>
            </div>
          </div>
          
          {/* 结束时间 */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              结束时间 <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{minHeight: '44px'}} // 确保iOS上的触摸目标足够大
              />
              <button
                onClick={() => fillCurrentTime('end')}
                onTouchEnd={handleTouch(() => fillCurrentTime('end'))}
                className="px-3 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{minWidth: '60px'}} // 确保触摸目标足够大
              >
                现在
              </button>
            </div>
          </div>
        </div>
        
        {/* 专注时长显示 */}
        {focusDuration > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faHourglassHalf} className="text-blue-500 mr-2" />
              <span className="font-medium">专注时长: </span>
              <span className="ml-2 text-blue-700 font-bold">{formatDuration(focusDuration)}</span>
            </div>
          </div>
        )}
        
        {/* 提交按钮 */}
        <button
          onClick={handleSubmitFocus}
          onTouchEnd={handleTouch(handleSubmitFocus)}
          disabled={isSubmitting || !selectedPlan || !startTime || !endTime || focusDuration <= 0}
          className={`w-full py-3 rounded-lg flex items-center justify-center ${
            isSubmitting || !selectedPlan || !startTime || !endTime || focusDuration <= 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          style={{minHeight: '50px'}} // 确保触摸目标足够大
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
          ) : (
            <FontAwesomeIcon icon={faCheck} className="mr-2" />
          )}
          提交专注记录
        </button>
      </div>

      {/* 专注记录 - 改为流式布局，不使用滚轮 */}
      <div className="bg-white rounded-lg shadow-md p-4 animate__animated animate__fadeIn">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">专注记录</h3>
          <FontAwesomeIcon icon={faBell} className="text-gray-500" />
        </div>
        
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>暂无专注记录</p>
            <p className="text-sm mt-2">开始您的第一次专注吧！</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {sessions.map((session) => {
              const startTime = new Date(session.start_time);
              const endTime = new Date(session.end_time);
              const actualDuration = session.actual_duration || 
                Math.round((endTime - startTime) / 1000);
              
              return (
                <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-grow">
                    <p className="font-medium">
                      {session.plan_title || '未命名计划'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(startTime, 'yyyy-MM-dd HH:mm')} - {format(endTime, 'HH:mm')}
                    </p>
                    <p className="text-sm text-gray-500">
                      专注时长: {formatDuration(actualDuration)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-16 h-16 rounded-full flex flex-col items-center justify-center bg-blue-100 mr-2">
                      <span className="font-bold text-sm text-blue-600">
                        {Math.floor(actualDuration / 60)}分钟
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteSession(session.id)}
                      onTouchEnd={handleTouch(() => handleDeleteSession(session.id))}
                      className="text-red-500 hover:text-red-700 p-2"
                      aria-label="删除记录"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新建计划模态框 */}
      {showAddPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate__animated animate__fadeIn">
          <Plan 
            isFloatingMode={true} 
            onPlanCreated={handlePlanCreated} 
            onClose={() => setShowAddPlanModal(false)} 
          />
        </div>
      )}
    </div>
  );
};

export default Focus;