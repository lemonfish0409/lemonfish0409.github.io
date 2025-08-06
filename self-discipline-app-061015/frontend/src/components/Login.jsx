import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faSignInAlt, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import 'animate.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // 检查是否已登录
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // 如果已登录，重定向到之前的页面或默认页面
      const from = location.state?.from || '/plan';
      navigate(from, { replace: true });
    }
  }, [navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 表单验证
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // 发送登录请求
      const response = await axios.post('/login', {
        username,
        password
      });
      
      // 登录成功，保存token和用户信息
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify({
        id: response.data.id,
        username: response.data.username
      }));
      
      // 重定向到之前的页面或默认页面
      const from = location.state?.from || '/plan';
      navigate(from, { replace: true });
    } catch (err) {
      // 处理登录错误
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('登录失败，请稍后再试');
      }
      console.error('登录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-900 to-black p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden animate__animated animate__fadeIn">
        <div className="bg-blue-600 p-6 text-center">
          <h2 className="text-2xl font-bold text-white">自律应用</h2>
          <p className="text-blue-100 mt-1">提升时间管理能力和自律性</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 animate__animated animate__headShake">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faExclamationCircle} className="mr-2" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">
              用户名
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faUser} className="text-gray-400" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入用户名 (如: user1)"
                autoComplete="username"
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faLock} className="text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入密码 (默认: 123456)"
                autoComplete="current-password"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <FontAwesomeIcon icon={faSignInAlt} className="mr-2" />
              )}
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <p className="mb-1"><strong>测试账号:</strong> user1 至 user10</p>
            <p><strong>默认密码:</strong> 123456</p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-white text-sm">
        <p>&copy; 2025 自律应用 - 版权所有</p>
      </div>
    </div>
  );
};

export default Login;