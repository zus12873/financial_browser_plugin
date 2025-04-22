// 金融数据抓取器 - 后台脚本

// 检测操作系统类型
let isWindows = false;

// 监听扩展安装或更新事件
chrome.runtime.onInstalled.addListener(function() {
  console.log('金融数据抓取器扩展已安装/更新');
  
  // 检测操作系统
  if (navigator.userAgent.indexOf("Windows") !== -1) {
    isWindows = true;
    console.log('检测到Windows操作系统');
  }
  
  // 初始化存储空间
  chrome.storage.local.set({
    'savedData': [],
    'settings': {
      'defaultFormat': 'csv',
      'autoDetect': true,
      'isWindows': isWindows
    }
  }, function() {
    console.log('初始化存储完成');
  });
});

// 监听来自内容脚本和弹出窗口的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // 存储抓取到的数据
  if (request.action === 'saveData') {
    saveFinancialData(request.data, request.info, function(result) {
      sendResponse(result);
    });
    return true;
  }
  
  // 执行批量抓取
  else if (request.action === 'batchScrape') {
    executeBatchScrape(request.urls, request.options, function(result) {
      sendResponse(result);
    });
    return true;
  }
  
  // 从内容脚本接收结果并转发到弹出窗口
  else if (request.action === 'scrapeDataResult') {
    // 检查是否是批量抓取的异步结果
    if (request.isBackgroundMessage && request.result) {
      console.log("收到批量抓取的异步结果:", request.timestamp);
      console.log("结果状态:", request.result.success ? "成功" : "失败");
      console.log("是否有数据:", request.result.hasData ? "是" : "否");
      
      // 获取当前批量任务状态
      chrome.storage.local.get('currentBatchTask', function(data) {
        if (!data.currentBatchTask) {
          console.error("找不到当前批量任务数据");
          return;
        }
        
        if (!data.currentBatchTask.inProgress) {
          console.log("批量任务已不再进行中");
          return;
        }
        
        const batchTask = data.currentBatchTask;
        
        // 尝试识别请求对应的URL索引
        let currentIndex = -1;
        
        // 如果有请求ID，解析出索引
        if (request.requestId) {
          const parts = request.requestId.split('_');
          if (parts.length > 2) {
            currentIndex = parseInt(parts[2]);
            console.log(`通过请求ID ${request.requestId} 解析得到索引: ${currentIndex}`);
          }
        }
        
        // 如果没有找到索引，尝试找到标记为processing的结果
        if (currentIndex === -1) {
          // 找到第一个标记为processing的结果项
          currentIndex = batchTask.results.findIndex(r => r.processing === true);
          console.log(`尝试查找处理中的任务，找到索引: ${currentIndex}`);
        }
        
        // 如果仍然找不到索引，使用已完成的任务数作为索引
        if (currentIndex === -1 || currentIndex >= batchTask.results.length) {
          // 回退到使用已完成计数减一
          currentIndex = batchTask.completed - 1;
          console.log(`无法找到处理中的任务，使用已完成计数作为索引: ${currentIndex}`);
        }
        
        // 确保索引有效
        if (currentIndex >= 0 && currentIndex < batchTask.urls.length) {
          const currentUrl = batchTask.urls[currentIndex];
          
          if (request.result.success) {
            console.log(`收到异步结果: URL ${currentUrl} 抓取成功`);
            
            // 如果异步结果包含数据，下载它
            if (request.result.data) {
              // 处理文件名以兼容Windows
              let filename = request.result.fileName || `batch_financial_data_${currentIndex + 1}.${request.result.extension || batchTask.options.format}`;
              if (isWindows) {
                filename = sanitizeFilename(filename);
              }
              
              console.log(`准备下载异步抓取的文件: ${filename}`);
              console.log(`数据长度: ${request.result.data.length}, MIME类型: ${request.result.mimeType || 'text/plain'}`);
              
              // 处理添加BOM的情况
              let blobData = request.result.data;
              if (request.result.addBOM) {
                blobData = '\ufeff' + request.result.data;
              }
              
              try {
                // 创建数据URI
                const base64Data = btoa(unescape(encodeURIComponent(blobData)));
                console.log(`Base64数据长度: ${base64Data.length}`);
                const dataUri = `data:${request.result.mimeType || 'text/plain'};base64,${base64Data}`;
                
                // 调用下载API
                console.log("开始下载...");
                chrome.downloads.download({
                  url: dataUri,
                  filename: filename,
                  saveAs: false
                }, function(downloadId) {
                  if (chrome.runtime.lastError) {
                    console.error('下载异步数据出错:', chrome.runtime.lastError);
                  } else if (!downloadId) {
                    console.error('下载ID为空，下载可能失败');
                  } else {
                    console.log(`异步数据下载已开始，ID: ${downloadId}`);
                  }
                });
              } catch (error) {
                console.error("下载过程中出错:", error);
                
                // 尝试备用下载方法
                try {
                  console.log("尝试使用直接消息触发下载...");
                  
                  // 发送消息到当前活动的标签页，尝试下载
                  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs && tabs.length > 0) {
                      chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'directDownload',
                        data: blobData,
                        filename: filename,
                        mimeType: request.result.mimeType || 'text/plain'
                      });
                    }
                  });
                } catch (backupError) {
                  console.error("备用下载方法也失败:", backupError);
                }
              }
              
              // 更新批量任务结果
              batchTask.results[currentIndex] = {
                url: currentUrl,
                success: true,
                data: request.result.data,
                fileName: filename
              };
              
              // 更新completed计数（如果尚未更新）
              if (currentIndex >= batchTask.completed) {
                batchTask.completed = currentIndex + 1;
              }
              
              // 保存更新的批量任务状态
              chrome.storage.local.set({'currentBatchTask': batchTask});
            }
          } else {
            console.log(`收到异步结果: URL ${currentUrl} 抓取失败:`, request.result.error);
            
            // 更新批量任务结果
            batchTask.results[currentIndex] = {
              url: currentUrl,
              success: false,
              error: request.result.error || '异步抓取失败'
            };
            
            // 更新completed计数（如果尚未更新）
            if (currentIndex >= batchTask.completed) {
              batchTask.completed = currentIndex + 1;
            }
            
            // 保存更新的批量任务状态
            chrome.storage.local.set({'currentBatchTask': batchTask});
          }
        } else {
          console.error(`无效的索引: ${currentIndex}, 结果数组长度: ${batchTask.results.length}`);
        }
      });
    }
    
    // 转发消息到所有打开的插件页面
    chrome.runtime.sendMessage(request);
    return true;
  }
  
  // 获取系统类型
  else if (request.action === 'getSystemInfo') {
    sendResponse({
      isWindows: isWindows
    });
    return true;
  }
});

