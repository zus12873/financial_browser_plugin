// 可视化功能的JavaScript文件

// 全局变量
let currentChartInstance = null;
let currentData = null;
let savedCharts = [];
let availableDataSources = [];
let bootstrap; // 声明bootstrap变量
let currentAIAnalysis = null; // 当前AI分析结果
let uploadedFiles = []; // 已上传的文件列表

// 后端API配置
const API_CONFIG = {
  baseUrl: 'http://localhost:5000', // 默认为本地Flask服务器
  aiAnalysisEndpoint: '/api/analyze', // AI分析API端点
  dataEndpoint: '/api/data', // 数据获取API端点
  uploadEndpoint: '/api/upload', // 文件上传API端点
  filesEndpoint: '/api/files' // 获取文件列表API端点
};

// 初始化函数
document.addEventListener('DOMContentLoaded', function() {
  // 尝试获取bootstrap对象
  bootstrap = window.bootstrap;
  
  // 从扩展存储中加载数据
  loadSavedCharts();
  
  // 检查是否从popup页面打开
  chrome.storage.local.get('visualizeFromPopup', function(result) {
    if (result.visualizeFromPopup) {
      // 从popup打开，优先检查新数据
      checkForNewData();
      
      // 切换到新建图表标签
      const newTab = document.getElementById('new-tab');
      if (bootstrap && bootstrap.Tab) {
        const tab = new bootstrap.Tab(newTab);
        tab.show();
      } else {
        // 备用方案：手动添加active类
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(el => {
          el.classList.remove('show', 'active');
        });
        newTab.classList.add('active');
        document.getElementById('new').classList.add('show', 'active');
      }
      
      // 清除标记
      chrome.storage.local.remove('visualizeFromPopup');
    } else {
      // 正常加载数据源
      loadDataSources();
    }
  });
  
  // 加载后端API配置
  loadApiConfig();
  
  // 绑定事件监听器
  bindEventListeners();
  
  // 加载已上传的文件列表
  fetchFilesList();
});

// 绑定事件监听器
function bindEventListeners() {
  // 原有事件绑定
  const dataSourceSelect = document.getElementById('dataSource');
  if (dataSourceSelect) {
    dataSourceSelect.addEventListener('change', function() {
    const selectedIndex = this.value;
    if (selectedIndex !== '') {
        populateDataFields(parseInt(selectedIndex));
    } else {
      document.getElementById('data-fields-container').innerHTML = '<p class="text-muted">请先选择数据源</p>';
    }
  });
  }
  
  const generateChartBtn = document.getElementById('generateChartBtn');
  if (generateChartBtn) {
    generateChartBtn.addEventListener('click', generateChart);
  }
  
  const saveChartBtn = document.getElementById('saveChartBtn');
  if (saveChartBtn) {
    saveChartBtn.addEventListener('click', saveChart);
  }
  
  const exportChartBtn = document.getElementById('exportChartBtn');
  if (exportChartBtn) {
    exportChartBtn.addEventListener('click', exportChart);
  }
  
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn) {
    importDataBtn.addEventListener('click', importData);
  }
  
  // 新增的财务分析相关事件绑定
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleFileUpload);
  }
  
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', analyzeData);
  }
  
  const viewDataBtn = document.getElementById('viewDataBtn');
  if (viewDataBtn) {
    viewDataBtn.addEventListener('click', viewData);
  }
  
  const saveApiConfigBtn = document.getElementById('saveApiConfigBtn');
  if (saveApiConfigBtn) {
    saveApiConfigBtn.addEventListener('click', saveApiConfig);
  }
  
  const testApiBtn = document.getElementById('testApiBtn');
  if (testApiBtn) {
    testApiBtn.addEventListener('click', testApiConnection);
  }
  
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', saveApiConfigFromModal);
  }
}

