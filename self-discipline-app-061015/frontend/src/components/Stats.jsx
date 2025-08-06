import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartBar, faCalendarAlt, faCheckCircle, faClock, 
  faClipboardCheck, faPercent, faQuestionCircle, 
  faChartPie, faChartLine, faCalendarDay, faCalendarWeek, faCalendarCheck,
  faHourglassHalf, faListAlt, faCalendarCheck as faCalendarDone
} from '@fortawesome/free-solid-svg-icons';
import Chart from 'chart.js/auto';
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval, addDays, parseISO } from 'date-fns';
import 'animate.css';

const Stats = () => {
  const [stats, setStats] = useState([]);
  const [period, setPeriod] = useState('week'); // 'day', 'week', 'month'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testStats, setTestStats] = useState({
    total_tests: 0,
    total_questions: 0,
    correct_answers: 0,
    avg_accuracy: 0
  });
  const [focusDistribution, setFocusDistribution] = useState({
    labels: ['0-15分钟', '15-30分钟', '30-60分钟', '1-2小时', '2小时以上'],
    data: [0, 0, 0, 0, 0]
  });
  const [weekdayDistribution, setWeekdayDistribution] = useState({
    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    data: [0, 0, 0, 0, 0, 0, 0]
  });
  const [timePeriodDistribution, setTimePeriodDistribution] = useState({
    labels: ['凌晨(00:00-06:00)', '上午(06:00-12:00)', '下午(12:00-18:00)', '晚上(18:00-24:00)'],
    data: [0, 0, 0, 0]
  });
  
  const focusChartRef = useRef(null);
  const plansChartRef = useRef(null);
  const testChartRef = useRef(null);
  const focusDistributionChartRef = useRef(null);
  const weekdayDistributionChartRef = useRef(null);
  const timePeriodDistributionChartRef = useRef(null);
  const focusChartInstance = useRef(null);
  const plansChartInstance = useRef(null);
  const testChartInstance = useRef(null);
  const focusDistributionChartInstance = useRef(null);
  const weekdayDistributionChartInstance = useRef(null);
  const timePeriodDistributionChartInstance = useRef(null);

  // 计算实际专注时长（秒）
  const calculateActualFocusTime = (session) => {
    if (!session.start_time || !session.end_time) return 0;
    
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);
    
    // 计算实际时长（毫秒转秒）
    const actualDuration = Math.round((endTime - startTime) / 1000);
    
    // 确保时长为正数
    return Math.max(0, actualDuration);
  };

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // 从localStorage获取数据
        const fetchStatsFromLocalStorage = () => {
          // 获取计划数据
          const plansData = JSON.parse(localStorage.getItem('plans_data') || '[]');
          
          // 获取专注数据
          const focusSessions = JSON.parse(localStorage.getItem('focus_sessions') || '[]');
          
          // 获取测试数据
          const testsData = JSON.parse(localStorage.getItem('tests_data') || '[]');
          
          // 根据选择的时间段过滤数据
          const now = new Date();
          let startDate;
          
          if (period === 'day') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
          } else if (period === 'week') {
            startDate = subDays(now, 7);
          } else if (period === 'month') {
            startDate = subDays(now, 30);
          }
          
          // 按日期分组统计数据
          const dateMap = new Map();
          
          // 处理日期范围内的每一天
          for (let i = 0; i <= (period === 'day' ? 0 : period === 'week' ? 7 : 30); i++) {
            const currentDate = subDays(new Date(), i);
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            
            dateMap.set(dateStr, {
              date: dateStr,
              focus_time: 0,
              completed_plans: 0,
              plans_with_focus: 0, // 新增：有专注时间的计划数
              test_count: 0,
              test_total_questions: 0,
              test_correct_answers: 0
            });
          }
          
          // 统计计划数据
          plansData.forEach(plan => {
            const planDate = format(new Date(plan.created_at), 'yyyy-MM-dd');
            if (dateMap.has(planDate) && plan.completed) {
              const dayData = dateMap.get(planDate);
              dayData.completed_plans += 1;
              dateMap.set(planDate, dayData);
            }
          });
          
          // 统计专注数据 - 使用实际专注时长
          const plansWithFocus = new Set(); // 用于记录有专注时间的计划ID
          
          focusSessions.forEach(session => {
            if (!session.end_time) return; // 跳过未完成的会话
            
            const sessionDate = format(new Date(session.start_time), 'yyyy-MM-dd');
            if (dateMap.has(sessionDate)) {
              const dayData = dateMap.get(sessionDate);
              // 使用实际专注时长
              const actualFocusTime = calculateActualFocusTime(session);
              dayData.focus_time += actualFocusTime;
              
              // 记录有专注时间的计划
              if (session.plan_id && !plansWithFocus.has(session.plan_id)) {
                plansWithFocus.add(session.plan_id);
                dayData.plans_with_focus += 1;
              }
              
              dateMap.set(sessionDate, dayData);
            }
          });
          
          // 统计测试数据
          testsData.forEach(test => {
            const testDate = format(new Date(test.created_at), 'yyyy-MM-dd');
            if (dateMap.has(testDate)) {
              const dayData = dateMap.get(testDate);
              dayData.test_count += 1;
              dayData.test_total_questions += test.total_questions;
              dayData.test_correct_answers += test.correct_answers;
              dateMap.set(testDate, dayData);
            }
          });
          
          // 计算测试统计数据
          const totalTests = testsData.length;
          const totalQuestions = testsData.reduce((sum, test) => sum + test.total_questions, 0);
          const correctAnswers = testsData.reduce((sum, test) => sum + test.correct_answers, 0);
          const avgAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
          
          // 计算专注时长分布
          const focusTimeDistribution = [0, 0, 0, 0, 0]; // [0-15分钟, 15-30分钟, 30-60分钟, 1-2小时, 2小时以上]
          
          focusSessions.forEach(session => {
            if (!session.end_time) return;
            
            const actualFocusTime = calculateActualFocusTime(session);
            const focusMinutes = Math.floor(actualFocusTime / 60);
            
            if (focusMinutes < 15) {
              focusTimeDistribution[0]++;
            } else if (focusMinutes < 30) {
              focusTimeDistribution[1]++;
            } else if (focusMinutes < 60) {
              focusTimeDistribution[2]++;
            } else if (focusMinutes < 120) {
              focusTimeDistribution[3]++;
            } else {
              focusTimeDistribution[4]++;
            }
          });
          
          // 计算每周几的专注分布
          const weekdayDistribution = [0, 0, 0, 0, 0, 0, 0]; // [周一, 周二, 周三, 周四, 周五, 周六, 周日]
          
          focusSessions.forEach(session => {
            if (!session.end_time) return;
            
            const sessionDate = new Date(session.start_time);
            // getDay(): 0是周日，1是周一，所以需要调整
            const weekday = sessionDate.getDay();
            const adjustedWeekday = weekday === 0 ? 6 : weekday - 1; // 调整为[0-6]表示周一到周日
            
            weekdayDistribution[adjustedWeekday]++;
          });
          
          // 计算时间段分布
          const timePeriodDist = [0, 0, 0, 0]; // [凌晨, 上午, 下午, 晚上]
          
          focusSessions.forEach(session => {
            if (!session.end_time) return;
            
            const sessionDate = new Date(session.start_time);
            const hour = sessionDate.getHours();
            
            if (hour >= 0 && hour < 6) {
              timePeriodDist[0]++;
            } else if (hour >= 6 && hour < 12) {
              timePeriodDist[1]++;
            } else if (hour >= 12 && hour < 18) {
              timePeriodDist[2]++;
            } else {
              timePeriodDist[3]++;
            }
          });
          
          // 转换为数组并按日期排序
          const statsArray = Array.from(dateMap.values()).sort((a, b) => 
            new Date(b.date) - new Date(a.date)
          );
          
          return {
            stats: statsArray,
            testStats: {
              total_tests: totalTests,
              total_questions: totalQuestions,
              correct_answers: correctAnswers,
              avg_accuracy: avgAccuracy
            },
            focusDistribution: {
              labels: ['0-15分钟', '15-30分钟', '30-60分钟', '1-2小时', '2小时以上'],
              data: focusTimeDistribution
            },
            weekdayDistribution: {
              labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
              data: weekdayDistribution
            },
            timePeriodDistribution: {
              labels: ['凌晨(00:00-06:00)', '上午(06:00-12:00)', '下午(12:00-18:00)', '晚上(18:00-24:00)'],
              data: timePeriodDist
            }
          };
        };
        
        const { 
          stats: statsData, 
          testStats: testStatsData, 
          focusDistribution: focusDistData,
          weekdayDistribution: weekdayDistData,
          timePeriodDistribution: timePeriodDistData
        } = fetchStatsFromLocalStorage();
        
        setStats(statsData);
        setTestStats(testStatsData);
        setFocusDistribution(focusDistData);
        setWeekdayDistribution(weekdayDistData);
        setTimePeriodDistribution(timePeriodDistData);
        setError(null);
      } catch (err) {
        console.error('获取统计数据失败:', err);
        setError('获取统计数据失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  // 监听专注记录变化，实时更新统计数据
  useEffect(() => {
    const handleStorageChange = () => {
      // 重新获取统计数据
      fetchStats();
    };

    // 监听localStorage变化
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      
      // 如果是专注记录或其他相关数据变化，触发更新
      if (key === 'focus_sessions' || key === 'plans_data' || key === 'tests_data') {
        setTimeout(handleStorageChange, 100); // 延迟执行避免重复调用
      }
    };

    // 清理函数
    return () => {
      localStorage.setItem = originalSetItem;
    };
  }, []);

  // 手动获取统计数据的函数
  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const fetchStatsFromLocalStorage = () => {
        const plansData = JSON.parse(localStorage.getItem('plans_data') || '[]');
        const focusSessions = JSON.parse(localStorage.getItem('focus_sessions') || '[]');
        const testsData = JSON.parse(localStorage.getItem('tests_data') || '[]');
        
        const now = new Date();
        let startDate;
        
        if (period === 'day') {
          startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (period === 'week') {
          startDate = subDays(now, 7);
        } else if (period === 'month') {
          startDate = subDays(now, 30);
        }
        
        const dateMap = new Map();
        
        for (let i = 0; i <= (period === 'day' ? 0 : period === 'week' ? 7 : 30); i++) {
          const currentDate = subDays(new Date(), i);
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          
          dateMap.set(dateStr, {
            date: dateStr,
            focus_time: 0,
            completed_plans: 0,
            plans_with_focus: 0, // 新增：有专注时间的计划数
            test_count: 0,
            test_total_questions: 0,
            test_correct_answers: 0
          });
        }
        
        // 统计计划数据
        plansData.forEach(plan => {
          const planDate = format(new Date(plan.created_at), 'yyyy-MM-dd');
          if (dateMap.has(planDate) && plan.completed) {
            const dayData = dateMap.get(planDate);
            dayData.completed_plans += 1;
            dateMap.set(planDate, dayData);
          }
        });
        
        // 统计专注数据 - 使用实际专注时长
        const plansWithFocus = new Set(); // 用于记录有专注时间的计划ID
        
        focusSessions.forEach(session => {
          if (!session.end_time) return;
          
          const sessionDate = format(new Date(session.start_time), 'yyyy-MM-dd');
          if (dateMap.has(sessionDate)) {
            const dayData = dateMap.get(sessionDate);
            const actualFocusTime = calculateActualFocusTime(session);
            dayData.focus_time += actualFocusTime;
            
            // 记录有专注时间的计划
            if (session.plan_id && !plansWithFocus.has(session.plan_id)) {
              plansWithFocus.add(session.plan_id);
              dayData.plans_with_focus += 1;
            }
            
            dateMap.set(sessionDate, dayData);
          }
        });
        
        // 统计测试数据
        testsData.forEach(test => {
          const testDate = format(new Date(test.created_at), 'yyyy-MM-dd');
          if (dateMap.has(testDate)) {
            const dayData = dateMap.get(testDate);
            dayData.test_count += 1;
            dayData.test_total_questions += test.total_questions;
            dayData.test_correct_answers += test.correct_answers;
            dateMap.set(testDate, dayData);
          }
        });
        
        // 计算测试统计数据
        const totalTests = testsData.length;
        const totalQuestions = testsData.reduce((sum, test) => sum + test.total_questions, 0);
        const correctAnswers = testsData.reduce((sum, test) => sum + test.correct_answers, 0);
        const avgAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        
        // 计算专注时长分布
        const focusTimeDistribution = [0, 0, 0, 0, 0]; // [0-15分钟, 15-30分钟, 30-60分钟, 1-2小时, 2小时以上]
        
        focusSessions.forEach(session => {
          if (!session.end_time) return;
          
          const actualFocusTime = calculateActualFocusTime(session);
          const focusMinutes = Math.floor(actualFocusTime / 60);
          
          if (focusMinutes < 15) {
            focusTimeDistribution[0]++;
          } else if (focusMinutes < 30) {
            focusTimeDistribution[1]++;
          } else if (focusMinutes < 60) {
            focusTimeDistribution[2]++;
          } else if (focusMinutes < 120) {
            focusTimeDistribution[3]++;
          } else {
            focusTimeDistribution[4]++;
          }
        });
        
        // 计算每周几的专注分布
        const weekdayDistribution = [0, 0, 0, 0, 0, 0, 0]; // [周一, 周二, 周三, 周四, 周五, 周六, 周日]
        
        focusSessions.forEach(session => {
          if (!session.end_time) return;
          
          const sessionDate = new Date(session.start_time);
          // getDay(): 0是周日，1是周一，所以需要调整
          const weekday = sessionDate.getDay();
          const adjustedWeekday = weekday === 0 ? 6 : weekday - 1; // 调整为[0-6]表示周一到周日
          
          weekdayDistribution[adjustedWeekday]++;
        });
        
        // 计算时间段分布
        const timePeriodDist = [0, 0, 0, 0]; // [凌晨, 上午, 下午, 晚上]
        
        focusSessions.forEach(session => {
          if (!session.end_time) return;
          
          const sessionDate = new Date(session.start_time);
          const hour = sessionDate.getHours();
          
          if (hour >= 0 && hour < 6) {
            timePeriodDist[0]++;
          } else if (hour >= 6 && hour < 12) {
            timePeriodDist[1]++;
          } else if (hour >= 12 && hour < 18) {
            timePeriodDist[2]++;
          } else {
            timePeriodDist[3]++;
          }
        });
        
        const statsArray = Array.from(dateMap.values()).sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        
        return {
          stats: statsArray,
          testStats: {
            total_tests: totalTests,
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            avg_accuracy: avgAccuracy
          },
          focusDistribution: {
            labels: ['0-15分钟', '15-30分钟', '30-60分钟', '1-2小时', '2小时以上'],
            data: focusTimeDistribution
          },
          weekdayDistribution: {
            labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
            data: weekdayDistribution
          },
          timePeriodDistribution: {
            labels: ['凌晨(00:00-06:00)', '上午(06:00-12:00)', '下午(12:00-18:00)', '晚上(18:00-24:00)'],
            data: timePeriodDist
          }
        };
      };
      
      const { 
        stats: statsData, 
        testStats: testStatsData,
        focusDistribution: focusDistData,
        weekdayDistribution: weekdayDistData,
        timePeriodDistribution: timePeriodDistData
      } = fetchStatsFromLocalStorage();
      
      setStats(statsData);
      setTestStats(testStatsData);
      setFocusDistribution(focusDistData);
      setWeekdayDistribution(weekdayDistData);
      setTimePeriodDistribution(timePeriodDistData);
      setError(null);
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError('获取统计数据失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染图表
  useEffect(() => {
    if (!isLoading && stats.length > 0) {
      renderCharts();
    }
  }, [stats, isLoading, focusDistribution, weekdayDistribution, timePeriodDistribution]);

  // 清理图表实例
  useEffect(() => {
    return () => {
      if (focusChartInstance.current) {
        focusChartInstance.current.destroy();
      }
      if (plansChartInstance.current) {
        plansChartInstance.current.destroy();
      }
      if (testChartInstance.current) {
        testChartInstance.current.destroy();
      }
      if (focusDistributionChartInstance.current) {
        focusDistributionChartInstance.current.destroy();
      }
      if (weekdayDistributionChartInstance.current) {
        weekdayDistributionChartInstance.current.destroy();
      }
      if (timePeriodDistributionChartInstance.current) {
        timePeriodDistributionChartInstance.current.destroy();
      }
    };
  }, []);

  // 渲染图表的函数
  const renderCharts = () => {
    // 准备数据
    const dates = stats.map(item => format(new Date(item.date), 'MM/dd')).reverse();
    const focusTimes = stats.map(item => Math.round(item.focus_time / 60)).reverse(); // 转换为分钟
    const completedPlans = stats.map(item => item.completed_plans).reverse();
    const plansWithFocus = stats.map(item => item.plans_with_focus || 0).reverse(); // 有专注时间的计划
    
    // 测试数据
    const testCounts = stats.map(item => item.test_count || 0).reverse();
    const testAccuracy = stats.map(item => {
      if (!item.test_total_questions || item.test_total_questions === 0) return 0;
      return Math.round((item.test_correct_answers / item.test_total_questions) * 100);
    }).reverse();

    // 渲染专注时间图表
    if (focusChartRef.current) {
      if (focusChartInstance.current) {
        focusChartInstance.current.destroy();
      }

      focusChartInstance.current = new Chart(focusChartRef.current, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: '实际专注时间 (分钟)',
            data: focusTimes,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function(context) {
                  return `实际专注时间: ${context.parsed.y} 分钟`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '分钟'
              }
            }
          }
        }
      });
    }

    // 渲染完成计划图表
    if (plansChartRef.current) {
      if (plansChartInstance.current) {
        plansChartInstance.current.destroy();
      }

      plansChartInstance.current = new Chart(plansChartRef.current, {
        type: 'bar',
        data: {
          labels: dates,
          datasets: [
            {
              label: '完成计划数',
              data: completedPlans,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 2
            },
            {
              label: '有专注时间的计划',
              data: plansWithFocus,
              backgroundColor: 'rgba(153, 102, 255, 0.2)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            tooltip: {
              mode: 'index',
              intersect: false,
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '计划数'
              },
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
    }
    
    // 渲染测试数据图表
    if (testChartRef.current) {
      if (testChartInstance.current) {
        testChartInstance.current.destroy();
      }

      testChartInstance.current = new Chart(testChartRef.current, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [
            {
              label: '测试数量',
              data: testCounts,
              backgroundColor: 'rgba(153, 102, 255, 0.2)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 2,
              yAxisID: 'y',
              tension: 0.4
            },
            {
              label: '正确率 (%)',
              data: testAccuracy,
              backgroundColor: 'rgba(255, 159, 64, 0.2)',
              borderColor: 'rgba(255, 159, 64, 1)',
              borderWidth: 2,
              yAxisID: 'y1',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            tooltip: {
              mode: 'index',
              intersect: false,
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              position: 'left',
              title: {
                display: true,
                text: '测试数量'
              },
              ticks: {
                stepSize: 1
              }
            },
            y1: {
              beginAtZero: true,
              position: 'right',
              title: {
                display: true,
                text: '正确率 (%)'
              },
              min: 0,
              max: 100,
              grid: {
                drawOnChartArea: false
              }
            }
          }
        }
      });
    }
    
    // 渲染专注时长分布图表
    if (focusDistributionChartRef.current) {
      if (focusDistributionChartInstance.current) {
        focusDistributionChartInstance.current.destroy();
      }

      focusDistributionChartInstance.current = new Chart(focusDistributionChartRef.current, {
        type: 'doughnut',
        data: {
          labels: focusDistribution.labels,
          datasets: [{
            data: focusDistribution.data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 15,
                padding: 15,
                font: {
                  size: 10 // 移动端字体缩小
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value}次 (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
    
    // 渲染每周几专注分布图表
    if (weekdayDistributionChartRef.current) {
      if (weekdayDistributionChartInstance.current) {
        weekdayDistributionChartInstance.current.destroy();
      }

      weekdayDistributionChartInstance.current = new Chart(weekdayDistributionChartRef.current, {
        type: 'bar',
        data: {
          labels: weekdayDistribution.labels,
          datasets: [{
            label: '专注次数',
            data: weekdayDistribution.data,
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `专注次数: ${context.raw}次`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '专注次数'
              },
              ticks: {
                stepSize: 1
              }
            },
            x: {
              ticks: {
                font: {
                  size: 10 // 移动端字体缩小
                }
              }
            }
          }
        }
      });
    }
    
    // 渲染时间段分布图表
    if (timePeriodDistributionChartRef.current) {
      if (timePeriodDistributionChartInstance.current) {
        timePeriodDistributionChartInstance.current.destroy();
      }

      timePeriodDistributionChartInstance.current = new Chart(timePeriodDistributionChartRef.current, {
        type: 'pie',
        data: {
          labels: timePeriodDistribution.labels,
          datasets: [{
            data: timePeriodDistribution.data,
            backgroundColor: [
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 15,
                padding: 10,
                font: {
                  size: 9 // 移动端字体缩小
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value}次 (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  };

  // 计算总结数据 - 使用实际专注时长
  const calculateSummary = () => {
    if (stats.length === 0) return { 
      totalFocusTime: 0, 
      totalCompletedPlans: 0, 
      plansWithFocus: 0,
      averageFocusTime: 0 
    };
    
    const totalFocusTime = stats.reduce((sum, item) => sum + item.focus_time, 0);
    const totalCompletedPlans = stats.reduce((sum, item) => sum + item.completed_plans, 0);
    const totalPlansWithFocus = stats.reduce((sum, item) => sum + (item.plans_with_focus || 0), 0);
    const averageFocusTime = Math.round(totalFocusTime / stats.length / 60); // 平均每天专注分钟数
    
    return {
      totalFocusTime: Math.round(totalFocusTime / 60), // 转换为分钟
      totalCompletedPlans,
      plansWithFocus: totalPlansWithFocus,
      averageFocusTime
    };
  };

  const summary = calculateSummary();

  // 生成时间范围标题
  const getTimeRangeTitle = () => {
    const today = new Date();
    
    if (period === 'day') {
      return format(today, 'yyyy年MM月dd日');
    } else if (period === 'week') {
      const startDate = subDays(today, 7);
      return `${format(startDate, 'MM月dd日')} - ${format(today, 'MM月dd日')}`;
    } else if (period === 'month') {
      const startDate = subDays(today, 30);
      return `${format(startDate, 'MM月dd日')} - ${format(today, 'MM月dd日')}`;
    }
    
    return '';
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-50 stats-container">
      {/* 标题 */}
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-gray-800 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faChartBar} className="mr-2" />
          统计数据
        </h1>
        <p className="text-sm text-gray-600">{getTimeRangeTitle()}</p>
      </div>

      {/* 时间范围选择 */}
      <div className="flex justify-center mb-4 animate__animated animate__fadeIn period-selector">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`px-3 py-1 text-sm font-medium rounded-l-lg ${
              period === 'day' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setPeriod('day')}
          >
            今日
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-sm font-medium ${
              period === 'week' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setPeriod('week')}
          >
            本周
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-sm font-medium rounded-r-lg ${
              period === 'month' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setPeriod('month')}
          >
            本月
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded relative mb-3 text-sm" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* 数据为空提示 */}
      {!isLoading && !error && stats.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 text-gray-500 animate__animated animate__fadeIn">
          <FontAwesomeIcon icon={faCalendarAlt} className="text-3xl mb-2" />
          <p className="text-sm">暂无统计数据，开始您的自律之旅吧！</p>
        </div>
      )}

      {/* 统计卡片 - 移动端优化为2列布局 */}
      {!isLoading && !error && stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4 animate__animated animate__fadeIn stats-grid">
          {/* 实际专注时间 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-blue-100 text-blue-500 mr-2">
                <FontAwesomeIcon icon={faClock} size="sm" />
              </div>
              <div>
                <p className="text-xs text-gray-600">实际专注时间</p>
                <p className="text-base font-bold">{summary.totalFocusTime} 分钟</p>
              </div>
            </div>
          </div>

          {/* 完成计划数 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-green-100 text-green-500 mr-2">
                <FontAwesomeIcon icon={faCheckCircle} size="sm" />
              </div>
              <div>
                <p className="text-xs text-gray-600">完成计划数</p>
                <p className="text-base font-bold">{summary.totalCompletedPlans}</p>
              </div>
            </div>
          </div>
          
          {/* 有专注时间的计划 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-indigo-100 text-indigo-500 mr-2">
                <FontAwesomeIcon icon={faHourglassHalf} size="sm" />
              </div>
              <div>
                <p className="text-xs text-gray-600">有专注记录的计划</p>
                <p className="text-base font-bold">{summary.plansWithFocus}</p>
              </div>
            </div>
          </div>

          {/* 平均每日专注 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-purple-100 text-purple-500 mr-2">
                <FontAwesomeIcon icon={faChartBar} size="sm" />
              </div>
              <div>
                <p className="text-xs text-gray-600">平均每日专注</p>
                <p className="text-base font-bold">{summary.averageFocusTime} 分钟</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 测试统计卡片 - 移动端优化为滚动容器 */}
      {!isLoading && !error && stats.length > 0 && (
        <div className="flex overflow-x-auto pb-2 mb-4 animate__animated animate__fadeIn touch-scroll">
          <div className="flex space-x-2 min-w-full">
            {/* 测试总数 */}
            <div className="bg-white p-3 rounded-lg shadow-md flex-1">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-indigo-100 text-indigo-500 mr-2">
                  <FontAwesomeIcon icon={faClipboardCheck} size="sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">测试总数</p>
                  <p className="text-base font-bold">{testStats.total_tests}</p>
                </div>
              </div>
            </div>

            {/* 总题数/正确数 */}
            <div className="bg-white p-3 rounded-lg shadow-md flex-1">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-yellow-100 text-yellow-500 mr-2">
                  <FontAwesomeIcon icon={faQuestionCircle} size="sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">总题数/正确数</p>
                  <p className="text-base font-bold">{testStats.total_questions}/{testStats.correct_answers}</p>
                </div>
              </div>
            </div>

            {/* 平均正确率 */}
            <div className="bg-white p-3 rounded-lg shadow-md flex-1">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-red-100 text-red-500 mr-2">
                  <FontAwesomeIcon icon={faPercent} size="sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">平均正确率</p>
                  <p className="text-base font-bold">{testStats.avg_accuracy}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 专注分布图表 - 移动端单列布局 */}
      {!isLoading && !error && stats.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-4 animate__animated animate__fadeIn">
          {/* 专注时长分布 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faChartPie} className="mr-1" />
              专注时长分布
            </h3>
            <div className="h-48 stats-chart-container">
              <canvas ref={focusDistributionChartRef}></canvas>
            </div>
          </div>

          {/* 每周几专注分布 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faCalendarWeek} className="mr-1" />
              每周专注分布
            </h3>
            <div className="h-48 stats-chart-container">
              <canvas ref={weekdayDistributionChartRef}></canvas>
            </div>
          </div>
        </div>
      )}
      
      {/* 时间段分布图表 - 移动端单列布局 */}
      {!isLoading && !error && stats.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-4 animate__animated animate__fadeIn">
          {/* 时间段分布 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faHourglassHalf} className="mr-1" />
              专注时段分布
            </h3>
            <div className="h-48 stats-chart-container">
              <canvas ref={timePeriodDistributionChartRef}></canvas>
            </div>
          </div>
          
          {/* 计划完成情况对比 */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faListAlt} className="mr-1" />
              计划完成情况
            </h3>
            <div className="flex flex-col items-center justify-center h-48">
              <div className="w-full max-w-md">
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">完成计划数</span>
                    <span className="text-xs font-medium text-gray-700">{summary.totalCompletedPlans}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">有专注时间的计划</span>
                    <span className="text-xs font-medium text-gray-700">{summary.plansWithFocus}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full" 
                      style={{ 
                        width: summary.totalCompletedPlans > 0 
                          ? `${(summary.plansWithFocus / summary.totalCompletedPlans) * 100}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-center mt-3">
                  <p className="text-xs text-gray-600">
                    {summary.totalCompletedPlans > 0 
                      ? `${Math.round((summary.plansWithFocus / summary.totalCompletedPlans) * 100)}%` 
                      : '0%'} 的完成计划有专注时间记录
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 图表区域 - 移动端优化为可横向滚动的容器 */}
      {!isLoading && !error && stats.length > 0 && (
        <div className="animate__animated animate__fadeIn">
          {/* 专注时间图表 */}
          <div className="bg-white p-3 rounded-lg shadow-md mb-4 chart-container">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faChartLine} className="mr-1" />
              实际专注时间趋势
            </h3>
            <div className="h-48 chart-scroll-container">
              <canvas ref={focusChartRef}></canvas>
            </div>
          </div>

          {/* 完成计划图表 */}
          <div className="bg-white p-3 rounded-lg shadow-md mb-4 chart-container">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faCalendarCheck} className="mr-1" />
              计划完成趋势
            </h3>
            <div className="h-48 chart-scroll-container">
              <canvas ref={plansChartRef}></canvas>
            </div>
          </div>
          
          {/* 测试数据图表 */}
          <div className="bg-white p-3 rounded-lg shadow-md mb-4 chart-container">
            <h3 className="text-sm font-semibold mb-2">
              <FontAwesomeIcon icon={faClipboardCheck} className="mr-1" />
              测试数据趋势
            </h3>
            <div className="h-48 chart-scroll-container">
              <canvas ref={testChartRef}></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;