// 保存抓取到的财务数据
function saveFinancialData(data, info, callback) {
  chrome.storage.local.get('savedData', function(result) {
    let savedData = result.savedData || [];
    
    // 添加新数据和时间戳
    savedData.push({
      data: data,
      info: info,
      timestamp: new Date().toISOString()
    });
    
    // 限制存储的数据项数量
    if (savedData.length > 50) {
      savedData = savedData.slice(-50);
    }
    
    // 存储更新后的数据
    chrome.storage.local.set({'savedData': savedData}, function() {
      callback({ success: true });
    });
  });
}

// 处理文件名以兼容Windows系统
function sanitizeFilename(filename) {
  if (!filename) return 'financial_data.csv';
  
  // 替换Windows不允许的字符
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}

// 执行批量抓取
function executeBatchScrape(urls, options, callback) {
  // 保存批量抓取任务状态
  const batchTask = {
    urls: urls,
    options: options,
    completed: 0,
    total: urls.length,
    results: [],
    inProgress: true,
    startTime: new Date().toISOString(),
    isWindows: isWindows
  };
  
  // 将批量任务信息存储到本地存储
  chrome.storage.local.set({'currentBatchTask': batchTask}, function() {
    // 开始处理第一个URL
    processNextUrl(0, batchTask, callback);
  });
}

