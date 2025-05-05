// 批量抓取页面的JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 获取UI元素
  const setupContainer = document.getElementById('setupContainer');
  const progressContainer = document.getElementById('progressContainer');
  const urlsInput = document.getElementById('urlsInput');
  const formatSelect = document.getElementById('formatSelect');
  const delayInput = document.getElementById('delayInput');
  const startBtn = document.getElementById('startBtn');
  const backBtn = document.getElementById('backBtn');
  const backToSetupBtn = document.getElementById('backToSetupBtn');
  const progressBar = document.getElementById('progressBar');
  const progressStats = document.getElementById('progressStats');
  const resultsTable = document.getElementById('resultsTable').querySelector('tbody');
  
  // 添加事件监听器
  startBtn.addEventListener('click', startBatchScrape);
  backBtn.addEventListener('click', () => window.close());
  backToSetupBtn.addEventListener('click', showSetupView);
  
  // 检查是否有未完成的任务
  checkExistingTask();
  
  // 检查是否有未完成的任务
  function checkExistingTask() {
    chrome.storage.local.get('currentBatchTask', function(data) {
      if (data.currentBatchTask && data.currentBatchTask.inProgress) {
        // 有未完成的任务，显示进度视图
        setupContainer.style.display = 'none';
        progressContainer.style.display = 'block';
        
        // 更新UI
        updateProgressUI(data.currentBatchTask);
        
        // 开始监控任务状态
        startTaskMonitoring();
      }
    });
  }
  
  // 显示设置视图
  function showSetupView() {
    setupContainer.style.display = 'block';
    progressContainer.style.display = 'none';
  }
  
  // 显示进度视图
  function showProgressView() {
    setupContainer.style.display = 'none';
    progressContainer.style.display = 'block';
  }
  
  // 开始批量抓取
  function startBatchScrape() {
    // 获取URLs
    const urls = urlsInput.value.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) {
      alert('请输入至少一个有效的URL');
      return;
    }
    
    // 使用所有数据类型
    const selectedTypes = ['income', 'balance', 'cash', 'main'];
    
    // 获取其他选项
    const format = formatSelect.value;
    const delay = parseInt(delayInput.value, 10) * 1000; // 转换为毫秒
    
    // 创建批量任务
    const batchTask = {
      urls: urls,
      options: {
        dataTypes: selectedTypes,
        format: format,
        delay: delay
      }
    };
    
    // 发送消息到后台脚本
    chrome.runtime.sendMessage(
      {
        action: 'batchScrape',
        urls: urls,
        options: {
          dataTypes: selectedTypes,
          format: format,
          delay: delay
        }
      },
      function(response) {
        if (response && response.success) {
          // 显示进度视图
          showProgressView();
          
          // 清空结果表格
          resultsTable.innerHTML = '';
          
          // 初始化进度
          progressBar.style.width = '0%';
          progressStats.textContent = `0/${urls.length} 完成`;
          
          // 开始监控任务状态
          startTaskMonitoring();
        } else {
          alert('批量抓取失败: ' + (response ? response.error : '未知错误'));
        }
      }
    );
  }
  
  // 监控任务状态
  function startTaskMonitoring() {
    const intervalId = setInterval(function() {
      chrome.storage.local.get('currentBatchTask', function(data) {
        if (data.currentBatchTask) {
          // 更新UI
          updateProgressUI(data.currentBatchTask);
          
          // 如果任务已完成，停止监控
          if (!data.currentBatchTask.inProgress) {
            clearInterval(intervalId);
          }
        }
      });
    }, 1000);
  }
  
  // 更新进度UI
  function updateProgressUI(task) {
    // 更新进度条
    const progress = (task.completed / task.total) * 100;
    progressBar.style.width = `${progress}%`;
    progressStats.textContent = `${task.completed}/${task.total} 完成`;
    
    // 清空结果表格并重新填充
    resultsTable.innerHTML = '';
    
    // 构建结果表格
    task.results.forEach((result, index) => {
      const row = document.createElement('tr');
      
      // URL单元格
      const urlCell = document.createElement('td');
      const urlText = task.urls[index];
      urlCell.textContent = urlText.length > 50 ? urlText.substring(0, 47) + '...' : urlText;
      urlCell.title = task.urls[index]; // 鼠标悬停显示完整URL
      row.appendChild(urlCell);
      
      // 状态单元格
      const statusCell = document.createElement('td');
      if (result.processing) {
        statusCell.innerHTML = '<span class="status-processing">处理中...</span>';
      } else if (result.success) {
        statusCell.innerHTML = '<span class="status-success">成功</span>';
      } else {
        statusCell.innerHTML = `<span class="status-error">失败: ${result.error || '未知错误'}</span>`;
      }
      row.appendChild(statusCell);
      
      // 操作单元格
      const actionCell = document.createElement('td');
      
      // 如果抓取成功，添加下载按钮
      if (result.success && result.data) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'action-btn download-btn';
        downloadBtn.textContent = '下载';
        downloadBtn.addEventListener('click', function() {
          // 使用下载弹窗显示结果
          if (window.downloadModal) {
            window.downloadModal.show(
              result.data, 
              result.fileName || `batch_financial_data_${index + 1}.${task.options.format}`,
              result.mimeType || (task.options.format === 'csv' ? 'text/csv' : 'application/json')
            );
          } else {
            // 备用直接下载
            downloadData(
              result.data, 
              result.fileName || `batch_financial_data_${index + 1}.${task.options.format}`,
              result.mimeType || (task.options.format === 'csv' ? 'text/csv' : 'application/json')
            );
          }
        });
        actionCell.appendChild(downloadBtn);
      } else if (!result.processing) {
        // 如果已处理但失败，显示重试按钮
        const retryBtn = document.createElement('button');
        retryBtn.className = 'action-btn retry-btn';
        retryBtn.textContent = '重试';
        retryBtn.addEventListener('click', function() {
          // 实现重试逻辑
          alert('重试功能尚未实现');
        });
        actionCell.appendChild(retryBtn);
      }
      
      row.appendChild(actionCell);
      resultsTable.appendChild(row);
    });
    
    // 如果有正在处理中的URL
    if (task.completed < task.total) {
      const currentIndex = task.completed;
      const currentUrl = task.urls[currentIndex];
      
      const row = document.createElement('tr');
      
      // URL单元格
      const urlCell = document.createElement('td');
      const urlText = currentUrl;
      urlCell.textContent = urlText.length > 50 ? urlText.substring(0, 47) + '...' : urlText;
      urlCell.title = currentUrl;
      row.appendChild(urlCell);
      
      // 状态单元格
      const statusCell = document.createElement('td');
      statusCell.innerHTML = '<span class="status-processing">处理中...</span>';
      row.appendChild(statusCell);
      
      // 空操作单元格
      const actionCell = document.createElement('td');
      row.appendChild(actionCell);
      
      resultsTable.appendChild(row);
    }
  }
  
  // 直接下载数据（备用方法）
  function downloadData(data, filename, mimeType) {
    // 创建Blob对象
    const blob = new Blob([data], {type: mimeType || 'text/plain'});
    const url = URL.createObjectURL(blob);
    
    // 使用Chrome下载API
    chrome.downloads.download({
      url: url,
      filename: sanitizeFilename(filename),
      saveAs: true
    }, function(downloadId) {
      // 清理URL
      if (downloadId !== undefined) {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        console.error('下载失败:', chrome.runtime.lastError);
        
        // 备用下载方法
        const a = document.createElement('a');
        a.href = url;
        a.download = sanitizeFilename(filename);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    });
  }
  
  // 清理文件名
  function sanitizeFilename(filename) {
    if (!filename) return 'financial_data.csv';
    
    // 替换Windows不允许的字符
    let sanitized = filename.replace(/[\\/:*?"<>|]/g, '_');
    
    // 限制文件名长度
    if (sanitized.length > 200) {
      const extension = sanitized.split('.').pop();
      sanitized = sanitized.substring(0, 196) + '.' + extension;
    }
    
    return sanitized;
  }
}); 