// 导入依赖
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const WebSocket = require('ws');
const http = require('http');

const app = express();

// 定义JWT密钥
const JWT_SECRET = 'self-discipline-app-secret-key-2025';

// 定义全局logger
const logger = winston.createLogger({
  level: 'info', // 日志级别
  format: winston.format.combine(
    winston.format.timestamp({ 
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'app.log' }) 
  ]
});

// 全局异常捕获
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常:', err);
});

// 允许跨域访问
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));
app.use(cors());
app.use(express.json());

// 严格按照如下方式配置静态资源(不得篡改)
const publicPath = path.resolve(__dirname, '../frontend/public');
app.use(express.static(publicPath));

// 创建HTTP服务器，用于WebSocket支持
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储WebSocket连接的映射
const clients = new Map();

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  logger.info('WebSocket客户端已连接');
  
  // 处理消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // 处理认证
      if (data.type === 'auth') {
        const token = data.token;
        
        if (!token) {
          ws.send(JSON.stringify({ type: 'error', message: '未提供认证令牌' }));
          return;
        }
        
        jwt.verify(token, JWT_SECRET, (err, user) => {
          if (err) {
            ws.send(JSON.stringify({ type: 'error', message: '令牌无效或已过期' }));
            return;
          }
          
          // 存储用户信息和WebSocket连接
          clients.set(user.username, ws);
          ws.user = user;
          
          ws.send(JSON.stringify({ type: 'auth_success', message: '认证成功' }));
          logger.info(`用户 ${user.username} WebSocket认证成功`);
        });
      }
      
      // 处理订阅计划更新
      if (data.type === 'subscribe_plans' && ws.user) {
        ws.subscribed = true;
        ws.send(JSON.stringify({ type: 'subscribed', message: '已订阅计划更新' }));
      }
    } catch (err) {
      logger.error('处理WebSocket消息失败:', err);
      ws.send(JSON.stringify({ type: 'error', message: '消息格式无效' }));
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    if (ws.user) {
      clients.delete(ws.user.username);
      logger.info(`用户 ${ws.user.username} WebSocket连接已关闭`);
    } else {
      logger.info('未认证的WebSocket连接已关闭');
    }
  });
  
  // 发送初始消息
  ws.send(JSON.stringify({ type: 'welcome', message: '连接成功，请发送认证信息' }));
});

// 广播计划更新
const broadcastPlanUpdate = (username) => {
  const ws = clients.get(username);
  
  if (ws && ws.subscribed) {
    ws.send(JSON.stringify({ 
      type: 'plan_update', 
      message: '计划已更新',
      timestamp: new Date().toISOString()
    }));
    logger.info(`向用户 ${username} 广播计划更新`);
  }
};