// 加载API配置
function loadApiConfig() {
  chrome.storage.local.get(['apiBaseUrl', 'apiEndpoint'], function(result) {
    if (result.apiBaseUrl) {
      document.getElementById('apiBaseUrl').value = result.apiBaseUrl;
      API_CONFIG.baseUrl = result.apiBaseUrl;
    }
    
    if (result.apiEndpoint) {
      document.getElementById('apiEndpoint').value = result.apiEndpoint;
      API_CONFIG.aiAnalysisEndpoint = result.apiEndpoint;
    }
  });
}

// 保存API配置
function saveApiConfig() {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  const endpoint = document.getElementById('apiEndpoint').value.trim();
  
  if (!baseUrl) {
    showFeedback('API服务器地址不能为空', 'warning');
    return;
  }
  
  // 更新API配置
  API_CONFIG.baseUrl = baseUrl;
  API_CONFIG.aiAnalysisEndpoint = endpoint;
  
  // 保存到存储
  chrome.storage.local.set({
    apiBaseUrl: baseUrl,
    apiEndpoint: endpoint,
    apiUrl: baseUrl + endpoint
  }, function() {
    showFeedback('API配置已保存', 'success');
    
    // 重新获取文件列表
    fetchFilesList();
  });
}

// 测试API连接
function testApiConnection() {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  
  if (!baseUrl) {
    showFeedback('请先填写API服务器地址', 'warning');
    return;
  }
  
  showFeedback('正在测试API连接...', 'info');
  
  // 尝试连接API
  fetch(`${baseUrl}/api/files`)
    .then(response => {
      if (response.ok) {
        showFeedback('连接成功！API服务器正常运行。', 'success');
        return response.json();
      } else {
        throw new Error(`HTTP错误 ${response.status}`);
      }
    })
    .then(data => {
      // 连接成功，更新文件列表
      if (data.success && data.files) {
        uploadedFiles = data.files;
        updateFileSelect();
      }
    })
    .catch(error => {
      showFeedback(`API连接失败: ${error.message}`, 'danger');
    });
}

// 打开API配置模态框
function openApiConfigModal() {
  // 填充模态框中的值
  document.getElementById('modalApiBaseUrl').value = API_CONFIG.baseUrl;
  document.getElementById('modalApiEndpoint').value = API_CONFIG.aiAnalysisEndpoint;
  
  // 显示模态框
  if (bootstrap && bootstrap.Modal) {
    const apiConfigModal = new bootstrap.Modal(document.getElementById('apiConfigModal'));
    apiConfigModal.show();
  }
}

// 从模态框保存API配置
function saveApiConfigFromModal() {
  const baseUrl = document.getElementById('modalApiBaseUrl').value.trim();
  const endpoint = document.getElementById('modalApiEndpoint').value.trim();
  const authHeader = document.getElementById('apiAuthHeader').value.trim();
  const timeout = document.getElementById('apiTimeout').value;
  
  // 更新API配置
  API_CONFIG.baseUrl = baseUrl;
  API_CONFIG.aiAnalysisEndpoint = endpoint;
  if (authHeader) {
    API_CONFIG.authHeader = authHeader;
  }
  API_CONFIG.timeout = parseInt(timeout) * 1000;
  
  // 同步更新主界面输入框
  document.getElementById('apiBaseUrl').value = baseUrl;
  document.getElementById('apiEndpoint').value = endpoint;
  
  // 保存到存储
  chrome.storage.local.set({
    apiBaseUrl: baseUrl,
    apiEndpoint: endpoint,
    apiAuthHeader: authHeader,
    apiTimeout: timeout,
    apiUrl: baseUrl + endpoint
  }, function() {
    // 关闭模态框
    if (bootstrap && bootstrap.Modal) {
      const apiConfigModal = bootstrap.Modal.getInstance(document.getElementById('apiConfigModal'));
      if (apiConfigModal) {
        apiConfigModal.hide();
      }
    }
    
    showFeedback('API高级配置已保存', 'success');
  });
}

