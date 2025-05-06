// 当弹出窗口加载时初始化
document.addEventListener('DOMContentLoaded', function() {
  // 获取UI元素
  const scrapeBtn = document.getElementById('scrapeBtn');
  const batchBtn = document.getElementById('batchBtn');
  const visualizeBtn = document.getElementById('visualizeBtn');
  const indexBtn = document.getElementById('indexBtn');
  const statusDiv = document.getElementById('status');
  const dataTypeSelect = document.getElementById('dataType');
  const formatSelect = document.getElementById('format');
  
  // 检查当前页面并初始化UI
  initializeUI();
  
  // 添加事件监听器
  scrapeBtn.addEventListener('click', handleScrapeButtonClick);
  batchBtn.addEventListener('click', () => chrome.tabs.create({url: 'batch.html'}));
  visualizeBtn.addEventListener('click', openVisualizationPage);
  indexBtn.addEventListener('click', openIndexPage);
  
  // 监听来自content script的异步消息
  chrome.runtime.onMessage.addListener(handleAsyncMessages);
  
  // 打开财务分析平台页面
  function openIndexPage() {
    chrome.tabs.create({url: 'index.html'});
  }
  
  // 初始化UI - 检查当前页面是否包含财务数据
  function initializeUI() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) {
        showStatus('无法获取当前标签页', 'error');
        return;
      }
      
      const currentTab = tabs[0];
      
      // 检查当前页面是否包含财务数据
      chrome.tabs.sendMessage(currentTab.id, {action: "checkPage"}, function(response) {
        if (chrome.runtime.lastError) {
          console.error("通信错误:", chrome.runtime.lastError);
          showStatus('与页面通信失败，请刷新页面', 'error');
          return;
        }
        
        if (response && response.hasFinancialData) {
          // 页面有财务数据, 启用抓取按钮
          scrapeBtn.disabled = false;
        } else {
          // 页面没有财务数据, 禁用抓取按钮
          scrapeBtn.disabled = true;
          showStatus('当前页面未检测到财务数据表格', 'error');
        }
      });
    });
  }
  
  // 处理抓取按钮点击
  function handleScrapeButtonClick() {
    showStatus('正在抓取数据...', 'progress');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) {
        showStatus('无法获取当前标签页', 'error');
        return;
      }
      
      const currentTab = tabs[0];
      
      // 根据用户选择获取正确的数据类型
      let selectedDataType = dataTypeSelect.value;
      
      // 发送消息到当前页面的content script
      chrome.tabs.sendMessage(
        currentTab.id, 
        {
          action: "scrapeData",
          dataType: selectedDataType,
          format: formatSelect.value
        }, 
        function(response) {
          // 检查通信错误
          if (chrome.runtime.lastError) {
            console.error("通信错误:", chrome.runtime.lastError);
            showStatus('与页面通信失败，请刷新页面', 'error');
            return;
          }
          
          if (response && response.processing) {
            // 这是异步操作，结果将通过chrome.runtime.onMessage发送
            console.log('异步处理中，等待结果...');
            // 不要在这里触发下载，等待异步消息
          } else if (response && response.success) {
            showStatus(`数据抓取成功! 已保存为${formatSelect.value.toUpperCase()}格式`, 'success');
            
            // 只有非异步响应时才在这里触发下载弹窗
            if (response.data) {
              downloadData(response.data, response.fileName || generateDefaultFileName(formatSelect.value), response.mimeType);
            }
          } else {
            showStatus('数据抓取失败: ' + (response ? response.error : '未知错误'), 'error');
          }
        }
      );
    });
  }
  
  // 处理异步消息
  function handleAsyncMessages(message, sender, sendResponse) {
    // 检查是否是来自同一页面的结果消息，并且不是批量抓取或后台消息
    if (message.action === 'scrapeDataResult' && 
        !message.isBackgroundMessage && 
        (!message.tabId || sender.tab)) {
      
      const result = message.result;
      
      // 检查这个消息是否是我们正在等待的结果
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        // 如果发送消息的标签不是当前活动标签，忽略它
        if (!tabs || !tabs[0] || (sender.tab && sender.tab.id !== tabs[0].id)) {
          console.log('忽略非活动标签页的消息');
          return;
        }
        
        console.log('接收到抓取结果消息:', result);
        
        if (result && result.success) {
          showStatus(`数据抓取成功! 已保存为${result.extension.toUpperCase()}格式`, 'success');
          
          // 触发下载弹窗
          if (result.data) {
            downloadData(result.data, result.fileName, result.mimeType);
          }
        } else {
          showStatus('数据抓取失败: ' + (result ? result.error : '未知错误'), 'error');
        }
      });
    }
  }
  
  // 打开可视化页面
  function openVisualizationPage() {
    // 设置标记，通知可视化页面检查最新数据
    chrome.storage.local.set({'visualizeFromPopup': true}, function() {
      // 打开数据可视化页面
      chrome.tabs.create({url: 'visualization.html'});
    });
  }
  
  // 生成默认文件名
  function generateDefaultFileName(format) {
    const date = new Date().toISOString().split('T')[0];
    return `financial_data_${date}.${format}`;
  }
  
  // 辅助函数 - 显示状态信息
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }
  
  // 辅助函数 - 下载数据（使用弹窗）
  function downloadData(data, filename, mimeType) {
    // 确保文件名对Windows和macOS都有效
    const sanitizedFilename = sanitizeFilename(filename);
    
    // 使用下载弹窗
    if (window.downloadModal) {
      window.downloadModal.show(data, sanitizedFilename, mimeType);
    } else {
      // 备用方法，直接下载
    const blob = new Blob([data], {type: mimeType || 'text/plain'});
    const dataUrl = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: dataUrl,
      filename: sanitizedFilename,
      saveAs: true
    }, function(downloadId) {
      // 清理URL对象以避免内存泄漏
      if (downloadId !== undefined) {
        setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
      }
    });
    }
  }
  
  // 辅助函数 - 清理文件名
  function sanitizeFilename(filename) {
    if (!filename) {
      // 默认文件名
      return `financial_data_${formatDate(new Date())}.csv`;
    }
    
    // 移除Windows不允许的字符: \ / : * ? " < > |
    let sanitized = filename.replace(/[\\/:*?"<>|]/g, '_');
    
    // 限制文件名长度
    if (sanitized.length > 200) {
      const extension = sanitized.split('.').pop();
      sanitized = sanitized.substring(0, 196) + '.' + extension;
    }
    
    return sanitized;
  }
  
  // 辅助函数 - 格式化日期
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
