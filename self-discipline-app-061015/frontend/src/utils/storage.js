/**
 * 本地存储工具类
 * 提供统一的本地数据存储和获取接口
 */

// 存储键名常量
const STORAGE_KEYS = {
  PLANS: 'plans_data',
  FOCUS_SESSIONS: 'focus_sessions',
  TESTS: 'tests_data',
  STATS: 'stats_data',
  FOCUS_RECORDS: 'focus_records',
  PLAN_STATUS: 'plan_status'
};

/**
 * 获取本地存储数据
 * @param {string} key - 存储键名
 * @param {any} defaultValue - 默认值（如果存储中没有数据）
 * @returns {any} 解析后的数据或默认值
 */
export const getStorageData = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`获取本地存储数据失败 (${key}):`, error);
    return defaultValue;
  }
};

/**
 * 设置本地存储数据
 * @param {string} key - 存储键名
 * @param {any} data - 要存储的数据
 * @returns {boolean} 是否成功存储
 */
export const setStorageData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`设置本地存储数据失败 (${key}):`, error);
    return false;
  }
};

/**
 * 添加单个数据项到存储数组
 * @param {string} key - 存储键名
 * @param {object} item - 要添加的数据项
 * @returns {boolean} 是否成功添加
 */
export const addStorageItem = (key, item) => {
  try {
    const currentData = getStorageData(key, []);
    currentData.unshift(item); // 添加到数组开头
    return setStorageData(key, currentData);
  } catch (error) {
    console.error(`添加存储项失败 (${key}):`, error);
    return false;
  }
};

/**
 * 更新存储数组中的特定项
 * @param {string} key - 存储键名
 * @param {string} itemId - 要更新项的ID
 * @param {object} updatedData - 更新的数据
 * @returns {boolean} 是否成功更新
 */
export const updateStorageItem = (key, itemId, updatedData) => {
  try {
    const currentData = getStorageData(key, []);
    const index = currentData.findIndex(item => item.id === itemId);
    
    if (index !== -1) {
      currentData[index] = { ...currentData[index], ...updatedData };
      return setStorageData(key, currentData);
    }
    return false;
  } catch (error) {
    console.error(`更新存储项失败 (${key}, ${itemId}):`, error);
    return false;
  }
};

/**
 * 删除存储数组中的特定项
 * @param {string} key - 存储键名
 * @param {string} itemId - 要删除项的ID
 * @returns {boolean} 是否成功删除
 */
export const removeStorageItem = (key, itemId) => {
  try {
    const currentData = getStorageData(key, []);
    const filteredData = currentData.filter(item => item.id !== itemId);
    
    if (filteredData.length !== currentData.length) {
      return setStorageData(key, filteredData);
    }
    return false;
  } catch (error) {
    console.error(`删除存储项失败 (${key}, ${itemId}):`, error);
    return false;
  }
};

/**
 * 清除特定键的所有数据
 * @param {string} key - 存储键名
 * @returns {boolean} 是否成功清除
 */
export const clearStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`清除存储失败 (${key}):`, error);
    return false;
  }
};

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * 获取今日计划列表
 * @returns {Array} 今日计划列表
 */
export const getTodayPlans = () => {
  try {
    const plans = getStorageData(STORAGE_KEYS.PLANS, []);
    const today = new Date().toISOString().split('T')[0];
    
    return plans.filter(plan => {
      if (!plan.created_at) return false;
      const planDate = new Date(plan.created_at).toISOString().split('T')[0];
      return planDate === today;
    });
  } catch (error) {
    console.error('获取今日计划失败:', error);
    return [];
  }
};

/**
 * 创建新计划
 * @param {object} planData - 计划数据
 * @returns {object|null} 创建的计划对象或null
 */
export const createPlan = (planData) => {
  try {
    const newPlan = {
      id: generateId(),
      title: planData.title || '',
      description: planData.description || '',
      priority: planData.priority || 'medium',
      completed: false,
      focus_time: 0, // 专注时间（分钟）
      has_focus_time: false, // 是否有专注时间
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...planData
    };
    
    const success = addStorageItem(STORAGE_KEYS.PLANS, newPlan);
    
    // 初始化计划状态
    if (success) {
      updatePlanStatus(newPlan.id, 'pending');
    }
    
    return success ? newPlan : null;
  } catch (error) {
    console.error('创建计划失败:', error);
    return null;
  }
};

/**
 * 创建专注记录并关联计划
 * @param {object} focusData - 专注数据
 * @returns {object|null} 创建的专注记录或null
 */