// 递归处理URL列表
function processNextUrl(index, batchTask, callback) {
  if (index >= batchTask.urls.length) {
    // 所有URL都已处理完成
    batchTask.inProgress = false;
    batchTask.completedTime = new Date().toISOString();
    
    console.log('批量抓取任务全部完成，保存结果');
    chrome.storage.local.set({'currentBatchTask': batchTask, 'lastCompletedBatch': batchTask}, function() {
      callback({
        success: true,
        message: `已完成所有${batchTask.total}个URL的抓取`,
        resultsCount: batchTask.results.filter(r => r.success).length
      });
    });
    return;
  }
  
  const currentUrl = batchTask.urls[index];
  console.log(`处理URL ${index + 1}/${batchTask.total}: ${currentUrl}`);
  
  // 打开一个新标签页
  chrome.tabs.create({url: currentUrl, active: false}, function(tab) {
    console.log(`已创建标签页 ID: ${tab.id} 用于 URL: ${currentUrl}`);
    
    // 给脚本加载留出时间
    setTimeout(function() {
      console.log(`开始向标签页 ${tab.id} 发送抓取命令`);
      
      // 设置数据类型 - 如果选择了多种类型，使用 'all' 一次性抓取所有表格
      const selectedTypes = batchTask.options.dataTypes || [];
      let dataType = 'all';
      
      // 如果只选择了一种类型，则直接使用该类型
      if (selectedTypes.length === 1) {
        dataType = selectedTypes[0];
      } 
      // 如果选择了多种类型，但没有选择全部四种类型，则提示可能无法完全满足
      else if (selectedTypes.length > 0 && selectedTypes.length < 4) {
        console.log(`选择了多种数据类型 ${selectedTypes.join(', ')}，将尝试全部抓取`);
      }
      
      // 向标签页发送抓取命令
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: 'scrapeData',
          dataType: dataType, // 使用'all'抓取所有表格，或使用特定类型
          format: batchTask.options.format || 'csv',
          isWindows: batchTask.isWindows,
          isBatchScrape: true // 标记为批量抓取请求
        },
        function(response) {
          if (chrome.runtime.lastError) {
            console.error('发送消息时出错:', chrome.runtime.lastError);
            
            // 尝试再次发送消息
            console.log('尝试再次发送消息...');
            setTimeout(() => {
              chrome.tabs.sendMessage(
                tab.id,
                {
                  action: 'scrapeData',
                  dataType: dataType,
                  format: batchTask.options.format || 'csv',
                  isWindows: batchTask.isWindows,
                  isBatchScrape: true,
                  retry: true
                },
                function(retryResponse) {
                  if (chrome.runtime.lastError || !retryResponse) {
                    console.error('重试发送消息失败:', chrome.runtime.lastError);
                    
                    // 记录失败
                    batchTask.results.push({
                      url: currentUrl,
                      success: false,
                      error: chrome.runtime.lastError ? chrome.runtime.lastError.message : '内容脚本未响应'
                    });
                    
                    // 关闭标签页
                    chrome.tabs.remove(tab.id);
                    
                    // 更新批量任务状态
                    batchTask.completed++;
                    chrome.storage.local.set({'currentBatchTask': batchTask}, function() {
                      // 等待指定的延迟后，处理下一个URL
                      setTimeout(function() {
                        processNextUrl(index + 1, batchTask, callback);
                      }, batchTask.options.delay || 3000);
                    });
                  } else {
                    // 处理重试响应，与下面的代码相同
                    handleBatchResponse(retryResponse, currentUrl, tab.id, index, batchTask, callback);
                  }
                }
              );
            }, 3000); // 再等3秒后重试
            
            return;
          }
          
          handleBatchResponse(response, currentUrl, tab.id, index, batchTask, callback);
        }
      );
    }, 8000); // 增加到8秒，给页面更多加载时间
  });
}

