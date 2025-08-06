import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faClipboardCheck, faPlus, faEdit, faTrash, 
  faCalculator, faCheckCircle, faTimes 
} from '@fortawesome/free-solid-svg-icons';
import 'animate.css';

const Test = () => {
  // 状态管理
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testToDelete, setTestToDelete] = useState(null);
  
  // 新建测试表单状态
  const [newTest, setNewTest] = useState({
    name: '',
    total_questions: '',
    correct_answers: ''
  });

  // 获取测试列表
  const fetchTests = () => {
    setIsLoading(true);
    try {
      // 从localStorage获取测试数据
      const testsData = JSON.parse(localStorage.getItem('tests_data') || '[]');
      setTests(testsData);
      setError(null);
    } catch (err) {
      console.error('获取测试列表失败:', err);
      setError('获取测试列表失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  // 保存测试数据到localStorage
  const saveTestsToLocalStorage = (testsData) => {
    localStorage.setItem('tests_data', JSON.stringify(testsData));
  };

  // 新建测试
  const handleAddTest = (e) => {
    e.preventDefault();
    
    if (!newTest.name.trim()) {
      setError('测试名称不能为空');
      return;
    }
    
    if (!newTest.total_questions || parseInt(newTest.total_questions) < 0) {
      setError('总题数必须为非负数');
      return;
    }
    
    if (!newTest.correct_answers || parseInt(newTest.correct_answers) < 0) {
      setError('正确题数必须为非负数');
      return;
    }
    
    if (parseInt(newTest.correct_answers) > parseInt(newTest.total_questions)) {
      setError('正确题数不能大于总题数');
      return;
    }

    try {
      setIsLoading(true);
      
      // 创建新测试对象
      const totalQuestions = parseInt(newTest.total_questions);
      const correctAnswers = parseInt(newTest.correct_answers);
      const newTestData = {
        id: Date.now().toString(), // 使用时间戳作为唯一ID
        name: newTest.name,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
        created_at: new Date().toISOString()
      };
      
      // 更新状态和localStorage
      const updatedTests = [newTestData, ...tests];
      setTests(updatedTests);
      saveTestsToLocalStorage(updatedTests);
      
      setNewTest({ name: '', total_questions: '', correct_answers: '' });
      setShowAddModal(false);
      setError(null);
    } catch (err) {
      console.error('创建测试失败:', err);
      setError('创建测试失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 开始编辑测试
  const startEditTest = (test) => {
    setEditingTest({
      ...test,
      total_questions: test.total_questions.toString(),
      correct_answers: test.correct_answers.toString()
    });
  };

  // 保存编辑后的测试
  const saveEditTest = () => {
    if (!editingTest.total_questions || parseInt(editingTest.total_questions) < 0) {
      setError('总题数必须为非负数');
      return;
    }
    
    if (!editingTest.correct_answers || parseInt(editingTest.correct_answers) < 0) {
      setError('正确题数必须为非负数');
      return;
    }
    
    if (parseInt(editingTest.correct_answers) > parseInt(editingTest.total_questions)) {
      setError('正确题数不能大于总题数');
      return;
    }

    try {
      setIsLoading(true);
      
      const totalQuestions = parseInt(editingTest.total_questions);
      const correctAnswers = parseInt(editingTest.correct_answers);
      
      // 更新测试数据
      const updatedTest = {
        ...editingTest,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
      };
      
      // 更新状态和localStorage
      const updatedTests = tests.map(test => 
        test.id === editingTest.id ? updatedTest : test
      );
      
      setTests(updatedTests);
      saveTestsToLocalStorage(updatedTests);
      setEditingTest(null);
      setError(null);
    } catch (err) {
      console.error('更新测试失败:', err);
      setError('更新测试失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 取消编辑
  const cancelEditTest = () => {
    setEditingTest(null);
  };

  // 确认删除测试
  const confirmDeleteTest = (test) => {
    setTestToDelete(test);
    setShowDeleteConfirm(true);
  };

  // 删除测试
  const deleteTest = () => {
    if (!testToDelete) return;
    
    try {
      setIsLoading(true);
      
      // 更新状态和localStorage
      const updatedTests = tests.filter(test => test.id !== testToDelete.id);
      setTests(updatedTests);
      saveTestsToLocalStorage(updatedTests);
      
      setShowDeleteConfirm(false);
      setTestToDelete(null);
    } catch (err) {
      console.error('删除测试失败:', err);
      setError('删除测试失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 计算总体统计
  const calculateOverallStats = () => {
    if (tests.length === 0) return { totalTests: 0, totalQuestions: 0, totalCorrect: 0, overallAccuracy: 0 };
    
    const totalTests = tests.length;
    const totalQuestions = tests.reduce((sum, test) => sum + test.total_questions, 0);
    const totalCorrect = tests.reduce((sum, test) => sum + test.correct_answers, 0);
    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    return { totalTests, totalQuestions, totalCorrect, overallAccuracy };
  };

  const overallStats = calculateOverallStats();

  return (
    <div className="flex flex-col h-full p-4 bg-gray-50">
      {/* 标题 */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faClipboardCheck} className="mr-2" />
          测试记录
        </h1>
        <p className="text-gray-600">记录测试成绩，追踪学习进度</p>
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

      {/* 总体统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate__animated animate__fadeIn">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-blue-600">{overallStats.totalTests}</div>
          <div className="text-sm text-gray-600">总测试数</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-green-600">{overallStats.totalQuestions}</div>
          <div className="text-sm text-gray-600">总题数</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-purple-600">{overallStats.totalCorrect}</div>
          <div className="text-sm text-gray-600">正确题数</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-orange-600">{overallStats.overallAccuracy}%</div>
          <div className="text-sm text-gray-600">总正确率</div>
        </div>
      </div>

      {/* 新建测试按钮 */}
      <div className="mb-6 animate__animated animate__fadeIn">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center transition-colors duration-300"
          disabled={isLoading}
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          新建测试
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading && tests.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* 测试为空提示 */}
      {!isLoading && tests.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faClipboardCheck} className="text-5xl mb-4" />
          <p>暂无测试记录</p>
          <p className="text-sm mt-2">点击上方按钮创建您的第一个测试吧！</p>
        </div>
      )}

      {/* 测试列表 */}
      <div className="flex-grow overflow-auto animate__animated animate__fadeIn">
        <div className="space-y-3">
          {tests.map(test => (
            <div 
              key={test.id} 
              className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 transition-all duration-300 hover:shadow-md"
            >
              {editingTest && editingTest.id === test.id ? (
                <div className="space-y-3">
                  <div className="font-medium text-gray-800">{test.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">总题数</label>
                      <input
                        type="number"
                        value={editingTest.total_questions}
                        onChange={(e) => setEditingTest({...editingTest, total_questions: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">正确题数</label>
                      <input
                        type="number"
                        value={editingTest.correct_answers}
                        onChange={(e) => setEditingTest({...editingTest, correct_answers: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={saveEditTest}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEditTest}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-grow">
                    <div className="flex items-center mb-2">
                      <h3 className="font-medium text-gray-800 mr-3">{test.name}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.accuracy >= 90 ? 'bg-green-100 text-green-800' :
                        test.accuracy >= 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {test.accuracy}%
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-4">
                        <FontAwesomeIcon icon={faCalculator} className="mr-1" />
                        总题数: {test.total_questions}
                      </span>
                      <span className="mr-4">
                        <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                        正确: {test.correct_answers}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(test.created_at).toLocaleDateString()} {new Date(test.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditTest(test)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-blue-500"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      onClick={() => confirmDeleteTest(test)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-red-500"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 新建测试模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate__animated animate__fadeIn">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 animate__animated animate__zoomIn">
            <h2 className="text-xl font-bold mb-4">新建测试</h2>
            <form onSubmit={handleAddTest}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">测试名称</label>
                <input
                  type="text"
                  value={newTest.name}
                  onChange={(e) => setNewTest({...newTest, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入测试名称"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">总题数</label>
                <input
                  type="number"
                  value={newTest.total_questions}
                  onChange={(e) => setNewTest({...newTest, total_questions: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入总题数"
                  min="0"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">正确题数</label>
                <input
                  type="number"
                  value={newTest.correct_answers}
                  onChange={(e) => setNewTest({...newTest, correct_answers: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入正确题数"
                  min="0"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewTest({ name: '', total_questions: '', correct_answers: '' });
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  {isLoading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {showDeleteConfirm && testToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate__animated animate__fadeIn">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 animate__animated animate__zoomIn">
            <h2 className="text-xl font-bold mb-4">确认删除</h2>
            <p className="mb-6">确定要删除测试 "{testToDelete.name}" 吗？此操作不可撤销，且会影响统计数据。</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTestToDelete(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                取消
              </button>
              <button
                onClick={deleteTest}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              >
                {isLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Test;