// 数据库初始化
function init_database() {
  const dbPath = path.join(__dirname, 'self_discipline.db');
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, function(err) {
      if (err) {
        logger.error('创建用户表失败:', err);
        return;
      }
      
      // 预创建10个用户账号
      const users = [];
      for (let i = 1; i <= 10; i++) {
        users.push({
          id: uuidv4(),
          username: `user${i}`,
          password: bcrypt.hashSync('123456', 10)
        });
      }
      
      // 检查并添加用户
      users.forEach(user => {
        db.get("SELECT * FROM users WHERE username = ?", [user.username], (err, row) => {
          if (err) {
            logger.error(`查询用户 ${user.username} 失败:`, err);
            return;
          }
          
          if (!row) {
            db.run("INSERT INTO users (id, username, password) VALUES (?, ?, ?)", 
              [user.id, user.username, user.password], 
              function(err) {
                if (err) {
                  logger.error(`添加用户 ${user.username} 失败:`, err);
                } else {
                  logger.info(`添加用户 ${user.username} 成功`);
                }
              }
            );
          }
        });
      });
    });

    // 为每个用户创建独立的数据表
    for (let i = 1; i <= 10; i++) {
      const userPrefix = `user${i}_`;
      
      // 创建用户计划表
      db.run(`
        CREATE TABLE IF NOT EXISTS ${userPrefix}plans (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          priority INTEGER DEFAULT 0,
          completed BOOLEAN DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (err) {
          logger.error(`创建用户 ${userPrefix}plans 表失败:`, err);
        }
      });

      // 创建用户专注记录表 - 更新表结构以支持新的专注时间记录方式
      db.run(`
        CREATE TABLE IF NOT EXISTS ${userPrefix}focus_sessions (
          id TEXT PRIMARY KEY,
          plan_id TEXT,
          duration INTEGER,
          start_time TIMESTAMP,
          end_time TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(plan_id) REFERENCES ${userPrefix}plans(id)
        )
      `, function(err) {
        if (err) {
          logger.error(`创建用户 ${userPrefix}focus_sessions 表失败:`, err);
        }
      });

      // 创建用户统计表
      db.run(`
        CREATE TABLE IF NOT EXISTS ${userPrefix}stats (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          focus_time INTEGER DEFAULT 0,
          completed_plans INTEGER DEFAULT 0,
          test_count INTEGER DEFAULT 0,
          test_total_questions INTEGER DEFAULT 0,
          test_correct_answers INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (err) {
          logger.error(`创建用户 ${userPrefix}stats 表失败:`, err);
        }
      });

      // 创建用户测试表
      db.run(`
        CREATE TABLE IF NOT EXISTS ${userPrefix}tests (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          total_questions INTEGER NOT NULL DEFAULT 0,
          correct_answers INTEGER NOT NULL DEFAULT 0,
          accuracy REAL GENERATED ALWAYS AS (
            CASE 
              WHEN total_questions > 0 THEN ROUND((correct_answers * 100.0) / total_questions, 2)
              ELSE 0
            END
          ) STORED,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (err) {
          logger.error(`创建用户 ${userPrefix}tests 表失败:`, err);
        }
      });
    }
  });

  db.close();
  logger.info('数据库初始化完成');
}

// 获取数据库连接
function getDbConnection() {
  const dbPath = path.join(__dirname, 'self_discipline.db');
  return new sqlite3.Database(dbPath);
}

// 初始化数据库
init_database();

// 验证JWT中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    
    req.user = user;
    next();
  });
};

// 用户登录API
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  const db = getDbConnection();
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    db.close();
    
    if (err) {
      logger.error('登录查询失败:', err);
      return res.status(500).json({ error: '登录失败，请稍后再试' });
    }
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    
    if (!passwordIsValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      id: user.id,
      username: user.username,
      token: token
    });
  });
});

// API路由 - 使用用户前缀获取正确的表名
const getUserTable = (user, tableName) => {
  return `user${user.username.replace('user', '')}_${tableName}`;
};

// 获取计划列表
app.get('/plans', authenticateToken, (req, res) => {
  const db = getDbConnection();
  const plansTable = getUserTable(req.user, 'plans');
  
  db.all(`SELECT * FROM ${plansTable} ORDER BY created_at DESC`, [], (err, rows) => {
    db.close();
    
    if (err) {
      logger.error('获取计划列表失败:', err);
      return res.status(500).json({ error: '获取计划列表失败' });
    }
    
    res.json(rows);
  });
});

// 添加新计划
app.post('/plans', authenticateToken, (req, res) => {
  const { title, priority } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: '计划标题不能为空' });
  }
  
  const db = getDbConnection();
  const id = uuidv4();
  const plansTable = getUserTable(req.user, 'plans');
  
  db.run(
    `INSERT INTO ${plansTable} (id, title, priority) VALUES (?, ?, ?)`,
    [id, title, priority || 0],
    function(err) {
      if (err) {
        db.close();
        logger.error('添加计划失败:', err);
        return res.status(500).json({ error: '添加计划失败' });
      }
      
      db.get(`SELECT * FROM ${plansTable} WHERE id = ?`, [id], (err, row) => {
        db.close();
        
        if (err) {
          logger.error('获取新添加的计划失败:', err);
          return res.status(500).json({ error: '获取新添加的计划失败' });
        }
        
        // 广播计划更新
        broadcastPlanUpdate(req.user.username);
        
        res.status(201).json(row);
      });
    }
  );
});

// 更新计划状态
app.put('/plans/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  
  if (completed === undefined) {
    return res.status(400).json({ error: '缺少completed参数' });
  }
  
  const db = getDbConnection();
  const plansTable = getUserTable(req.user, 'plans');
  const statsTable = getUserTable(req.user, 'stats');
  
  // 检查是否有其他计划在同一时间段已完成
  if (completed) {
    db.all(`SELECT * FROM ${plansTable} WHERE completed = 1 AND id != ?`, [id], (err, rows) => {
      if (err) {
        db.close();
        logger.error('检查其他已完成计划失败:', err);
        return res.status(500).json({ error: '检查其他已完成计划失败' });
      }
      
      // 如果有其他已完成计划，返回错误
      if (rows && rows.length > 0) {
        db.close();
        return res.status(400).json({ error: '同一时间只能有一个计划处于完成状态' });
      }
      
      // 继续更新计划状态
      updatePlanStatus();
    });
  } else {
    // 如果是取消完成状态，直接更新
    updatePlanStatus();
  }
  
  function updatePlanStatus() {
    db.run(
      `UPDATE ${plansTable} SET completed = ? WHERE id = ?`,
      [completed ? 1 : 0, id],
      function(err) {
        if (err) {
          db.close();
          logger.error('更新计划状态失败:', err);
          return res.status(500).json({ error: '更新计划状态失败' });
        }
        
        if (this.changes === 0) {
          db.close();
          return res.status(404).json({ error: '计划不存在' });
        }
        
        // 如果计划被标记为完成，更新统计数据
        if (completed) {
          const today = new Date().toISOString().split('T')[0];
          
          // 检查今天的统计数据是否存在
          db.get(`SELECT * FROM ${statsTable} WHERE date = ?`, [today], (err, row) => {
            if (err) {
              logger.error('查询统计数据失败:', err);
            }
            
            if (row) {
              // 更新已有统计数据
              db.run(
                `UPDATE ${statsTable} SET completed_plans = completed_plans + 1 WHERE id = ?`,
                [row.id]
              );
            } else {
              // 创建新的统计数据
              db.run(
                `INSERT INTO ${statsTable} (id, date, completed_plans) VALUES (?, ?, ?)`,
                [uuidv4(), today, 1]
              );
            }
          });
        }
        
        db.get(`SELECT * FROM ${plansTable} WHERE id = ?`, [id], (err, row) => {
          db.close();
          
          if (err) {
            logger.error('获取更新后的计划失败:', err);
            return res.status(500).json({ error: '获取更新后的计划失败' });
          }
          
          // 广播计划更新
          broadcastPlanUpdate(req.user.username);
          
          res.json(row);
        });
      }
    );
  }
});

// 更新后的专注时间记录接口
app.post('/focus', authenticateToken, (req, res) => {
  const { plan_id, start_time, end_time } = req.body;
  
  if (!plan_id) {
    return res.status(400).json({ error: '计划ID不能为空' });
  }
  
  if (!start_time || !end_time) {
    return res.status(400).json({ error: '开始时间和结束时间不能为空' });
  }
  
  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: '时间格式无效' });
  }
  
  if (startDate >= endDate) {
    return res.status(400).json({ error: '结束时间必须晚于开始时间' });
  }
  
  // 计算专注时长（分钟）
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));
  
  const db = getDbConnection();
  const id = uuidv4();
  const focusTable = getUserTable(req.user, 'focus_sessions');
  const plansTable = getUserTable(req.user, 'plans');
  const statsTable = getUserTable(req.user, 'stats');
  
  // 检查计划是否存在
  db.get(`SELECT * FROM ${plansTable} WHERE id = ?`, [plan_id], (err, plan) => {
    if (err) {
      db.close();
      logger.error('查询计划失败:', err);
      return res.status(500).json({ error: '查询计划失败' });
    }
    
    if (!plan) {
      db.close();
      return res.status(404).json({ error: '计划不存在' });
    }
    
    // 检查是否有其他专注记录与当前时间段重叠
    const overlapQuery = `
      SELECT * FROM ${focusTable} 
      WHERE ((start_time <= ? AND end_time >= ?) OR 
             (start_time <= ? AND end_time >= ?) OR 
             (start_time >= ? AND end_time <= ?))
    `;
    
    db.all(overlapQuery, [
      start_time, start_time,
      end_time, end_time,
      start_time, end_time
    ], (err, overlaps) => {
      if (err) {
        db.close();
        logger.error('检查时间重叠失败:', err);
        return res.status(500).json({ error: '检查时间重叠失败' });
      }
      
      if (overlaps && overlaps.length > 0) {
        db.close();
        return res.status(400).json({ error: '该时间段已有其他专注记录' });
      }
      
      // 添加专注记录
      db.run(
        `INSERT INTO ${focusTable} (id, plan_id, duration, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
        [id, plan_id, durationMinutes, start_time, end_time],
        function(err) {
          if (err) {
            db.close();
            logger.error('添加专注记录失败:', err);
            return res.status(500).json({ error: '添加专注记录失败' });
          }
          
          // 更新计划为已完成状态
          db.run(`UPDATE ${plansTable} SET completed = 1 WHERE id = ?`, [plan_id], function(err) {
            if (err) {
              logger.error('更新计划状态失败:', err);
            }
          });
          
          // 更新统计数据
          const today = new Date().toISOString().split('T')[0];
          
          // 检查今天的统计数据是否存在
          db.get(`SELECT * FROM ${statsTable} WHERE date = ?`, [today], (err, statsRow) => {
            if (err) {
              logger.error('查询统计数据失败:', err);
            }
            
            if (statsRow) {
              // 更新已有统计数据
              db.run(
                `UPDATE ${statsTable} SET focus_time = focus_time + ?, completed_plans = completed_plans + 1 WHERE id = ?`,
                [durationMinutes, statsRow.id]
              );
            } else {
              // 创建新的统计数据
              db.run(
                `INSERT INTO ${statsTable} (id, date, focus_time, completed_plans) VALUES (?, ?, ?, ?)`,
                [uuidv4(), today, durationMinutes, 1]
              );
            }
            
            db.get(`SELECT * FROM ${focusTable} WHERE id = ?`, [id], (err, row) => {
              db.close();
              
              if (err) {
                logger.error('获取新添加的专注记录失败:', err);
                return res.status(500).json({ error: '获取新添加的专注记录失败' });
              }
              
              // 广播计划更新
              broadcastPlanUpdate(req.user.username);
              
              res.status(201).json(row);
            });
          });
        }
      );
    });
  });
});