// 处理批量抓取响应
function handleBatchResponse(response, currentUrl, tabId, index, batchTask, callback) {
  console.log(`收到标签页 ${tabId} 的响应:`, response);
  
  if (response && (response.success || response.processing)) {
    // 如果是异步操作，设置一个更长的超时
    if (response.processing) {
      console.log(`URL ${currentUrl} 正在异步处理中...`);
      
      // 只记录正在处理的状态，等待异步完成消息
      batchTask.results.push({
        url: currentUrl,
        success: true,
        processing: true
      });
      
      // 向content script注册一个临时ID，以便它在完成后可以标识该请求
      const requestId = `batch_${Date.now()}_${index}`;
      
      // 在关闭标签页前，发送一个请求ID以便内容脚本可以在发送结果时包含该ID
      chrome.tabs.sendMessage(tabId, {
        action: 'registerRequestId',
        requestId: requestId,
        isBatchScrape: true
      }, function() {
        // 关闭标签页前先设置一个超长监听，如果没有收到回调则超时处理
        setTimeout(function() {
          // 检查是否已经接收到这个URL的异步结果
          chrome.storage.local.get('currentBatchTask', function(data) {
            const updatedTask = data.currentBatchTask;
            
            // 如果任务仍在进行且该URL的结果仍标记为"processing"
            if (updatedTask && updatedTask.inProgress && 
                updatedTask.results[index] && updatedTask.results[index].processing) {
              console.log(`URL ${currentUrl} 异步处理超时，继续下一个`);
              
              // 关闭标签页（如果还未关闭）
              try {
                chrome.tabs.get(tabId, function(tab) {
                  if (tab) chrome.tabs.remove(tabId);
                });
              } catch (e) {
                console.log("标签页可能已关闭");
              }
              
              // 更新批量任务状态
              updatedTask.completed++;
              chrome.storage.local.set({'currentBatchTask': updatedTask}, function() {
                // 处理下一个URL
                setTimeout(function() {
                  processNextUrl(index + 1, updatedTask, callback);
                }, updatedTask.options.delay || 3000);
              });
            }
          });
        }, 30000); // 给异步操作30秒的超时时间
        
        // 关闭标签页
        setTimeout(() => {
          try {
            chrome.tabs.remove(tabId);
          } catch (e) {
            console.log("关闭标签页出错，可能已经关闭", e);
          }
        }, 5000); // 等待5秒后关闭标签页，给内容脚本一些时间处理
        
        // 更新批量任务状态但不增加completed计数，等待异步结果
        chrome.storage.local.set({'currentBatchTask': batchTask}, function() {
          // 处理下一个URL - 不等待异步结果，避免阻塞
          setTimeout(function() {
            console.log(`开始处理下一个URL，而不等待 ${currentUrl} 的完整结果`);
            processNextUrl(index + 1, batchTask, callback);
          }, batchTask.options.delay || 3000);
        });
      });
    } else {
      // 记录成功
      console.log(`URL ${currentUrl} 抓取成功`);
      batchTask.results.push({
        url: currentUrl,
        success: true,
        data: response.data,
        fileName: response.fileName
      });
      
      // 如果有数据，下载它
      if (response.data) {
        // 处理文件名以兼容Windows
        let filename = response.fileName || `batch_financial_data_${index + 1}.${response.extension || batchTask.options.format}`;
        if (isWindows) {
          filename = sanitizeFilename(filename);
        }
        
        console.log(`下载文件: ${filename}`);
        
        // 使用base64编码而不是createObjectURL
        // 处理添加BOM的情况
        let blobData = response.data;
        if (response.addBOM) {
          blobData = '\ufeff' + response.data;
        }
        
        // 创建数据URI
        const base64Data = btoa(unescape(encodeURIComponent(blobData)));
        const dataUri = `data:${response.mimeType || 'text/plain'};base64,${base64Data}`;
        
        chrome.downloads.download({
          url: dataUri,
          filename: filename,
          saveAs: false
        }, function(downloadId) {
          if (chrome.runtime.lastError) {
            console.error('下载出错:', chrome.runtime.lastError);
          } else {
            console.log(`下载已开始，ID: ${downloadId}`);
          }
        });
      }
      
      // 关闭标签页
      chrome.tabs.remove(tabId);
      
      // 更新批量任务状态
      batchTask.completed++;
      console.log(`URL ${currentUrl} 处理已完成，进度: ${batchTask.completed}/${batchTask.total}`);
      chrome.storage.local.set({'currentBatchTask': batchTask}, function() {
        // 等待指定的延迟后，处理下一个URL
        setTimeout(function() {
          processNextUrl(index + 1, batchTask, callback);
        }, batchTask.options.delay || 3000);
      });
    }
  } else {
    // 记录失败
    console.log(`URL ${currentUrl} 抓取失败:`, response ? response.error : '未知错误');
    batchTask.results.push({
      url: currentUrl,
      success: false,
      error: response ? response.error : '未知错误'
    });
    
    // 关闭标签页
    chrome.tabs.remove(tabId);
    
    // 更新批量任务状态
    batchTask.completed++;
    console.log(`URL ${currentUrl} 处理已失败，进度: ${batchTask.completed}/${batchTask.total}`);
    chrome.storage.local.set({'currentBatchTask': batchTask}, function() {
      // 等待指定的延迟后，处理下一个URL
      setTimeout(function() {
        processNextUrl(index + 1, batchTask, callback);
      }, batchTask.options.delay || 3000);
    });
  }
} 