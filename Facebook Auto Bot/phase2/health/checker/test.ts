/**
 * 健康检查引擎测试
 */

import { HealthCheckEngineManager } from './index';

async function runTests() {
  console.log('=== 健康检查引擎测试 ===\n');
  
  const manager = new HealthCheckEngineManager();
  
  try {
    // 1. 创建引擎
    console.log('1. 创建健康检查引擎...');
    const engine = manager.createEngine('test-engine', {
      scheduler: {
        maxConcurrentChecks: 3,
        scheduling: {
          checkInterval: 10000, // 10秒
          batchSize: 5,
          maxQueueSize: 100
        }
      },
      executor: {
        checkInterval: 300000,
        thresholds: {
          healthScore: {
            healthy: 80,
            warning: 60,
            critical: 60
          },
          banRiskScore: {
            low: 30,
            medium: 60,
            high: 80,
            critical: 80
          }
        }
      }
    });
    
    console.log('✓ 引擎创建成功\n');
    
    // 2. 启动引擎
    console.log('2. 启动引擎...');
    await manager.startEngine('test-engine');
    console.log('✓ 引擎启动成功\n');
    
    // 3. 获取初始状态
    console.log('3. 获取引擎状态...');
    const initialStatus = manager.getEngineStatus('test-engine');
    console.log('初始状态:', JSON.stringify(initialStatus, null, 2));
    console.log('✓ 状态获取成功\n');
    
    // 4. 安排一些测试检查
    console.log('4. 安排测试检查...');
    
    // 安排登录检查
    engine.scheduler.scheduleCheck({
      accountId: 'test-account-1',
      checkType: 'login',
      priority: 'high'
    });
    
    // 安排会话检查
    engine.scheduler.scheduleCheck({
      accountId: 'test-account-2',
      checkType: 'session',
      priority: 'medium'
    });
    
    // 安排性能检查
    engine.scheduler.scheduleCheck({
      accountId: 'test-account-3',
      checkType: 'performance',
      priority: 'low'
    });
    
    console.log('✓ 测试检查安排成功\n');
    
    // 5. 等待检查执行
    console.log('5. 等待检查执行（5秒）...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 6. 获取执行后的状态
    console.log('6. 获取执行后状态...');
    const afterStatus = manager.getEngineStatus('test-engine');
    console.log('执行后状态:', JSON.stringify(afterStatus, null, 2));
    
    // 检查执行统计
    if (afterStatus.executor.totalExecutions > 0) {
      console.log('✓ 检查执行成功');
      console.log(`   执行总数: ${afterStatus.executor.totalExecutions}`);
      console.log(`   成功数: ${afterStatus.executor.successfulExecutions}`);
      console.log(`   失败数: ${afterStatus.executor.failedExecutions}`);
      console.log(`   平均执行时间: ${afterStatus.executor.avgExecutionTime.toFixed(2)}ms\n`);
    } else {
      console.log('✗ 没有检查被执行\n');
    }
    
    // 7. 测试批量检查
    console.log('7. 测试批量检查...');
    const accountIds = Array.from({ length: 10 }, (_, i) => `batch-account-${i + 1}`);
    
    const batchResults = await engine.executor.executeBatchChecks(
      accountIds,
      'login',
      2 // 并发数
    );
    
    console.log(`批量检查完成: ${batchResults.size}/${accountIds.length} 成功\n`);
    
    // 8. 获取检查历史
    console.log('8. 获取检查历史...');
    const history = engine.executor.getExecutionHistory('test-account-1', 5);
    
    if (history.length > 0) {
      console.log('最近5次检查历史:');
      history.forEach((execution, index) => {
        console.log(`  ${index + 1}. ${execution.result.checkType}: ${execution.result.status} (${execution.executionTime}ms)`);
      });
      console.log('');
    }
    
    // 9. 获取执行统计
    console.log('9. 获取详细执行统计...');
    const stats = engine.executor.getExecutionStatistics();
    
    console.log('按检查类型统计:');
    Object.entries(stats.byCheckType).forEach(([checkType, typeStats]) => {
      console.log(`  ${checkType}:`);
      console.log(`    执行次数: ${typeStats.count}`);
      console.log(`    成功率: ${typeStats.successRate.toFixed(1)}%`);
      console.log(`    平均时间: ${typeStats.avgTime.toFixed(2)}ms`);
    });
    console.log('');
    
    // 10. 停止引擎
    console.log('10. 停止引擎...');
    await manager.stopEngine('test-engine');
    console.log('✓ 引擎停止成功\n');
    
    // 11. 清理
    console.log('11. 清理资源...');
    await manager.destroyEngine('test-engine');
    console.log('✓ 资源清理成功\n');
    
    console.log('=== 所有测试完成 ===');
    console.log('✓ 健康检查引擎功能正常');
    
  } catch (error) {
    console.error('测试失败:', error);
    
    // 确保清理资源
    try {
      await manager.destroyAllEngines();
    } catch (cleanupError) {
      console.error('清理资源时出错:', cleanupError);
    }
    
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

export { runTests };