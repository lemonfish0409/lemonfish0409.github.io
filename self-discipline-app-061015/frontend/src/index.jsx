import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { library } from '@fortawesome/fontawesome-svg-core';
import { 
  faListAlt, faClock, faChartBar, faUser, faCheckCircle, 
  faPlus, faTrash, faEdit, faStar, faExclamationCircle, 
  faPlay, faPause, faRedo, faCog, faBell, faCalendarAlt 
} from '@fortawesome/free-solid-svg-icons';

// 注册FontAwesome图标
library.add(
  faListAlt, faClock, faChartBar, faUser, faCheckCircle, 
  faPlus, faTrash, faEdit, faStar, faExclamationCircle, 
  faPlay, faPause, faRedo, faCog, faBell, faCalendarAlt
);

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  // 防止错误冒泡
  event.preventDefault();
});

// 处理未捕获的Promise异常
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise异常:', event.reason);
  // 防止错误冒泡
  event.preventDefault();
});

// 创建React根元素
const root = ReactDOM.createRoot(document.getElementById('root'));

// 渲染应用
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);