// 处理文件上传
function handleFileUpload(event) {
  event.preventDefault();
  
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  
  if (!file) {
    showFeedback('请选择要上传的文件', 'warning');
    return;
  }
  
  // 检查文件类型
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showFeedback('只支持CSV文件', 'warning');
    return;
  }
  
  // 检查文件大小 (16MB限制)
  if (file.size > 16 * 1024 * 1024) {
    showFeedback('文件大小不能超过16MB', 'warning');
    return;
  }
  
  // 创建FormData对象
  const formData = new FormData();
  formData.append('file', file);
  
  // 显示上传中状态
  showFeedback('文件上传中...', 'info');
  
  // 发送请求
  fetch(`${API_CONFIG.baseUrl}${API_CONFIG.uploadEndpoint}`, {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // 显示成功消息
      showFeedback(`文件 ${data.filename} 上传成功`, 'success');
      // 清空文件输入
      fileInput.value = '';
      // 刷新文件列表
      fetchFilesList();
  } else {
      // 显示错误消息
      showFeedback(`上传失败: ${data.error}`, 'danger');
    }
  })
  .catch(error => {
    showFeedback(`上传失败: ${error.message}`, 'danger');
  });
}

// 获取已上传文件列表
function fetchFilesList() {
  fetch(`${API_CONFIG.baseUrl}${API_CONFIG.filesEndpoint}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        uploadedFiles = data.files;
        updateFileSelect();
      }
    })
    .catch(error => {
      console.error('获取文件列表失败:', error);
    });
}

// 更新文件选择下拉框
function updateFileSelect() {
  const fileSelect = document.getElementById('fileSelect');
  if (!fileSelect) return;
  
  // 清空当前选项（除了默认选项）
  while (fileSelect.options.length > 1) {
    fileSelect.remove(1);
  }
  
  // 添加文件选项
  uploadedFiles.forEach(file => {
    const option = document.createElement('option');
    option.value = file.name;
    option.textContent = `${file.name} (${formatFileSize(file.size)})`;
    fileSelect.appendChild(option);
  });
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// 显示反馈信息
function showFeedback(message, type) {
  const uploadFeedback = document.getElementById('uploadFeedback');
  if (!uploadFeedback) return;
  
  uploadFeedback.textContent = message;
  uploadFeedback.className = `alert alert-${type} mb-4`;
  uploadFeedback.classList.remove('d-none');
  
  // 5秒后自动隐藏成功和信息提示
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      uploadFeedback.classList.add('d-none');
    }, 5000);
  }
}

// 分析数据
function analyzeData() {
  const loadingBox = document.getElementById('loadingBox');
  const resultBox = document.getElementById('resultBox');
  const analysisResult = document.getElementById('analysisResult');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');
  
  // 显示加载动画
  loadingBox.classList.remove('d-none');
  // 隐藏结果和错误信息
  resultBox.classList.add('d-none');
  errorBox.classList.add('d-none');
  
  // 获取用户输入的提示
  const prompt = document.getElementById('promptInput').value.trim();
  
  // 获取选择的文件名
  const selectedFile = document.getElementById('fileSelect').value;
  
  // 调用API分析数据
  fetch(`${API_CONFIG.baseUrl}${API_CONFIG.aiAnalysisEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      prompt: prompt,
      filename: selectedFile 
    })
  })
  .then(response => response.json())
  .then(data => {
    // 隐藏加载动画
    loadingBox.classList.add('d-none');
    
    if (data.success) {
      // 显示分析结果
      analysisResult.innerHTML = formatAnalysisResult(data.analysis);
      resultBox.classList.remove('d-none');
      
      // 保存当前分析结果
      currentAIAnalysis = {
        text: data.analysis,
        prompt: prompt,
        file: selectedFile,
        timestamp: new Date().toISOString()
      };
        } else {
      // 显示错误信息
      errorMessage.textContent = data.error || '服务器处理请求时发生错误';
      errorBox.classList.remove('d-none');
    }
  })
  .catch(error => {
    // 隐藏加载动画
    loadingBox.classList.add('d-none');
    // 显示错误信息
    errorMessage.textContent = '网络请求失败: ' + error.message;
    errorBox.classList.remove('d-none');
  });
}

