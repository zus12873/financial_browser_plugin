// 批量抓取配置页面的JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // 获取UI元素
  const inputTypeSelect = document.getElementById('inputType');
  const urlsInput = document.getElementById('urlsInput');
  const csvInput = document.getElementById('csvInput');
  const urlsTextarea = document.getElementById('urls');
  const csvFileInput = document.getElementById('csvFile');
  const dataTypesSelect = document.getElementById('dataTypes');
  const formatSelect = document.getElementById('format');
  const delayInput = document.getElementById('delay');
  const startBtn = document.getElementById('startBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const resultDiv = document.getElementById('result');
  
  // 设置数据类型全选/取消全选功能
  dataTypesSelect.addEventListener('change', function(event) {
    // 如果点击"全部数据"选项
    if (Array.from(dataTypesSelect.options).findIndex(opt => opt.value === 'all' && opt.selected) !== -1) {
      // 检查是否要全选或取消全选
      const allOption = Array.from(dataTypesSelect.options).find(opt => opt.value === 'all');
      const isAllSelected = allOption.selected;
      
      // 选择或取消选择所有其他选项
      Array.from(dataTypesSelect.options).forEach(opt => {
        if (opt.value !== 'all') {
          opt.selected = isAllSelected;
        }
      });
    }
  });
  
  // 根据输入类型切换UI
  inputTypeSelect.addEventListener('change', function() {
    if (this.value === 'urls') {
      urlsInput.style.display = 'block';
      csvInput.style.display = 'none';
    } else if (this.value === 'csv') {
      urlsInput.style.display = 'none';
      csvInput.style.display = 'block';
    }
  });
  
  // 取消按钮
  cancelBtn.addEventListener('click', function() {
    window.close();
  });
  
  // 开始抓取按钮
  startBtn.addEventListener('click', function() {
    // 重置结果区域
    resultDiv.style.display = 'none';
    resultDiv.className = '';
    resultDiv.textContent = '';
    
    // 获取输入的URLs
    let urls = [];
    
    if (inputTypeSelect.value === 'urls') {
      // 从文本区域获取URLs
      urls = urlsTextarea.value.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    } else if (inputTypeSelect.value === 'csv' && csvFileInput.files.length > 0) {
      // 从上传的CSV文件解析URLs
      showResult('正在解析CSV文件...', 'info');
      
      parseCSVFile(csvFileInput.files[0])
        .then(parsedUrls => {
          if (parsedUrls.length === 0) {
            showResult('CSV文件中未找到有效的URL', 'error');
            return;
          }
          
          // 继续批量抓取流程
          continueWithUrls(parsedUrls);
        })
        .catch(error => {
          showResult('解析CSV文件失败: ' + error, 'error');
        });
      
      return; // 异步处理，这里直接返回
    }
    
    if (urls.length === 0) {
      showResult('请输入至少一个有效的URL', 'error');
      return;
    }
    
    // 继续处理URLs
    continueWithUrls(urls);
  });
  
  // 继续处理URLs的函数
  function continueWithUrls(urls) {
    // 获取选中的数据类型
    const selectedTypes = Array.from(dataTypesSelect.selectedOptions).map(option => option.value);
    
    if (selectedTypes.length === 0) {
      showResult('请选择至少一种数据类型', 'error');
      return;
    }
    
    // 获取其他选项
    const format = formatSelect.value;
    const delay = parseInt(delayInput.value, 10) * 1000; // 转换为毫秒
    
    // 显示数据类型
    let dataTypesDisplay = selectedTypes.join(', ');
    if (selectedTypes.includes('all')) {
      dataTypesDisplay = '全部数据 (所有可用财务表格)';
    }
    
    // 确认批量抓取配置
    const message = `将抓取 ${urls.length} 个页面的财务数据：
- 数据类型: ${dataTypesDisplay}
- 导出格式: ${format}
- 页面间延迟: ${delay/1000}秒

确定继续？`;
    
    if (confirm(message)) {
      startBatchScraping(urls, selectedTypes, format, delay);
    }
  }
  
  // 显示结果信息
  function showResult(message, type) {
    resultDiv.textContent = message;
    resultDiv.className = type;
    resultDiv.style.display = 'block';
  }
  
  // 开始批量抓取
  function startBatchScraping(urls, dataTypes, format, delay) {
    showResult('准备开始批量抓取...', 'info');
    
    // 发送消息到后台脚本
    chrome.runtime.sendMessage(
      {
        action: 'batchScrape',
        urls: urls,
        options: {
          dataTypes: dataTypes,
          format: format,
          delay: delay
        }
      },
      function(response) {
        if (response && response.success) {
          showResult(`批量抓取任务已开始，将抓取 ${urls.length} 个URL。数据将自动下载到您的下载文件夹。`, 'success');
          
          // 添加任务状态监听
          startTaskStatusMonitoring();
        } else {
          showResult('批量抓取失败: ' + (response ? response.error : '未知错误'), 'error');
        }
      }
    );
  }
  
  // 监控批量任务状态
  function startTaskStatusMonitoring() {
    let monitorCount = 0;
    const maxMonitorCount = 100; // 监控最多100次（约200秒），防止无限监控
    
    const intervalId = setInterval(function() {
      monitorCount++;
      chrome.storage.local.get('currentBatchTask', function(result) {
        if (result.currentBatchTask) {
          const task = result.currentBatchTask;
          
          if (!task.inProgress) {
            // 任务已完成
            clearInterval(intervalId);
            
            const successCount = task.results.filter(r => r.success).length;
            const resultMessage = `批量抓取完成！成功: ${successCount}/${task.total}`;
            
            // 检查是否有下载的文件
            if (successCount > 0) {
              showResult(resultMessage + "。数据已下载到您的下载文件夹。", 'success');
              
              // 添加查看结果的链接
              const resultDiv = document.getElementById('result');
              const viewLink = document.createElement('a');
              viewLink.href = 'visualization.html';
              viewLink.textContent = '点击查看数据可视化';
              viewLink.target = '_blank';
              viewLink.className = 'view-link';
              resultDiv.appendChild(document.createElement('br'));
              resultDiv.appendChild(viewLink);
            } else {
              showResult(resultMessage + "。未能成功抓取任何数据，请检查URL是否正确。", 'error');
            }
          } else {
            // 任务进行中，更新进度
            const progressMessage = `正在抓取... ${task.completed}/${task.total} 已完成`;
            showResult(progressMessage, 'progress');
            
            // 显示已完成的URL和状态
            let detailsHtml = '<div class="batch-details">';
            detailsHtml += '<h4>处理详情:</h4>';
            detailsHtml += '<ul>';
            
            task.results.forEach((result, idx) => {
              const url = task.urls[idx];
              const urlDisplay = url.length > 50 ? url.substring(0, 47) + '...' : url;
              const status = result.success ? 
                             '<span class="success">✓ 成功</span>' : 
                             `<span class="error">✗ 失败 (${result.error || '未知错误'})</span>`;
              
              detailsHtml += `<li>${urlDisplay}: ${status}</li>`;
            });
            
            // 添加正在处理的URL
            if (task.completed < task.total) {
              const currentUrl = task.urls[task.completed];
              const urlDisplay = currentUrl.length > 50 ? currentUrl.substring(0, 47) + '...' : currentUrl;
              detailsHtml += `<li>${urlDisplay}: <span class="progress">⟳ 正在处理...</span></li>`;
            }
            
            detailsHtml += '</ul></div>';
            
            // 添加到结果div
            const resultDiv = document.getElementById('result');
            // 查找或创建详情容器
            let detailsContainer = document.getElementById('batch-details-container');
            if (!detailsContainer) {
              detailsContainer = document.createElement('div');
              detailsContainer.id = 'batch-details-container';
              resultDiv.appendChild(detailsContainer);
            }
            detailsContainer.innerHTML = detailsHtml;
          }
        }
        
        // 防止无限监控
        if (monitorCount >= maxMonitorCount) {
          clearInterval(intervalId);
          showResult('监控已超时。请检查"下载"文件夹查看是否有已抓取的数据文件。', 'warning');
        }
      });
    }, 2000); // 每2秒更新一次状态
  }
  
  // 解析CSV文件
  function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(event) {
        try {
          const csvData = event.target.result;
          // 处理不同操作系统的换行符
          const lines = csvData.split(/\r\n|\r|\n/);
          
          if (lines.length === 0) {
            reject('CSV文件为空');
            return;
          }
          
          // 检测分隔符 - 有些Windows系统可能使用分号代替逗号
          let delimiter = ',';
          const firstLine = lines[0];
          if (firstLine.indexOf(';') > -1 && firstLine.indexOf(',') === -1) {
            delimiter = ';';
          }
          
          const headers = splitCSVLine(firstLine, delimiter);
          
          // 查找URL列的索引
          const urlIndex = headers.findIndex(h => 
            h.toLowerCase().trim() === 'url' || 
            h.toLowerCase().includes('url') ||
            h.toLowerCase().includes('链接')
          );
          
          if (urlIndex === -1) {
            // 如果找不到URL列，尝试直接使用每行的第一列
            const urls = [];
            
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              
              // 简单分割，第一列作为URL
              const firstColumn = splitCSVLine(lines[i], delimiter)[0].trim();
              
              // 检查是否是有效的URL
              if (firstColumn && (firstColumn.startsWith('http') || firstColumn.startsWith('www'))) {
                urls.push(firstColumn);
              }
            }
            
            if (urls.length === 0) {
              reject('CSV文件中未找到有效的URL列');
            } else {
              resolve(urls);
            }
            return;
          }
          
          const urls = [];
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // 处理CSV中的引号等特殊情况
            const columns = parseCSVLine(lines[i], delimiter);
            
            if (urlIndex < columns.length) {
              const url = columns[urlIndex].trim().replace(/"/g, '');
              
              if (url && (url.startsWith('http') || url.startsWith('www'))) {
                // 确保URL格式正确
                urls.push(url.startsWith('www') ? 'https://' + url : url);
              }
            }
          }
          
          resolve(urls);
        } catch (error) {
          reject('解析CSV时出错: ' + error.message);
        }
      };
      
      reader.onerror = function() {
        reject('读取CSV文件失败');
      };
      
      reader.readAsText(file);
    });
  }
  
  // 简单分割CSV行
  function splitCSVLine(line, delimiter = ',') {
    if (!line) return [];
    return line.split(delimiter).map(item => item.trim());
  }
  
  // 处理CSV行，考虑引号内的逗号
  function parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // 添加最后一列
    result.push(current);
    
    return result;
  }
}); 