export const createFocusSession = (focusData) => {
  try {
    const { plan_id, focus_minutes, description, start_time, end_time } = focusData;
    
    if (!plan_id || !focus_minutes || focus_minutes <= 0) {
      throw new Error('缺少必要的专注数据');
    }
    
    // 检查是否有其他计划正在进行中
    if (hasActivePlan(plan_id)) {
      throw new Error('已有其他计划正在进行中');
    }
    
    // 创建专注记录
    const newFocusSession = {
      id: generateId(),
      plan_id: plan_id,
      focus_minutes: Number(focus_minutes),
      actual_duration: Number(focus_minutes) * 60, // 转换为秒
      description: description || '',
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    // 保存专注记录
    const focusSuccess = addStorageItem(STORAGE_KEYS.FOCUS_SESSIONS, newFocusSession);
    if (!focusSuccess) {
      throw new Error('保存专注记录失败');
    }
    
    // 更新关联计划的专注时间
    const planUpdateSuccess = updatePlanFocusTime(plan_id, Number(focus_minutes));
    if (!planUpdateSuccess) {
      console.warn('更新计划专注时间失败，但专注记录已保存');
    }
    
    // 同步到统计数据
    syncFocusToStats(newFocusSession);
    
    // 添加到专注记录
    addFocusRecord(newFocusSession);
    
    return newFocusSession;
  } catch (error) {
    console.error('创建专注记录失败:', error);
    return null;
  }
};

/**
 * 更新计划的专注时间
 * @param {string} planId - 计划ID
 * @param {number} focusMinutes - 专注时间（分钟）
 * @returns {boolean} 是否成功更新
 */
export const updatePlanFocusTime = (planId, focusMinutes) => {
  try {
    const plans = getStorageData(STORAGE_KEYS.PLANS, []);
    const planIndex = plans.findIndex(plan => plan.id === planId);
    
    if (planIndex === -1) {
      console.warn('计划不存在:', planId);
      return false;
    }
    
    // 更新计划数据
    plans[planIndex] = {
      ...plans[planIndex],
      focus_time: (plans[planIndex].focus_time || 0) + focusMinutes,
      has_focus_time: true,
      updated_at: new Date().toISOString()
    };
    
    return setStorageData(STORAGE_KEYS.PLANS, plans);
  } catch (error) {
    console.error('更新计划专注时间失败:', error);
    return false;
  }
};

/**
 * 获取计划的专注记录
 * @param {string} planId - 计划ID
 * @returns {Array} 专注记录列表
 */
export const getPlanFocusSessions = (planId) => {
  try {
    const focusSessions = getStorageData(STORAGE_KEYS.FOCUS_SESSIONS, []);
    return focusSessions.filter(session => session.plan_id === planId);
  } catch (error) {
    console.error('获取计划专注记录失败:', error);
    return [];
  }
};

/**
 * 更新统计数据
 * @param {object} newStats - 新的统计数据
 * @returns {boolean} 是否成功更新
 */
export const updateStats = (newStats) => {
  try {
    const currentStats = getStorageData(STORAGE_KEYS.STATS, {});
    const updatedStats = { ...currentStats, ...newStats };
    return setStorageData(STORAGE_KEYS.STATS, updatedStats);
  } catch (error) {
    console.error('更新统计数据失败:', error);
    return false;
  }
};

/**
 * 同步专注记录到统计数据
 * @param {object} focusSession - 专注会话数据
 * @returns {boolean} 是否成功同步
 */
export const syncFocusToStats = (focusSession) => {
  try {
    if (!focusSession.end_time || !focusSession.focus_minutes) {
      return false;
    }
    
    // 获取现有统计数据
    const existingStats = getStorageData(STORAGE_KEYS.STATS, []);
    
    // 计算会话日期
    const sessionDate = new Date(focusSession.start_time).toISOString().split('T')[0];
    
    // 查找或创建当日统计
    let dayStats = existingStats.find(stat => stat.date === sessionDate);
    if (!dayStats) {
      dayStats = {
        date: sessionDate,
        focus_time: 0, // 专注时间（秒）
        completed_plans: 0,
        test_count: 0,
        test_total_questions: 0,
        test_correct_answers: 0
      };
      existingStats.push(dayStats);
    }
    
    // 更新专注时间（转换为秒）
    const focusTimeInSeconds = focusSession.focus_minutes * 60;
    dayStats.focus_time += focusTimeInSeconds;
    
    // 保存更新后的统计数据
    const success = setStorageData(STORAGE_KEYS.STATS, existingStats);
    
    if (success) {
      console.log('统计数据已更新:', { sessionDate, focusMinutes: focusSession.focus_minutes });
    }
    
    return success;
  } catch (error) {
    console.error('同步专注数据到统计失败:', error);
    return false;
  }
};

/**
 * 同步计划完成状态到统计数据
 * @param {string} planId - 计划ID
 * @param {boolean} completed - 是否完成
 * @returns {boolean} 是否成功同步
 */
export const syncPlanCompletionToStats = (planId, completed) => {
  try {
    // 获取计划信息
    const plans = getStorageData(STORAGE_KEYS.PLANS, []);
    const plan = plans.find(p => p.id === planId);
    
    if (!plan) {
      console.warn('计划不存在:', planId);
      return false;
    }
    
    // 获取现有统计数据
    const existingStats = getStorageData(STORAGE_KEYS.STATS, []);
    
    // 计算计划日期
    const planDate = new Date(plan.created_at).toISOString().split('T')[0];
    
    // 查找或创建当日统计
    let dayStats = existingStats.find(stat => stat.date === planDate);
    if (!dayStats) {
      dayStats = {
        date: planDate,
        focus_time: 0,
        completed_plans: 0,
        test_count: 0,
        test_total_questions: 0,
        test_correct_answers: 0
      };
      existingStats.push(dayStats);
    }
    
    // 更新完成计划数
    if (completed) {
      dayStats.completed_plans += 1;
    } else {
      dayStats.completed_plans = Math.max(0, dayStats.completed_plans - 1);
    }
    
    // 保存更新后的统计数据
    const success = setStorageData(STORAGE_KEYS.STATS, existingStats);
    
    if (success) {
      console.log('计划完成统计已更新:', { planDate, completed, totalCompleted: dayStats.completed_plans });
    }
    
    return success;
  } catch (error) {
    console.error('同步计划完成状态到统计失败:', error);
    return false;
  }
};

/**
 * 获取统计数据摘要
 * @param {string} period - 时间周期 ('day', 'week', 'month')
 * @returns {object} 统计摘要
 */
export const getStatsSummary = (period = 'week') => {
  try {
    const stats = getStorageData(STORAGE_KEYS.STATS, []);
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    // 过滤时间范围内的数据
    const filteredStats = stats.filter(stat => 
      new Date(stat.date) >= startDate
    );
    
    // 计算汇总数据
    const totalFocusTime = filteredStats.reduce((sum, stat) => sum + (stat.focus_time || 0), 0);
    const totalCompletedPlans = filteredStats.reduce((sum, stat) => sum + (stat.completed_plans || 0), 0);
    const totalTests = filteredStats.reduce((sum, stat) => sum + (stat.test_count || 0), 0);
    const totalQuestions = filteredStats.reduce((sum, stat) => sum + (stat.test_total_questions || 0), 0);
    const correctAnswers = filteredStats.reduce((sum, stat) => sum + (stat.test_correct_answers || 0), 0);
    
    // 计算平均值
    const days = period === 'day' ? 1 : (period === 'week' ? 7 : 30);
    const avgDailyFocusTime = Math.round(totalFocusTime / days / 60); // 转换为分钟
    const avgAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    return {
      period,
      total_focus_time: Math.round(totalFocusTime / 60), // 转换为分钟
      avg_daily_focus_time: avgDailyFocusTime,
      completed_plans: totalCompletedPlans,
      total_tests: totalTests,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      avg_accuracy: avgAccuracy
    };
  } catch (error) {
    console.error('获取统计摘要失败:', error);
    return {
      period,
      total_focus_time: 0,
      avg_daily_focus_time: 0,
      completed_plans: 0,
      total_tests: 0,
      total_questions: 0,
      correct_answers: 0,
      avg_accuracy: 0
    };
  }
};

/**
 * 添加专注记录
 * @param {object} focusRecord - 专注记录数据
 * @returns {boolean} 是否成功添加
 */
export const addFocusRecord = (focusRecord) => {
  try {
    const records = getStorageData(STORAGE_KEYS.FOCUS_RECORDS, []);
    
    const newRecord = {
      id: focusRecord.id || generateId(),
      plan_id: focusRecord.plan_id,
      focus_minutes: focusRecord.focus_minutes,
      start_time: focusRecord.start_time,
      end_time: focusRecord.end_time,
      description: focusRecord.description || '',
      created_at: new Date().toISOString()
    };
    
    records.unshift(newRecord);
    
    // 更新计划状态为已完成
    updatePlanStatus(focusRecord.plan_id, 'completed');
    
    return setStorageData(STORAGE_KEYS.FOCUS_RECORDS, records);
  } catch (error) {
    console.error('添加专注记录失败:', error);
    return false;
  }
};

/**
 * 获取专注记录
 * @param {string} planId - 可选的计划ID，用于过滤特定计划的记录
 * @returns {Array} 专注记录列表
 */
export const getFocusRecords = (planId = null) => {
  try {
    const records = getStorageData(STORAGE_KEYS.FOCUS_RECORDS, []);
    
    if (planId) {
      return records.filter(record => record.plan_id === planId);
    }
    
    return records;
  } catch (error) {
    console.error('获取专注记录失败:', error);
    return [];
  }
};

/**
 * 更新计划状态
 * @param {string} planId - 计划ID
 * @param {string} status - 计划状态 ('pending', 'in_progress', 'completed')
 * @returns {boolean} 是否成功更新
 */
export const updatePlanStatus = (planId, status) => {
  try {
    const planStatus = getStorageData(STORAGE_KEYS.PLAN_STATUS, {});
    
    // 如果状态是 'in_progress'，先检查是否有其他计划正在进行中
    if (status === 'in_progress' && hasActivePlan(planId)) {
      console.warn('已有其他计划正在进行中');
      return false;
    }
    
    // 更新计划状态
    planStatus[planId] = {
      status,
      updated_at: new Date().toISOString()
    };
    
    // 同步到计划数据
    const plans = getStorageData(STORAGE_KEYS.PLANS, []);
    const planIndex = plans.findIndex(plan => plan.id === planId);
    
    if (planIndex !== -1) {
      plans[planIndex].status = status;
      plans[planIndex].completed = status === 'completed';
      plans[planIndex].updated_at = new Date().toISOString();
      setStorageData(STORAGE_KEYS.PLANS, plans);
      
      // 如果计划完成，同步到统计数据
      if (status === 'completed') {
        syncPlanCompletionToStats(planId, true);
      }
    }
    
    return setStorageData(STORAGE_KEYS.PLAN_STATUS, planStatus);
  } catch (error) {
    console.error('更新计划状态失败:', error);
    return false;
  }
};

/**
 * 获取计划状态
 * @param {string} planId - 计划ID
 * @returns {string} 计划状态 ('pending', 'in_progress', 'completed')
 */
export const getPlanStatus = (planId) => {
  try {
    const planStatus = getStorageData(STORAGE_KEYS.PLAN_STATUS, {});
    return planStatus[planId]?.status || 'pending';
  } catch (error) {
    console.error('获取计划状态失败:', error);
    return 'pending';
  }
};

/**
 * 检查是否有其他计划正在进行中
 * @param {string} excludePlanId - 要排除的计划ID
 * @returns {boolean} 是否有其他计划正在进行中
 */
export const hasActivePlan = (excludePlanId) => {
  try {
    const planStatus = getStorageData(STORAGE_KEYS.PLAN_STATUS, {});
    
    for (const planId in planStatus) {
      if (planId !== excludePlanId && planStatus[planId].status === 'in_progress') {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('检查活动计划失败:', error);
    return false;
  }
};

/**
 * 获取当前活动计划
 * @returns {string|null} 活动计划ID或null
 */
export const getActivePlanId = () => {
  try {
    const planStatus = getStorageData(STORAGE_KEYS.PLAN_STATUS, {});
    
    for (const planId in planStatus) {
      if (planStatus[planId].status === 'in_progress') {
        return planId;
      }
    }
    
    return null;
  } catch (error) {
    console.error('获取活动计划失败:', error);
    return null;
  }
};

// 导出存储键常量
export { STORAGE_KEYS };

// 初始化本地存储
export const initStorage = () => {
  // 确保所有必要的存储键都已初始化
  if (!localStorage.getItem(STORAGE_KEYS.PLANS)) {
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.FOCUS_SESSIONS)) {
    localStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.TESTS)) {
    localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.STATS)) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.FOCUS_RECORDS)) {
    localStorage.setItem(STORAGE_KEYS.FOCUS_RECORDS, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.PLAN_STATUS)) {
    localStorage.setItem(STORAGE_KEYS.PLAN_STATUS, JSON.stringify({}));
  }
};