// 查看原始数据
function viewData() {
  const loadingBox = document.getElementById('loadingBox');
  const dataTableBox = document.getElementById('dataTableBox');
  const dataTable = document.getElementById('dataTable');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');
  
  // 显示加载动画
  loadingBox.classList.remove('d-none');
  // 隐藏错误信息
  errorBox.classList.add('d-none');
  
  // 获取选择的文件名
  const selectedFile = document.getElementById('fileSelect').value;
  
  // 构建URL
  let url = `${API_CONFIG.baseUrl}${API_CONFIG.dataEndpoint}`;
  if (selectedFile) {
    url += `?filename=${encodeURIComponent(selectedFile)}`;
  }
  
  // 调用API获取数据
  fetch(url)
  .then(response => response.json())
  .then(data => {
    // 隐藏加载动画
    loadingBox.classList.add('d-none');
    
    if (data.success) {
      // 生成表格
      generateDataTable(data.data);
      // 显示表格
      dataTableBox.classList.remove('d-none');
              } else {
      // 显示错误信息
      errorMessage.textContent = data.error || '服务器处理请求时发生错误';
      errorBox.classList.remove('d-none');
    }
  })
  .catch(error => {
    // 隐藏加载动画
    loadingBox.classList.add('d-none');
    // 显示错误信息
    errorMessage.textContent = '网络请求失败: ' + error.message;
    errorBox.classList.remove('d-none');
  });
}

// 格式化分析结果（将换行符转换为HTML）
function formatAnalysisResult(text) {
  // 使用正则表达式替换所有换行符为<br>标签
  return text.replace(/\n/g, '<br>');
}