// 获取专注记录
app.get('/focus/sessions', authenticateToken, (req, res) => {
  const db = getDbConnection();
  const focusTable = getUserTable(req.user, 'focus_sessions');
  const plansTable = getUserTable(req.user, 'plans');
  
  // 联合查询专注记录和对应的计划信息
  const query = `
    SELECT f.*, p.title as plan_title 
    FROM ${focusTable} f
    LEFT JOIN ${plansTable} p ON f.plan_id = p.id
    ORDER BY f.start_time DESC
  `;
  
  db.all(query, [], (err, rows) => {
    db.close();
    
    if (err) {
      logger.error('获取专注记录失败:', err);
      return res.status(500).json({ error: '获取专注记录失败' });
    }
    
    res.json(rows);
  });
});

// 获取统计数据
app.get('/stats', authenticateToken, (req, res) => {
  const { period } = req.query;
  const db = getDbConnection();
  const statsTable = getUserTable(req.user, 'stats');
  const testsTable = getUserTable(req.user, 'tests');
  const focusTable = getUserTable(req.user, 'focus_sessions');
  
  let query = `SELECT * FROM ${statsTable} ORDER BY date DESC`;
  let dateStr = null;
  
  if (period === 'week') {
    // 获取最近7天的数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    dateStr = sevenDaysAgo.toISOString().split('T')[0];
    
    query = `SELECT * FROM ${statsTable} WHERE date >= ? ORDER BY date DESC`;
  } else if (period === 'month') {
    // 获取最近30天的数据
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    dateStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    query = `SELECT * FROM ${statsTable} WHERE date >= ? ORDER BY date DESC`;
  }
  
  const getStats = (callback) => {
    if (dateStr) {
      db.all(query, [dateStr], callback);
    } else {
      db.all(query, [], callback);
    }
  };
  
  // 获取测试数据统计
  const getTestStats = (callback) => {
    db.all(`SELECT * FROM ${testsTable}`, [], callback);
  };
  
  // 获取专注时间分布
  const getFocusDistribution = (callback) => {
    const focusDistributionQuery = `
      SELECT 
        CASE 
          WHEN strftime('%H', start_time) BETWEEN '00' AND '05' THEN '凌晨(00:00-06:00)'
          WHEN strftime('%H', start_time) BETWEEN '06' AND '11' THEN '上午(06:00-12:00)'
          WHEN strftime('%H', start_time) BETWEEN '12' AND '17' THEN '下午(12:00-18:00)'
          ELSE '晚上(18:00-24:00)'
        END as time_period,
        SUM(duration) as total_duration,
        COUNT(*) as session_count
      FROM ${focusTable}
      GROUP BY time_period
      ORDER BY 
        CASE time_period
          WHEN '凌晨(00:00-06:00)' THEN 1
          WHEN '上午(06:00-12:00)' THEN 2
          WHEN '下午(12:00-18:00)' THEN 3
          WHEN '晚上(18:00-24:00)' THEN 4
        END
    `;
    
    db.all(focusDistributionQuery, [], callback);
  };
  
  // 获取专注趋势（按日）
  const getFocusTrend = (callback) => {
    let trendQuery = `
      SELECT 
        date(start_time) as focus_date,
        SUM(duration) as total_duration,
        COUNT(*) as session_count
      FROM ${focusTable}
      GROUP BY focus_date
      ORDER BY focus_date DESC
      LIMIT 30
    `;
    
    db.all(trendQuery, [], callback);
  };
  
  getStats((err, statsRows) => {
    if (err) {
      db.close();
      logger.error('获取统计数据失败:', err);
      return res.status(500).json({ error: '获取统计数据失败' });
    }
    
    getTestStats((testErr, testRows) => {
      if (testErr) {
        db.close();
        logger.error('获取测试统计数据失败:', testErr);
        return res.status(500).json({ error: '获取测试统计数据失败' });
      }
      
      getFocusDistribution((distErr, distRows) => {
        if (distErr) {
          db.close();
          logger.error('获取专注时间分布失败:', distErr);
          return res.status(500).json({ error: '获取专注时间分布失败' });
        }
        
        getFocusTrend((trendErr, trendRows) => {
          db.close();
          
          if (trendErr) {
            logger.error('获取专注趋势失败:', trendErr);
            return res.status(500).json({ error: '获取专注趋势失败' });
          }
          
          // 计算测试统计数据
          const testStats = {
            total_tests: testRows.length,
            total_questions: testRows.reduce((sum, test) => sum + test.total_questions, 0),
            correct_answers: testRows.reduce((sum, test) => sum + test.correct_answers, 0),
            avg_accuracy: testRows.length > 0 
              ? Math.round(testRows.reduce((sum, test) => sum + test.accuracy, 0) / testRows.length)
              : 0
          };
          
          // 计算平均每日专注时间
          let totalFocusTime = 0;
          let totalDays = 0;
          
          if (statsRows.length > 0) {
            totalFocusTime = statsRows.reduce((sum, stat) => sum + stat.focus_time, 0);
            totalDays = statsRows.length;
          }
          
          const avgDailyFocusTime = totalDays > 0 ? Math.round(totalFocusTime / totalDays) : 0;
          
          // 将测试统计数据和专注分布数据添加到响应中
          const response = {
            stats: statsRows,
            test_stats: testStats,
            focus_stats: {
              total_focus_time: totalFocusTime,
              avg_daily_focus_time: avgDailyFocusTime,
              distribution: distRows,
              trend: trendRows
            }
          };
          
          res.json(response);
        });
      });
    });
  });
});

