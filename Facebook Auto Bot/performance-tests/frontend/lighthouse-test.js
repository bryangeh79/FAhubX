#!/usr/bin/env node

/**
 * Facebook Auto Bot 前端性能测试脚本
 * 使用 Lighthouse 进行性能测试
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_URLS = [
  'http://localhost:5173',
  'http://localhost:5173/dashboard',
  'http://localhost:5173/accounts',
  'http://localhost:5173/tasks'
];

const TEST_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    },
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']
  }
};

async function runLighthouseTest(url, options = {}) {
  console.log(`🚀 开始测试: ${url}`);
  
  const chrome = await chromeLauncher.launch({ 
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] 
  });
  
  const runnerResult = await lighthouse(url, {
    port: chrome.port,
    ...options
  }, TEST_CONFIG);
  
  await chrome.kill();
  
  return {
    url,
    report: runnerResult.lhr,
    scores: {
      performance: runnerResult.lhr.categories.performance.score * 100,
      accessibility: runnerResult.lhr.categories.accessibility.score * 100,
      bestPractices: runnerResult.lhr.categories['best-practices'].score * 100,
      seo: runnerResult.lhr.categories.seo.score * 100,
      pwa: runnerResult.lhr.categories.pwa ? runnerResult.lhr.categories.pwa.score * 100 : 0
    },
    metrics: {
      fcp: runnerResult.lhr.audits['first-contentful-paint'].numericValue,
      lcp: runnerResult.lhr.audits['largest-contentful-paint'].numericValue,
      cls: runnerResult.lhr.audits['cumulative-layout-shift'].numericValue,
      fid: runnerResult.lhr.audits['max-potential-fid'].numericValue,
      tti: runnerResult.lhr.audits['interactive'].numericValue,
      speedIndex: runnerResult.lhr.audits['speed-index'].numericValue,
      totalBlockingTime: runnerResult.lhr.audits['total-blocking-time'].numericValue
    }
  };
}

function generateReport(testResults) {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `lighthouse-report-${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  
  // 生成HTML报告
  const htmlReportPath = path.join(reportDir, `lighthouse-report-${timestamp}.html`);
  // 这里可以添加HTML报告生成逻辑
  
  return { jsonReport: reportPath, htmlReport: htmlReportPath };
}

function analyzeResults(testResults) {
  console.log('\n📊 性能测试结果分析');
  console.log('='.repeat(60));
  
  const targetMetrics = {
    performance: 90,
    fcp: 1500, // 1.5秒
    lcp: 2500, // 2.5秒
    cls: 0.1,
    fid: 100 // 100ms
  };
  
  let allPassed = true;
  
  testResults.forEach(result => {
    console.log(`\n🔗 URL: ${result.url}`);
    console.log('-'.repeat(40));
    
    // 检查性能分数
    if (result.scores.performance >= targetMetrics.performance) {
      console.log(`✅ 性能分数: ${result.scores.performance.toFixed(1)} (目标: ${targetMetrics.performance})`);
    } else {
      console.log(`❌ 性能分数: ${result.scores.performance.toFixed(1)} (目标: ${targetMetrics.performance})`);
      allPassed = false;
    }
    
    // 检查核心Web指标
    const metrics = [
      { name: 'FCP', value: result.metrics.fcp, target: targetMetrics.fcp, unit: 'ms' },
      { name: 'LCP', value: result.metrics.lcp, target: targetMetrics.lcp, unit: 'ms' },
      { name: 'CLS', value: result.metrics.cls, target: targetMetrics.cls, unit: '' },
      { name: 'FID', value: result.metrics.fid, target: targetMetrics.fid, unit: 'ms' }
    ];
    
    metrics.forEach(metric => {
      const passed = metric.value <= metric.target;
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${metric.name}: ${metric.value.toFixed(1)}${metric.unit} (目标: ${metric.target}${metric.unit})`);
      
      if (!passed) {
        allPassed = false;
      }
    });
    
    // 显示其他分数
    console.log(`📱 PWA分数: ${result.scores.pwa.toFixed(1)}`);
    console.log(`♿ 无障碍分数: ${result.scores.accessibility.toFixed(1)}`);
    console.log(`🏆 最佳实践分数: ${result.scores.bestPractices.toFixed(1)}`);
    console.log(`🔍 SEO分数: ${result.scores.seo.toFixed(1)}`);
  });
  
  return allPassed;
}

async function main() {
  console.log('🎯 Facebook Auto Bot 前端性能测试');
  console.log('='.repeat(60));
  
  const testResults = [];
  
  try {
    for (const url of TEST_URLS) {
      try {
        const result = await runLighthouseTest(url);
        testResults.push(result);
        console.log(`✅ 完成测试: ${url}\n`);
      } catch (error) {
        console.error(`❌ 测试失败: ${url}`, error.message);
      }
    }
    
    // 生成报告
    const reportFiles = generateReport(testResults);
    console.log(`📄 JSON报告已保存: ${reportFiles.jsonReport}`);
    
    // 分析结果
    const allPassed = analyzeResults(testResults);
    
    if (allPassed) {
      console.log('\n🎉 所有性能指标均达到目标！');
    } else {
      console.log('\n⚠️  部分性能指标未达到目标，需要优化。');
      console.log('\n💡 优化建议:');
      console.log('1. 检查资源加载时间，优化大文件');
      console.log('2. 启用代码分割和懒加载');
      console.log('3. 优化图片和字体资源');
      console.log('4. 检查第三方库的影响');
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 执行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runLighthouseTest, analyzeResults };