import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckCircle, faPlus, faTrash, faEdit, 
  faStar, faExclamationCircle, faListAlt,
  faCalendarDay, faTimes, faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { format, isToday, isYesterday, isSameDay, parseISO, addDays } from 'date-fns';
import 'animate.css';

const Plan = ({ onPlanCreated, isFloatingMode = false, onClose = null }) => {
  // 状态管理
  const [plans, setPlans] = useState([]);
  const [newPlan, setNewPlan] = useState('');
  const [priority, setPriority] = useState(0); // 0: 普通, 1: 重要, 2: 紧急
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, completed, pending
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [category, setCategory] = useState(''); // 分类标签

  // 获取计划列表
  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        // 从localStorage获取计划数据
        const plansData = JSON.parse(localStorage.getItem('plans_data') || '[]');
        setPlans(plansData);
        setError(null);
      } catch (err) {
        console.error('获取计划列表失败:', err);
        setError('获取计划列表失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // 保存计划数据到localStorage
  const savePlansToLocalStorage = (plansData) => {
    localStorage.setItem('plans_data', JSON.stringify(plansData));
  };

  // 添加新计划
  const handleAddPlan = async (e) => {
    e.preventDefault();
    
    if (!newPlan.trim()) {
      setError('计划内容不能为空');
      return;
    }

    try {
      setIsLoading(true);
      
      // 创建新计划对象
      const newPlanData = {
        id: Date.now().toString(), // 使用时间戳作为唯一ID
        title: newPlan,
        priority,
        completed: false,
        created_at: selectedDate.toISOString(),
        category: category || '未分类'
      };
      
      // 更新状态和localStorage
      const updatedPlans = [newPlanData, ...plans];
      setPlans(updatedPlans);
      savePlansToLocalStorage(updatedPlans);
      
      // 如果是浮动模式，通知父组件计划已创建
      if (isFloatingMode && onPlanCreated) {
        onPlanCreated(newPlanData);
      }
      
      // 重置表单
      setNewPlan('');
      setPriority(0);
      setCategory('');
      setSelectedDate(new Date());
      setShowAddModal(false);
      setError(null);
    } catch (err) {
      console.error('添加计划失败:', err);
      setError('添加计划失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新计划状态
  const togglePlanStatus = async (id, completed) => {
    try {
      // 更新计划状态
      const updatedPlans = plans.map(plan => 
        plan.id === id ? { ...plan, completed: !completed } : plan
      );
      
      setPlans(updatedPlans);
      savePlansToLocalStorage(updatedPlans);
    } catch (err) {
      console.error('更新计划状态失败:', err);
      setError('更新计划状态失败，请稍后再试');
    }
  };

  // 删除计划
  const deletePlan = async (id) => {
    try {
      const updatedPlans = plans.filter(plan => plan.id !== id);
      setPlans(updatedPlans);
      savePlansToLocalStorage(updatedPlans);
    } catch (err) {
      console.error('删除计划失败:', err);
      setError('删除计划失败，请稍后再试');
    }
  };

  // 开始编辑计划
  const startEditPlan = (plan) => {
    setEditingPlan({
      ...plan,
      title: plan.title
    });
  };

  // 保存编辑后的计划
  const saveEditPlan = async () => {
    try {
      const updatedPlans = plans.map(plan => 
        plan.id === editingPlan.id ? editingPlan : plan
      );
      
      setPlans(updatedPlans);
      savePlansToLocalStorage(updatedPlans);
      setEditingPlan(null);
    } catch (err) {
      console.error('更新计划失败:', err);
      setError('更新计划失败，请稍后再试');
    }
  };

  // 取消编辑
  const cancelEditPlan = () => {
    setEditingPlan(null);
  };

  // 过滤计划
  const filteredPlans = plans.filter(plan => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'completed') return plan.completed;
    if (filterStatus === 'pending') return !plan.completed;
    return true;
  });

  // 获取优先级图标和颜色
  const getPriorityInfo = (priorityLevel) => {
    switch (priorityLevel) {
      case 2:
        return { 
          icon: faExclamationCircle, 
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          label: '紧急'
        };
      case 1:
        return { 
          icon: faStar, 
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          label: '重要'
        };
      default:
        return { 
          icon: faListAlt, 
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          label: '普通'
        };
    }
  };

  // 按日期分组计划
  const groupPlansByDate = (plans) => {
    const groups = {};
    
    plans.forEach(plan => {
      const date = parseISO(plan.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date,
          plans: []
        };
      }
      
      groups[dateKey].plans.push(plan);
    });
    
    // 转换为数组并按日期排序（最新的日期在前）
    return Object.values(groups).sort((a, b) => b.date - a.date);
  };

  // 格式化日期显示
  const formatDateHeader = (date) => {
    if (isToday(date)) {
      return '今天';
    } else if (isYesterday(date)) {
      return '昨天';
    } else {
      return format(date, 'MM月dd日');
    }
  };

  // 按日期分组的计划
  const groupedPlans = groupPlansByDate(filteredPlans);

  // 日期选择器 - 快速选择日期
  const QuickDateSelector = () => {
    const dates = [
      { label: '今天', date: new Date() },
      { label: '明天', date: addDays(new Date(), 1) },
      { label: '后天', date: addDays(new Date(), 2) },
    ];

    return (
      <div className="flex space-x-2 mb-4">
        {dates.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setSelectedDate(item.date)}
            className={`px-3 py-1 rounded-full text-sm ${
              isSameDay(selectedDate, item.date)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const datePicker = document.getElementById('date-picker');
            if (datePicker) {
              datePicker.showPicker();
            }
          }}
          className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm flex items-center"
        >
          <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
          自定义
        </button>
      </div>
    );
  };

  // 常用分类标签
  const commonCategories = ['工作', '学习', '健康', '生活', '其他'];

  // 浮动模式下的快速创建计划表单
  if (isFloatingMode) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 animate__animated animate__zoomIn">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">新建计划</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 animate__animated animate__fadeIn" role="alert">
            <span className="block sm:inline">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        )}
        
        <form onSubmit={handleAddPlan}>
          {/* 计划内容 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              计划内容 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              placeholder="请输入计划内容..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>
          
          {/* 日期选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              计划日期
            </label>
            <div className="flex flex-col space-y-2">
              <QuickDateSelector />
              <input
                id="date-picker"
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* 优先级选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              优先级
            </label>
            <div className="flex space-x-2">
              {[0, 1, 2].map((level) => {
                const info = getPriorityInfo(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center ${
                      priority === level
                        ? `${info.bgColor} ${info.color} border border-${info.color.replace('text-', '')}`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FontAwesomeIcon icon={info.icon} className="mr-2" />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* 分类标签 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分类标签
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {commonCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    category === cat
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="输入或选择分类标签"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 提交按钮 */}
          <div className="flex justify-end space-x-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                取消
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
              disabled={isLoading || !newPlan.trim()}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
              ) : (
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
              )}
              创建计划
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 bg-gray-50">
      {/* 标题 */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faListAlt} className="mr-2" />
          计划管理
        </h1>
        <p className="text-gray-600">制定计划，坚持执行</p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 animate__animated animate__fadeIn" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={() => setError(null)}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* 添加计划按钮 */}
      <div className="mb-6 animate__animated animate__fadeIn">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center transition-colors duration-300"
          disabled={isLoading}
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          新建计划
        </button>
      </div>

      {/* 过滤器 */}
      <div className="flex justify-center mb-6 animate__animated animate__fadeIn">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
              filterStatus === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setFilterStatus('all')}
          >
            全部
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              filterStatus === 'pending' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setFilterStatus('pending')}
          >
            待完成
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
              filterStatus === 'completed' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setFilterStatus('completed')}
          >
            已完成
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && plans.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* 计划为空提示 */}
      {!isLoading && filteredPlans.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faListAlt} className="text-5xl mb-4" />
          <p>暂无{filterStatus === 'completed' ? '已完成' : filterStatus === 'pending' ? '待完成' : ''}计划</p>
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="mt-2 text-blue-500 hover:underline"
            >
              查看全部计划
            </button>
          )}
        </div>
      )}

      {/* 按日期分组的计划列表 */}
      <div className="flex-grow overflow-auto animate__animated animate__fadeIn">
        {groupedPlans.map((group, groupIndex) => (
          <div key={format(group.date, 'yyyy-MM-dd')} className="mb-6">
            {/* 日期标题 */}
            <div className="flex items-center mb-3 sticky top-0 bg-gray-50 py-2 z-10">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 shadow-md">
                <FontAwesomeIcon icon={faCalendarDay} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">
                {formatDateHeader(group.date)}
              </h2>
            </div>
            
            {/* 当日计划列表 */}
            <div className="space-y-3 pl-12">
              {group.plans.map(plan => {
                const priorityInfo = getPriorityInfo(plan.priority);
                
                return (
                  <div 
                    key={plan.id} 
                    className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${
                      plan.completed ? 'border-green-500' : 
                      plan.priority === 2 ? 'border-red-500' : 
                      plan.priority === 1 ? 'border-yellow-500' : 
                      'border-blue-500'
                    } transition-all duration-300 hover:shadow-md animate__animated animate__fadeIn`}
                  >
                    {editingPlan && editingPlan.id === plan.id ? (
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={editingPlan.title}
                          onChange={(e) => setEditingPlan({...editingPlan, title: e.target.value})}
                          className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex ml-2">
                          <button
                            onClick={saveEditPlan}
                            className="px-3 py-1 bg-green-500 text-white rounded-lg mr-2 hover:bg-green-600"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEditPlan}
                            className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <button
                          onClick={() => togglePlanStatus(plan.id, plan.completed)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                            plan.completed 
                              ? 'bg-green-500 text-white' 
                              : 'border-2 border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {plan.completed && <FontAwesomeIcon icon={faCheckCircle} />}
                        </button>
                        
                        <div className="flex-grow">
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full ${priorityInfo.bgColor} ${priorityInfo.color} flex items-center justify-center mr-2`}>
                              <FontAwesomeIcon icon={priorityInfo.icon} />
                            </div>
                            <span className={`font-medium ${plan.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                              {plan.title}
                            </span>
                            {plan.category && plan.category !== '未分类' && (
                              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                {plan.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(plan.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                        
                        <div className="flex">
                          <button
                            onClick={() => startEditPlan(plan)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-blue-500"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-red-500"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 新建计划模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate__animated animate__fadeIn">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 animate__animated animate__zoomIn">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">新建计划</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleAddPlan}>
              {/* 计划内容 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  计划内容 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  placeholder="请输入计划内容..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              {/* 日期选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  计划日期
                </label>
                <div className="flex flex-col space-y-2">
                  <QuickDateSelector />
                  <input
                    id="date-picker"
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* 优先级选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  优先级
                </label>
                <div className="flex space-x-2">
                  {[0, 1, 2].map((level) => {
                    const info = getPriorityInfo(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setPriority(level)}
                        className={`flex-1 py-2 rounded-lg flex items-center justify-center ${
                          priority === level
                            ? `${info.bgColor} ${info.color} border border-${info.color.replace('text-', '')}`
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <FontAwesomeIcon icon={info.icon} className="mr-2" />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* 分类标签 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分类标签
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {commonCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        category === cat
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="输入或选择分类标签"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* 提交按钮 */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                  disabled={isLoading || !newPlan.trim()}
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                  ) : (
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  )}
                  创建计划
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plan;