import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListAlt, faClock, faChartBar, faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import 'animate.css';

// 导入组件
import Plan from './components/Plan';
import Focus from './components/Focus';
import Stats from './components/Stats';
import Test from './components/Test';

// 全局错误处理
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 添加全局未捕获异常处理
    const handleError = (error, info) => {
      console.error('应用发生错误:', error, info);
      setError(error.toString());
      setHasError(true);
    };

    window.addEventListener('error', (event) => {
      handleError(event.error || new Error('未知前端错误'));
      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event) => {
      handleError(event.reason || new Error('未处理的Promise拒绝'));
      event.preventDefault();
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">应用出错了</h2>
          <p className="text-gray-700 mb-4">很抱歉，应用发生了错误。请尝试刷新页面或联系支持团队。</p>
          <div className="bg-gray-100 p-3 rounded overflow-auto max-h-40 mb-4">
            <code className="text-sm text-red-500">{error}</code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// 导航栏组件
const NavBar = () => {
  const location = useLocation();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center h-16">
        <Link 
          to="/plan" 
          className={`flex flex-col items-center justify-center w-1/4 h-full ${
            location.pathname === '/plan' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <FontAwesomeIcon icon={faListAlt} className="text-xl" />
          <span className="text-xs mt-1">计划</span>
        </Link>
        <Link 
          to="/focus" 
          className={`flex flex-col items-center justify-center w-1/4 h-full ${
            location.pathname === '/focus' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <FontAwesomeIcon icon={faClock} className="text-xl" />
          <span className="text-xs mt-1">专注</span>
        </Link>
        <Link 
          to="/stats" 
          className={`flex flex-col items-center justify-center w-1/4 h-full ${
            location.pathname === '/stats' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <FontAwesomeIcon icon={faChartBar} className="text-xl" />
          <span className="text-xs mt-1">统计</span>
        </Link>
        <Link 
          to="/test" 
          className={`flex flex-col items-center justify-center w-1/4 h-full ${
            location.pathname === '/test' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <FontAwesomeIcon icon={faClipboardCheck} className="text-xl" />
          <span className="text-xs mt-1">测试</span>
        </Link>
      </div>
    </div>
  );
};

// 主应用组件
const App = () => {
  // 确保TailwindCSS和animate.css加载
  useEffect(() => {
    // 加载TailwindCSS
    const tailwindLink = document.createElement('link');
    tailwindLink.rel = 'stylesheet';
    tailwindLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css';
    document.head.appendChild(tailwindLink);
    
    // 加载animate.css
    const animateLink = document.createElement('link');
    animateLink.rel = 'stylesheet';
    animateLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css';
    document.head.appendChild(animateLink);
    
    // 初始化本地存储
    if (!localStorage.getItem('plans_data')) {
      localStorage.setItem('plans_data', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('focus_sessions')) {
      localStorage.setItem('focus_sessions', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('tests_data')) {
      localStorage.setItem('tests_data', JSON.stringify([]));
    }
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <div className="flex flex-col h-screen bg-gray-100">
          <Routes>
            <Route 
              path="/" 
              element={<Navigate to="/plan" replace />} 
            />
            <Route 
              path="/plan" 
              element={
                <div className="flex-grow overflow-auto pb-16">
                  <Plan />
                  <NavBar />
                </div>
              } 
            />
            <Route 
              path="/focus" 
              element={
                <div className="flex-grow overflow-auto pb-16">
                  <Focus />
                  <NavBar />
                </div>
              } 
            />
            <Route 
              path="/stats" 
              element={
                <div className="flex-grow overflow-auto pb-16">
                  <Stats />
                  <NavBar />
                </div>
              } 
            />
            <Route 
              path="/test" 
              element={
                <div className="flex-grow overflow-auto pb-16">
                  <Test />
                  <NavBar />
                </div>
              } 
            />
            <Route path="*" element={<Navigate to="/plan" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;