// 获取测试列表
app.get('/tests', authenticateToken, (req, res) => {
  const db = getDbConnection();
  const testsTable = getUserTable(req.user, 'tests');
  
  db.all(`SELECT * FROM ${testsTable} ORDER BY created_at DESC`, [], (err, rows) => {
    db.close();
    
    if (err) {
      logger.error('获取测试列表失败:', err);
      return res.status(500).json({ error: '获取测试列表失败' });
    }
    
    res.json(rows);
  });
});

// 创建新测试
app.post('/tests', authenticateToken, (req, res) => {
  const { name, total_questions, correct_answers } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '测试名称不能为空' });
  }
  
  if (total_questions === undefined || total_questions < 0) {
    return res.status(400).json({ error: '总题数必须为非负数' });
  }
  
  if (correct_answers === undefined || correct_answers < 0) {
    return res.status(400).json({ error: '正确题数必须为非负数' });
  }
  
  if (correct_answers > total_questions) {
    return res.status(400).json({ error: '正确题数不能大于总题数' });
  }
  
  const db = getDbConnection();
  const id = uuidv4();
  const testsTable = getUserTable(req.user, 'tests');
  const statsTable = getUserTable(req.user, 'stats');
  
  db.run(
    `INSERT INTO ${testsTable} (id, name, total_questions, correct_answers) VALUES (?, ?, ?, ?)`,
    [id, name, total_questions, correct_answers],
    function(err) {
      if (err) {
        db.close();
        logger.error('创建测试失败:', err);
        return res.status(500).json({ error: '创建测试失败' });
      }
      
      // 更新统计数据
      const today = new Date().toISOString().split('T')[0];
      
      // 检查今天的统计数据是否存在
      db.get(`SELECT * FROM ${statsTable} WHERE date = ?`, [today], (err, statsRow) => {
        if (err) {
          logger.error('查询统计数据失败:', err);
        }
        
        if (statsRow) {
          // 更新已有统计数据
          db.run(
            `UPDATE ${statsTable} SET test_count = test_count + 1, test_total_questions = test_total_questions + ?, test_correct_answers = test_correct_answers + ? WHERE id = ?`,
            [total_questions, correct_answers, statsRow.id]
          );
        } else {
          // 创建新的统计数据
          db.run(
            `INSERT INTO ${statsTable} (id, date, test_count, test_total_questions, test_correct_answers) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), today, 1, total_questions, correct_answers]
          );
        }
      });
      
      db.get(`SELECT * FROM ${testsTable} WHERE id = ?`, [id], (err, row) => {
        db.close();
        
        if (err) {
          logger.error('获取新创建的测试失败:', err);
          return res.status(500).json({ error: '获取新创建的测试失败' });
        }
        
        res.status(201).json(row);
      });
    }
  );
});

// 更新测试数据
app.put('/tests/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { total_questions, correct_answers } = req.body;
  
  if (total_questions === undefined || total_questions < 0) {
    return res.status(400).json({ error: '总题数必须为非负数' });
  }
  
  if (correct_answers === undefined || correct_answers < 0) {
    return res.status(400).json({ error: '正确题数必须为非负数' });
  }
  
  if (correct_answers > total_questions) {
    return res.status(400).json({ error: '正确题数不能大于总题数' });
  }
  
  const db = getDbConnection();
  const testsTable = getUserTable(req.user, 'tests');
  const statsTable = getUserTable(req.user, 'stats');
  
  // 先获取原始测试数据
  db.get(`SELECT * FROM ${testsTable} WHERE id = ?`, [id], (err, oldTest) => {
    if (err) {
      db.close();
      logger.error('获取原始测试数据失败:', err);
      return res.status(500).json({ error: '获取原始测试数据失败' });
    }
    
    if (!oldTest) {
      db.close();
      return res.status(404).json({ error: '测试不存在' });
    }
    
    // 计算差值，用于更新统计数据
    const questionsDiff = total_questions - oldTest.total_questions;
    const correctDiff = correct_answers - oldTest.correct_answers;
    
    db.run(
      `UPDATE ${testsTable} SET total_questions = ?, correct_answers = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [total_questions, correct_answers, id],
      function(err) {
        if (err) {
          db.close();
          logger.error('更新测试数据失败:', err);
          return res.status(500).json({ error: '更新测试数据失败' });
        }
        
        if (this.changes === 0) {
          db.close();
          return res.status(404).json({ error: '测试不存在' });
        }
        
        // 更新统计数据
        const testDate = new Date(oldTest.created_at).toISOString().split('T')[0];
        
        db.get(`SELECT * FROM ${statsTable} WHERE date = ?`, [testDate], (err, statsRow) => {
          if (err) {
            logger.error('查询统计数据失败:', err);
          } else if (statsRow) {
            // 更新统计数据中的测试题目和正确答案数
            db.run(
              `UPDATE ${statsTable} SET test_total_questions = test_total_questions + ?, test_correct_answers = test_correct_answers + ? WHERE id = ?`,
              [questionsDiff, correctDiff, statsRow.id]
            );
          }
        });
        
        db.get(`SELECT * FROM ${testsTable} WHERE id = ?`, [id], (err, row) => {
          db.close();
          
          if (err) {
            logger.error('获取更新后的测试失败:', err);
            return res.status(500).json({ error: '获取更新后的测试失败' });
          }
          
          res.json(row);
        });
      }
    );
  });
});

// 删除测试数据
app.delete('/tests/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDbConnection();
  const testsTable = getUserTable(req.user, 'tests');
  const statsTable = getUserTable(req.user, 'stats');
  
  // 先获取要删除的测试数据
  db.get(`SELECT * FROM ${testsTable} WHERE id = ?`, [id], (err, test) => {
    if (err) {
      db.close();
      logger.error('获取测试数据失败:', err);
      return res.status(500).json({ error: '获取测试数据失败' });
    }
    
    if (!test) {
      db.close();
      return res.status(404).json({ error: '测试不存在' });
    }
    
    // 删除测试数据
    db.run(`DELETE FROM ${testsTable} WHERE id = ?`, [id], function(err) {
      if (err) {
        db.close();
        logger.error('删除测试失败:', err);
        return res.status(500).json({ error: '删除测试失败' });
      }
      
      if (this.changes === 0) {
        db.close();
        return res.status(404).json({ error: '测试不存在' });
      }
      
      // 更新统计数据
      const testDate = new Date(test.created_at).toISOString().split('T')[0];
      
      db.get(`SELECT * FROM ${statsTable} WHERE date = ?`, [testDate], (err, statsRow) => {
        db.close();
        
        if (err) {
          logger.error('查询统计数据失败:', err);
        } else if (statsRow) {
          // 更新统计数据，减去删除的测试数据
          db.run(
            `UPDATE ${statsTable} SET test_count = test_count - 1, test_total_questions = test_total_questions - ?, test_correct_answers = test_correct_answers - ? WHERE id = ?`,
            [test.total_questions, test.correct_answers, statsRow.id]
          );
        }
        
        res.json({ message: '测试删除成功', deletedTest: test });
      });
    });
  });
});

// 前端异常上报
app.post('/logs', (req, res) => {
  const { error } = req.body;
  
  if (!error) {
    return res.status(400).json({ error: '缺少error参数' });
  }
  
  logger.error('前端异常:', error);
  res.status(200).json({ message: '异常已记录' });
});

// WebSocket健康检查端点
app.get('/ws/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: clients.size,
    uptime: process.uptime()
  });
});

// 处理前端路由
app.get('*', (req, res) => {
  const filePath = path.join(publicPath, req.path);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// 处理404错误
app.use((req, res) => {
  res.status(404).json({ error: '请求的资源不存在' });
});

const PORT = process.env.PORT || 37230;
server.listen(PORT, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
});