// 生成数据表格
function generateDataTable(data) {
  const dataTable = document.getElementById('dataTable');
  if (!dataTable) return;
  
  // 清空表格
  dataTable.innerHTML = '';
  
  if (!data || data.length === 0) {
    dataTable.innerHTML = '<tr><td>无数据</td></tr>';
    return;
  }
  
  // 创建表头
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // 获取所有键（列名）
  const keys = Object.keys(data[0]);
  
  // 添加表头单元格
  keys.forEach(key => {
    const th = document.createElement('th');
    th.textContent = key;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  dataTable.appendChild(thead);
  
  // 创建表体
  const tbody = document.createElement('tbody');
  
  // 添加数据行
  data.forEach(item => {
    const row = document.createElement('tr');
    
    keys.forEach(key => {
      const td = document.createElement('td');
      td.textContent = item[key] !== null ? item[key] : '';
      row.appendChild(td);
    });
    
    tbody.appendChild(row);
  });
  
  dataTable.appendChild(tbody);
}

// 保留原有功能的代码...
// ... 原有的loadSavedCharts, populateDataSourceDropdown, populateDataFields等函数 ...

// 加载已保存的图表
function loadSavedCharts() {
  console.log('加载已保存图表...');
  chrome.storage.local.get('visualizationCharts', function(result) {
    if (result.visualizationCharts && result.visualizationCharts.length > 0) {
      console.log('找到', result.visualizationCharts.length, '个保存的图表');
      savedCharts = result.visualizationCharts;
      renderSavedCharts();
        } else {
      console.log('未找到保存的图表');
      // 显示空状态（如果元素存在）
      const noSavedChartsEl = document.getElementById('no-saved-charts');
      if (noSavedChartsEl) {
        noSavedChartsEl.style.display = 'block';
      } else {
        console.log('no-saved-charts元素不存在，将在renderSavedCharts中创建');
        // 在页面加载完成后再尝试渲染
        setTimeout(renderSavedCharts, 500);
      }
    }
  });
}

// 加载可用的数据源
function loadDataSources() {
  // 从存储中获取已保存的财务数据
  chrome.storage.local.get(['savedData', 'lastCompletedBatch'], function(result) {
    let hasData = false;
    
    // 处理常规抓取的数据
    if (result.savedData && result.savedData.length > 0) {
      availableDataSources = result.savedData;
      hasData = true;
    }
    
    // 添加批量抓取的结果数据
    if (result.lastCompletedBatch && result.lastCompletedBatch.results) {
      const batchResults = result.lastCompletedBatch.results.filter(r => r.success && r.data);
      if (batchResults.length > 0) {
        // 处理批量抓取结果并添加到可用数据源
        batchResults.forEach(result => {
          if (!result.data) return;
          
          let info = { tabName: '批量抓取' };
          // 尝试从URL提取股票代码或公司名称
          if (result.url) {
            const urlParts = result.url.split('/');
            const potentialTicker = urlParts[urlParts.length - 1].split('.')[0];
            if (potentialTicker) {
              info.ticker = potentialTicker;
            }
          }
          
          availableDataSources.push({
            data: result.data,
            info: info,
            fileName: result.fileName || '批量抓取数据',
            timestamp: new Date().toISOString()
          });
        });
        hasData = true;
      }
    }
    
    // 填充下拉列表
    if (hasData) {
      populateDataSourceDropdown();
    } else {
      // 如果没有保存的数据，显示提示
      const dataSourceSelect = document.getElementById('dataSource');
      if (dataSourceSelect) {
        dataSourceSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '无可用数据 - 请先抓取财务数据或导入CSV';
        dataSourceSelect.appendChild(option);
        
        // 显示导入数据的提示
        const importDataHint = document.getElementById('import-data-hint');
        if (importDataHint) {
          importDataHint.style.display = 'block';
        }
      }
    }
  });
}

// 填充数据源下拉列表
function populateDataSourceDropdown() {
  const dataSourceSelect = document.getElementById('dataSource');
  if (!dataSourceSelect) return;
  
  dataSourceSelect.innerHTML = '<option value="">请选择...</option>';
  
  availableDataSources.forEach((source, index) => {
    const option = document.createElement('option');
    option.value = index;
    
    let label = '未命名数据';
    if (source.info) {
      if (source.info.ticker) {
        label = source.info.ticker;
      }
      if (source.info.tabName) {
        label += ' - ' + source.info.tabName;
      }
    }
    if (source.fileName) {
      label += ' (' + source.fileName + ')';
    }
    
    option.textContent = label;
    dataSourceSelect.appendChild(option);
  });
  
  // 隐藏导入数据的提示
  const importDataHint = document.getElementById('import-data-hint');
  if (importDataHint) {
    importDataHint.style.display = 'none';
  }
}

// 检查是否有新数据
function checkForNewData() {
  chrome.storage.local.get(['lastScrapedData'], function(result) {
    if (result.lastScrapedData) {
      // 有新抓取的数据，将其添加到数据源
      availableDataSources.unshift(result.lastScrapedData);
      
      // 填充数据源下拉列表
      populateDataSourceDropdown();
      
      // 自动选择新数据
      const dataSourceSelect = document.getElementById('dataSource');
      if (dataSourceSelect) {
        dataSourceSelect.value = 0;
        if (dataSourceSelect.dispatchEvent) {
          dataSourceSelect.dispatchEvent(new Event('change'));
        }
      }
      
      // 清除新数据标记
      chrome.storage.local.remove('lastScrapedData');
  } else {
      // 没有新数据，正常加载
      loadDataSources();
    }
  });
}

// 在原有函数中保留其他功能...

// 导入数据
function importData() {
  console.log('导入数据...');
  const importFile = document.getElementById('importFile');
  if (!importFile || !importFile.files || importFile.files.length === 0) {
    const importResult = document.getElementById('import-result');
    if (importResult) {
      importResult.innerHTML = '<div class="alert alert-warning">请先选择要导入的CSV文件</div>';
    }
    return;
  }
  
  const file = importFile.files[0];
  if (!file.name.toLowerCase().endsWith('.csv')) {
    const importResult = document.getElementById('import-result');
    if (importResult) {
      importResult.innerHTML = '<div class="alert alert-warning">只支持CSV格式的文件</div>';
    }
    return;
  }
  
  // 读取文件内容
  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    try {
      const parsedData = parseCSVData(contents);
      if (parsedData && parsedData.length > 0) {
        // 将数据添加到可用数据源
        availableDataSources.push({
          data: parsedData,
        fileName: file.name,
        timestamp: new Date().toISOString()
        });
        
        // 保存到存储
        chrome.storage.local.set({ savedData: availableDataSources }, function() {
          console.log('数据已保存');
          
          // 更新数据源下拉列表
        populateDataSourceDropdown();
        
          // 显示成功信息
          const importResult = document.getElementById('import-result');
          if (importResult) {
            importResult.innerHTML = `
              <div class="alert alert-success">
                文件导入成功！包含 ${parsedData.length} 行数据。
                <hr>
                <h5>数据示例:</h5>
                <div class="table-responsive">
                  <table class="table table-sm">
                    <thead>
                      <tr>${Object.keys(parsedData[0]).map(key => `<th>${key}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                      ${parsedData.slice(0, 3).map(row => 
                        `<tr>${Object.values(row).map(val => `<td>${val}</td>`).join('')}</tr>`
                      ).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }
          
          // 清空文件选择
          importFile.value = '';
        });
      } else {
        throw new Error('无法解析数据或数据为空');
      }
    } catch (error) {
      console.error('导入失败:', error);
      const importResult = document.getElementById('import-result');
      if (importResult) {
        importResult.innerHTML = `<div class="alert alert-danger">导入失败: ${error.message}</div>`;
      }
    }
  };
  reader.onerror = function(error) {
    console.error('读取文件失败:', error);
    const importResult = document.getElementById('import-result');
    if (importResult) {
      importResult.innerHTML = '<div class="alert alert-danger">读取文件失败</div>';
    }
  };
  reader.readAsText(file);
}

// 保留原始解析CSV功能
function parseCSVData(csvString) {
  if (!csvString) return [];
  
  // 尝试检测数据结构 - 财务报表格式
  const isFinancialStatement = csvString.includes('Income Statement') || 
                             csvString.includes('Balance Sheet') || 
                             csvString.includes('Cash Flow') || 
                             csvString.includes('Financial Ratios');
  
  // 分割行
  const rows = csvString.split(/\r?\n/);
  if (rows.length === 0) return [];
  
  // 去除空行和纯标题行
  const filteredRows = rows.filter(row => 
    row.trim() !== '' && 
    row.trim() !== 'GM - Income Statement' && 
    row.trim() !== 'GM - Balance Sheet' && 
    row.trim() !== 'GM - Cash Flow' &&
    row.trim() !== 'GM - Ratios' &&
    !row.match(/^GM - .*\(GM\)/)
  );
  
  if (filteredRows.length === 0) return [];
  
  // 找到真正的表头行 - 通常包含"Fiscal Year"或"Period Ending"
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, filteredRows.length); i++) {
    if (filteredRows[i].includes('Fiscal Year') || 
        filteredRows[i].includes('Period Ending')) {
      headerRowIndex = i;
      break;
    }
  }
  
  // 解析每一行
  const parsedRows = filteredRows.map(row => {
    // 处理引号内的逗号
    const cells = [];
    let inQuote = false;
    let currentCell = '';
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        cells.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    
    // 添加最后一个单元格
    cells.push(currentCell);
    
    // 处理引号
    return cells.map(cell => cell.replace(/^"|"$/g, '').trim());
  });
  
  // 如果是财务报表格式，重新组织数据
  if (isFinancialStatement && headerRowIndex > 0) {
    // 重新排列，使真正的表头成为第一行
    const result = [parsedRows[headerRowIndex]];
    
    // 添加其他数据行
    for (let i = 0; i < parsedRows.length; i++) {
      if (i !== headerRowIndex && parsedRows[i].some(cell => cell.trim() !== '')) {
        result.push(parsedRows[i]);
      }
    }
    
    return result;
  }
  
  return parsedRows.filter(row => row.length > 0 && row.some(cell => cell.trim() !== ''));
}