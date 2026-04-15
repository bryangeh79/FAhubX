#!/usr/bin/env node

/**
 * Facebook Auto Bot 数据库性能测试脚本
 * 测试PostgreSQL数据库性能
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// 数据库配置
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'facebook_auto_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

// 测试查询
const TEST_QUERIES = [
  {
    name: '用户查询 - 简单查询',
    sql: 'SELECT id, email, username, created_at FROM users LIMIT 100',
    expectedRows: 100
  },
  {
    name: '账号查询 - 关联查询',
    sql: `SELECT a.*, u.email as owner_email 
          FROM facebook_accounts a 
          JOIN users u ON a.user_id = u.id 
          WHERE a.status = 'active' 
          ORDER BY a.created_at DESC 
          LIMIT 50`,
    expectedRows: 50
  },
  {
    name: '任务查询 - 复杂查询',
    sql: `SELECT t.*, 
                 COUNT(te.id) as execution_count,
                 AVG(te.duration) as avg_duration
          FROM tasks t
          LEFT JOIN task_executions te ON t.id = te.task_id
          WHERE t.status IN ('pending', 'running')
          GROUP BY t.id
          HAVING COUNT(te.id) > 0
          ORDER BY t.priority DESC, t.created_at
          LIMIT 20`,
    expectedRows: 20
  },
  {
    name: '统计查询 - 聚合查询',
    sql: `SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
            AVG(duration) as avg_duration
          FROM task_executions
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC`,
    expectedRows: 7
  },
  {
    name: '连接池压力测试 - 并发查询',
    sql: 'SELECT pg_sleep(0.1), * FROM users LIMIT 10',
    expectedRows: 10,
    concurrent: 50
  }
];

// 性能测试类
class DatabasePerformanceTest {
  constructor(config) {
    this.config = config;
    this.results = [];
    this.client = null;
  }

  async connect() {
    console.log('🔗 连接数据库...');
    this.client = new Client(this.config);
    await this.client.connect();
    console.log('✅ 数据库连接成功');
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      console.log('🔌 数据库连接已关闭');
    }
  }

  async testQuery(query, concurrent = 1) {
    const testResults = [];
    
    console.log(`\n🔍 测试查询: ${query.name}`);
    console.log(`   SQL: ${query.sql.substring(0, 80)}...`);
    console.log(`   并发数: ${concurrent}`);
    
    // 执行查询多次取平均值
    const iterations = 10;
    let totalTime = 0;
    let successCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const result = await this.client.query(query.sql);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        totalTime += duration;
        successCount++;
        
        // 验证结果
        if (query.expectedRows && result.rows.length !== query.expectedRows) {
          console.warn(`   ⚠️  第${i+1}次迭代: 期望${query.expectedRows}行，实际${result.rows.length}行`);
        }
        
        testResults.push({
          iteration: i + 1,
          duration,
          rowCount: result.rows.length,
          success: true
        });
        
      } catch (error) {
        console.error(`   ❌ 第${i+1}次迭代失败:`, error.message);
        testResults.push({
          iteration: i + 1,
          duration: 0,
          error: error.message,
          success: false
        });
      }
      
      // 短暂暂停
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avgDuration = successCount > 0 ? totalTime / successCount : 0;
    const successRate = (successCount / iterations) * 100;
    
    console.log(`   📊 平均耗时: ${avgDuration.toFixed(2)}ms`);
    console.log(`   ✅ 成功率: ${successRate.toFixed(1)}%`);
    
    return {
      query: query.name,
      sql: query.sql,
      concurrent,
      iterations,
      avgDuration,
      successRate,
      details: testResults
    };
  }

  async testConcurrentQueries(query, concurrentCount) {
    console.log(`\n⚡ 并发测试: ${query.name} (${concurrentCount}并发)`);
    
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        (async () => {
          const client = new Client(this.config);
          await client.connect();
          
          try {
            const queryStart = performance.now();
            const result = await client.query(query.sql);
            const queryEnd = performance.now();
            
            await client.end();
            
            return {
              success: true,
              duration: queryEnd - queryStart,
              rowCount: result.rows.length
            };
          } catch (error) {
            await client.end();
            return {
              success: false,
              error: error.message,
              duration: 0
            };
          }
        })()
      );
    }
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const avgDuration = successResults.length > 0 
      ? successResults.reduce((sum, r) => sum + r.duration, 0) / successResults.length
      : 0;
    
    const successRate = (successResults.length / concurrentCount) * 100;
    
    console.log(`   📊 总耗时: ${totalTime.toFixed(2)}ms`);
    console.log(`   📊 平均查询耗时: ${avgDuration.toFixed(2)}ms`);
    console.log(`   ✅ 成功率: ${successRate.toFixed(1)}%`);
    console.log(`   ❌ 失败数: ${failedResults.length}`);
    
    return {
      query: query.name,
      concurrent: concurrentCount,
      totalTime,
      avgDuration,
      successRate,
      successCount: successResults.length,
      failCount: failedResults.length,
      details: results
    };
  }

  async runAllTests() {
    console.log('🎯 Facebook Auto Bot 数据库性能测试');
    console.log('='.repeat(60));
    
    await this.connect();
    
    try {
      // 测试数据库连接
      const pingStart = performance.now();
      await this.client.query('SELECT 1 as test');
      const pingEnd = performance.now();
      console.log(`🏓 数据库连接延迟: ${(pingEnd - pingStart).toFixed(2)}ms`);
      
      // 执行测试查询
      for (const query of TEST_QUERIES) {
        if (query.concurrent) {
          const result = await this.testConcurrentQueries(query, query.concurrent);
          this.results.push(result);
        } else {
          const result = await this.testQuery(query);
          this.results.push(result);
        }
      }
      
      // 生成报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
    } finally {
      await this.disconnect();
    }
  }

  generateReport() {
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `db-performance-report-${timestamp}.json`);
    
    // 性能指标分析
    const analysis = {
      summary: {
        totalTests: this.results.length,
        timestamp: new Date().toISOString(),
        database: this.config.database
      },
      performanceMetrics: {
        // 目标值
        targets: {
          simpleQuery: 50,    // 简单查询 < 50ms
          complexQuery: 200,  // 复杂查询 < 200ms
          concurrentQuery: 100, // 并发查询 < 100ms
          successRate: 99.5   // 成功率 > 99.5%
        },
        // 实际结果
        results: this.results.map(r => ({
          query: r.query,
          avgDuration: r.avgDuration,
          successRate: r.successRate,
          status: this.evaluatePerformance(r)
        }))
      },
      recommendations: this.generateRecommendations(),
      rawResults: this.results
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
    
    console.log('\n📊 性能测试报告');
    console.log('='.repeat(60));
    
    // 显示摘要
    console.log('\n📈 性能摘要:');
    this.results.forEach((result, index) => {
      const status = this.evaluatePerformance(result);
      const icon = status.passed ? '✅' : '❌';
      console.log(`${icon} ${result.query}: ${result.avgDuration.toFixed(2)}ms (${result.successRate.toFixed(1)}%)`);
    });
    
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
    
    // 检查是否所有测试都通过
    const allPassed = this.results.every(r => this.evaluatePerformance(r).passed);
    if (allPassed) {
      console.log('\n🎉 所有数据库性能测试通过！');
    } else {
      console.log('\n⚠️  部分数据库性能测试未通过，需要优化。');
    }
  }

  evaluatePerformance(result) {
    // 根据查询类型设置不同的阈值
    let threshold = 100; // 默认阈值 100ms
    
    if (result.query.includes('简单查询')) {
      threshold = 50;
    } else if (result.query.includes('复杂查询')) {
      threshold = 200;
    } else if (result.query.includes('并发查询')) {
      threshold = 150;
    }
    
    const passed = result.avgDuration <= threshold && result.successRate >= 99.5;
    
    return {
      passed,
      threshold,
      durationOk: result.avgDuration <= threshold,
      successRateOk: result.successRate >= 99.5
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    this.results.forEach(result => {
      const evaluation = this.evaluatePerformance(result);
      
      if (!evaluation.durationOk) {
        recommendations.push({
          query: result.query,
          issue: `响应时间过长: ${result.avgDuration.toFixed(2)}ms (阈值: ${evaluation.threshold}ms)`,
          suggestion: '考虑添加索引、优化查询语句或增加缓存'
        });
      }
      
      if (!evaluation.successRateOk) {
        recommendations.push({
          query: result.query,
          issue: `成功率过低: ${result.successRate.toFixed(1)}% (阈值: 99.5%)`,
          suggestion: '检查数据库连接配置、查询语句错误或资源限制'
        });
      }
      
      if (result.concurrent && result.avgDuration > 100) {
        recommendations.push({
          query: result.query,
          issue: `并发性能不足: ${result.avgDuration.toFixed(2)}ms`,
          suggestion: '优化连接池配置、增加数据库资源或使用读写分离'
        });
      }
    });
    
    // 通用建议
    if (recommendations.length === 0) {
      recommendations.push({
        query: '所有查询',
        issue: '性能良好',
        suggestion: '继续保持当前配置，定期监控性能'
      });
    }
    
    return recommendations;
  }
}

// 执行测试
async function main() {
  const tester = new DatabasePerformanceTest(DB_CONFIG);
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabasePerformanceTest;