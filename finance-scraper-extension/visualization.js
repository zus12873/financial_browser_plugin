// 可视化功能的JavaScript文件

// 全局变量
let currentChartInstance = null;
let currentData = null;
let savedCharts = [];
let availableDataSources = [];
let bootstrap; // 声明bootstrap变量
let savedAIAnalyses = []; // 保存AI分析结果
let currentAIAnalysis = null; // 当前AI分析结果

// // AI分析相关配置
// const AI_API_CONFIG = {
//   // 默认设置，会从存储中获取
//   apiEndpoint: 'https://api.openai.com/v1/chat/completions',
//   model: 'gpt-4o',
//   temperature: 0.7,
//   maxTokens: 4000
// };

// // 不同模型的API配置
// const MODEL_CONFIGS = {
//   'gpt-4o': {
//     endpoint: 'https://api.openai.com/v1/chat/completions',
//     provider: 'openai',
//     maxTokens: 4000
//   },
//   'gpt-4o-mini': {
//     endpoint: 'https://api.openai.com/v1/chat/completions',
//     provider: 'openai',
//     maxTokens: 4000
//   },
//   'gpt-3.5-turbo': {
//     endpoint: 'https://api.openai.com/v1/chat/completions',
//     provider: 'openai',
//     maxTokens: 4000
//   },
//   'claude-3-sonnet-20240229': {
//     endpoint: 'https://api.anthropic.com/v1/messages',
//     provider: 'anthropic',
//     maxTokens: 4000
//   }
// };

// 初始化函数
document.addEventListener('DOMContentLoaded', function() {
  // 尝试获取bootstrap对象
  bootstrap = window.bootstrap;
  
  // // 设置API端点输入框的默认值
  // document.getElementById('aiApiEndpoint').placeholder = AI_API_CONFIG.apiEndpoint;
  
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
  
  // 绑定事件监听器
  bindEventListeners();
});

// 加载已保存的图表
function loadSavedCharts() {
  chrome.storage.local.get('visualizationCharts', function(result) {
    if (result.visualizationCharts && result.visualizationCharts.length > 0) {
      savedCharts = result.visualizationCharts;
      renderSavedCharts();
    } else {
      // 显示空状态
      document.getElementById('no-saved-charts').style.display = 'block';
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
      dataSourceSelect.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '无可用数据 - 请先抓取财务数据或导入CSV';
      dataSourceSelect.appendChild(option);
      
      // 显示导入数据的提示
      // document.getElementById('import-data-hint').style.display = 'block';
    }
  });
}

// 填充数据源下拉列表
function populateDataSourceDropdown() {
  const dataSourceSelect = document.getElementById('dataSource');
  dataSourceSelect.innerHTML = '<option value="">请选择...</option>';
  
  // 同时填充AI分析数据源下拉框
  // const aiDataSourceSelect = document.getElementById('aiDataSource');
  // aiDataSourceSelect.innerHTML = '<option value="">请选择...</option>';
  
  availableDataSources.forEach((source, index) => {
    const option = document.createElement('option');
    option.value = index;
    
    // 尝试提取有意义的标题
    let title = `数据集 ${index + 1}`;
    if (source.info && source.info.ticker) {
      title = `${source.info.ticker} - ${source.info.tabName || '财务数据'}`;
    } else if (source.fileName) {
      title = source.fileName;
    }
    
    // 添加时间戳
    if (source.timestamp) {
      const date = new Date(source.timestamp);
      title += ` (${date.toLocaleDateString()})`;
    }
    
    option.textContent = title;
    dataSourceSelect.appendChild(option);
    
    // 克隆选项到AI分析下拉框
    const aiOption = option.cloneNode(true);
    // aiDataSourceSelect.appendChild(aiOption);
  });
}

// 绑定事件监听器
function bindEventListeners() {
  // 数据源选择变化时
  document.getElementById('dataSource').addEventListener('change', function() {
    const selectedIndex = this.value;
    if (selectedIndex !== '') {
      populateDataFields(selectedIndex);
    } else {
      document.getElementById('data-fields-container').innerHTML = '<p class="text-muted">请先选择数据源</p>';
    }
  });
  
  // 生成图表按钮点击时
  document.getElementById('generateChartBtn').addEventListener('click', generateChart);
  
  // 保存图表按钮点击时
  document.getElementById('saveChartBtn').addEventListener('click', function() {
    // 显示保存图表模态框
    if (bootstrap && bootstrap.Modal) {
      const saveModal = new bootstrap.Modal(document.getElementById('saveChartModal'));
      saveModal.show();
    } else {
      // 备用方案：手动显示模态框
      const modal = document.getElementById('saveChartModal');
      modal.style.display = 'block';
      modal.classList.add('show');
      document.body.classList.add('modal-open');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  });
  
  // 确认保存按钮点击时
  document.getElementById('confirmSaveBtn').addEventListener('click', saveChart);
  
  // 导出按钮点击时
  document.getElementById('exportChartBtn').addEventListener('click', function() {
    // 显示导出模态框
    if (bootstrap && bootstrap.Modal) {
      const exportModal = new bootstrap.Modal(document.getElementById('exportChartModal'));
      
      // 设置默认文件名
      const now = new Date();
      const defaultFilename = `financial_chart_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
      document.getElementById('exportFilename').value = defaultFilename;
      
      exportModal.show();
    } else {
      // 备用方案：手动显示模态框
      const modal = document.getElementById('exportChartModal');
      modal.style.display = 'block';
      modal.classList.add('show');
      document.body.classList.add('modal-open');
      
      // 设置默认文件名
      const now = new Date();
      const defaultFilename = `financial_chart_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
      document.getElementById('exportFilename').value = defaultFilename;
      
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  });
  
  // 确认导出按钮点击时
  document.getElementById('confirmExportBtn').addEventListener('click', exportChart);
  
  // 编辑图表按钮点击时
  document.getElementById('editChartBtn').addEventListener('click', function() {
    // 隐藏预览区，显示编辑区
    document.getElementById('preview-chart-container').style.display = 'none';
  });
  
  // 导入数据按钮点击时
  document.getElementById('importDataBtn').addEventListener('click', importData);

  // 图表类型改变时，更新数据字段选择
  document.getElementById('chartType').addEventListener('change', function() {
    const selectedDataSource = document.getElementById('dataSource').value;
    if (selectedDataSource !== '') {
      populateDataFields(selectedDataSource);
    }
  });
  
  // AI分析相关事件监听
  
  // // 加载保存的API设置
  // loadApiSettings();
  
  // // 保存API密钥按钮点击时
  // document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
  
  // // 保存API端点按钮点击时
  // document.getElementById('saveApiEndpointBtn').addEventListener('click', saveApiEndpoint);
  
  // // 模型选择变化时
  // document.getElementById('aiApiModel').addEventListener('change', saveApiModel);
  
  // // 切换API密钥可见性
  // document.getElementById('toggleApiKeyBtn').addEventListener('click', toggleApiKeyVisibility);
  
  // // AI数据源下拉框变化时
  // document.getElementById('aiDataSource').addEventListener('change', function() {
  //   // 隐藏之前的分析结果
  //   document.getElementById('ai-analysis-result').style.display = 'none';
  // });
  
  // // 生成AI分析按钮点击时
  // document.getElementById('generateAIAnalysisBtn').addEventListener('click', generateAIAnalysis);
  
  // // 保存AI分析按钮点击时
  // document.getElementById('saveAIAnalysisBtn').addEventListener('click', function() {
  //   // 显示保存AI分析模态框
  //   if (bootstrap && bootstrap.Modal) {
  //     const saveModal = new bootstrap.Modal(document.getElementById('saveAIAnalysisModal'));
  //     saveModal.show();
  //   } else {
  //     // 备用方案：手动显示模态框
  //     const modal = document.getElementById('saveAIAnalysisModal');
  //     modal.style.display = 'block';
  //     modal.classList.add('show');
  //     document.body.classList.add('modal-open');
  //     const backdrop = document.createElement('div');
  //     backdrop.className = 'modal-backdrop fade show';
  //     document.body.appendChild(backdrop);
  //   }
  // });
  
  // // 确认保存AI分析按钮点击时
  // document.getElementById('confirmSaveAIAnalysisBtn').addEventListener('click', saveAIAnalysis);
  
  // // 复制AI分析文本按钮点击时
  // document.getElementById('copyAIAnalysisBtn').addEventListener('click', copyAIAnalysisText);
}

// 检查是否有新导入的数据
function checkForNewData() {
  chrome.storage.local.get(['newImportedData', 'savedData', 'lastCompletedBatch'], function(result) {
    // 检查导入的数据
    if (result.newImportedData) {
      // 有新导入的数据，刷新数据源
      availableDataSources.push(result.newImportedData);
      populateDataSourceDropdown();
      
      // 选择新导入的数据
      document.getElementById('dataSource').value = availableDataSources.length - 1;
      populateDataFields(availableDataSources.length - 1);
      
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
      chrome.storage.local.remove('newImportedData');
    }
    
    // 检查抓取的数据
    else if ((result.savedData && result.savedData.length > 0) || 
             (result.lastCompletedBatch && result.lastCompletedBatch.results && 
              result.lastCompletedBatch.results.some(r => r.success && r.data))) {
      // 从头加载数据源
      loadDataSources();
      
      // 显示一条通知，提示用户已找到数据
      const notification = document.createElement('div');
      notification.className = 'alert alert-success alert-dismissible fade show';
      notification.innerHTML = '发现可用的财务数据! 您可以在<strong>创建新图表</strong>选项卡中选择数据源。' +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
      
      // 添加到页面顶部
      const container = document.querySelector('.container');
      container.insertBefore(notification, container.firstChild);
      
      // 设置自动消失
      setTimeout(() => {
        if (bootstrap && bootstrap.Alert) {
          const bsAlert = new bootstrap.Alert(notification);
          bsAlert.close();
        } else {
          // 手动移除alert
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }
      }, 10000);
    }
  });
}

// 填充数据字段选择界面
function populateDataFields(sourceIndex) {
  const container = document.getElementById('data-fields-container');
  container.innerHTML = '';
  
  const sourceData = availableDataSources[sourceIndex];
  if (!sourceData || !sourceData.data) {
    container.innerHTML = '<p class="text-danger">无法读取数据源</p>';
    return;
  }
  
  // 解析CSV数据
  const parsedData = parseCSVData(sourceData.data);
  if (!parsedData || parsedData.length === 0) {
    container.innerHTML = '<p class="text-danger">数据格式错误或为空</p>';
    return;
  }
  
  // 存储解析后的数据
  currentData = parsedData;
  
  // 获取当前选择的图表类型
  const chartType = document.getElementById('chartType').value;
  
  // 创建字段选择界面 - 根据图表类型显示不同的选项
  if (chartType === 'pie' || chartType === 'polarArea') {
    // 饼图和极区图只需要标签和数值
    createPieChartOptions(container, parsedData);
  } else {
    // 折线图、柱状图和雷达图需要X轴和Y轴
    createAxisChartOptions(container, parsedData, chartType);
  }
}

// 创建饼图/极区图的选项
function createPieChartOptions(container, data) {
  // 标签字段选择
  const labelFieldGroup = document.createElement('div');
  labelFieldGroup.className = 'mb-3';
  labelFieldGroup.innerHTML = `
    <label class="form-label">标签字段</label>
    <select class="form-select" id="labelField"></select>
  `;
  container.appendChild(labelFieldGroup);
  
  // 数值字段选择
  const valueFieldGroup = document.createElement('div');
  valueFieldGroup.className = 'mb-3';
  valueFieldGroup.innerHTML = `
    <label class="form-label">数值字段</label>
    <select class="form-select" id="valueField"></select>
  `;
  container.appendChild(valueFieldGroup);
  
  // 填充下拉选项
  const labelSelect = document.getElementById('labelField');
  const valueSelect = document.getElementById('valueField');
  
  // 假设第一行是表头
  if (data.length > 0 && data[0].length > 0) {
    data[0].forEach((header, index) => {
      const labelOption = document.createElement('option');
      labelOption.value = index;
      labelOption.textContent = header || `列 ${index + 1}`;
      labelSelect.appendChild(labelOption);
      
      const valueOption = document.createElement('option');
      valueOption.value = index;
      valueOption.textContent = header || `列 ${index + 1}`;
      valueSelect.appendChild(valueOption);
    });
    
    // 默认选中第一列作为标签，第二列作为数值
    if (data[0].length > 1) {
      labelSelect.value = 0;
      valueSelect.value = 1;
    }
  }
  
  // 添加限制数据点数量的选项
  const limitGroup = document.createElement('div');
  limitGroup.className = 'mb-3';
  limitGroup.innerHTML = `
    <label class="form-label">最大数据点数量</label>
    <input type="number" class="form-control" id="dataLimit" min="1" max="50" value="10">
    <div class="form-text">限制图表中显示的数据点数量，过多的数据点可能导致图表难以阅读</div>
  `;
  container.appendChild(limitGroup);
}

// 创建轴图表（折线图、柱状图、雷达图）的选项
function createAxisChartOptions(container, data, chartType) {
  // 检测是否是财务报表格式(年度数据在第一行)
  const isFinancialReport = data.length > 1 && data[0].length > 2 && 
                           (data[0].includes('Fiscal Year') || 
                            data[0].includes('Period Ending'));
  
  if (isFinancialReport) {
    // 财务报表格式处理
    
    // 选择要显示的指标
    const metricGroup = document.createElement('div');
    metricGroup.className = 'mb-3';
    metricGroup.innerHTML = `
      <label class="form-label">选择要显示的财务指标</label>
      <select class="form-select" id="yAxisField" multiple size="10">
        <option value="all">-- 全选 --</option>
      </select>
      <div class="form-text">按住Ctrl键可选择多个指标</div>
    `;
    container.appendChild(metricGroup);
    
    // 填充Y轴选项(财务指标选择)
    const ySelect = document.getElementById('yAxisField');
    
    // 使用第一列(通常包含指标名称)
    for (let i = 1; i < data.length; i++) {
      if (data[i].length > 0) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = data[i][0] || `指标 ${i}`;
        ySelect.appendChild(option);
      }
    }
    
    // 添加全选事件监听
    ySelect.addEventListener('change', function(event) {
      if (event.target.options[0].selected) {
        // 全选被点击
        const allSelected = event.target.options[0].selected;
        
        // 选择或取消选择所有选项
        for (let i = 1; i < event.target.options.length; i++) {
          event.target.options[i].selected = allSelected;
        }
      }
    });
    
    // 默认选择几个常用指标
    const commonMetrics = [
      'Return on Equity (ROE)', 
      'Return on Assets (ROA)', 
      'PE Ratio', 
      'PB Ratio', 
      'Debt / Equity Ratio',
      'Current Ratio'
    ];
    
    for (let i = 1; i < ySelect.options.length; i++) {
      const option = ySelect.options[i];
      if (commonMetrics.some(metric => option.textContent.includes(metric))) {
        option.selected = true;
      }
    }
  } else {
    // 标准CSV格式(非财务报表特殊格式)
    // X轴字段选择
    const xAxisGroup = document.createElement('div');
    xAxisGroup.className = 'mb-3';
    xAxisGroup.innerHTML = `
      <label class="form-label">X轴字段</label>
      <select class="form-select" id="xAxisField"></select>
    `;
    container.appendChild(xAxisGroup);
    
    // Y轴字段选择
    const yAxisGroup = document.createElement('div');
    yAxisGroup.className = 'mb-3';
    yAxisGroup.innerHTML = `
      <label class="form-label">Y轴字段</label>
      <select class="form-select" id="yAxisField" ${chartType === 'radar' ? 'multiple' : ''}>
        ${chartType === 'radar' ? '<option value="all">-- 全选 --</option>' : ''}
      </select>
      ${chartType === 'radar' ? '<div class="form-text">按住Ctrl键可选择多个指标</div>' : ''}
    `;
    container.appendChild(yAxisGroup);
    
    // 填充下拉选项
    const xSelect = document.getElementById('xAxisField');
    const ySelect = document.getElementById('yAxisField');
    
    // 假设第一行是表头
    if (data.length > 0 && data[0].length > 0) {
      data[0].forEach((header, index) => {
        const xOption = document.createElement('option');
        xOption.value = index;
        xOption.textContent = header || `列 ${index + 1}`;
        xSelect.appendChild(xOption);
        
        const yOption = document.createElement('option');
        yOption.value = index;
        yOption.textContent = header || `列 ${index + 1}`;
        ySelect.appendChild(yOption);
      });
      
      // 默认选中第一列作为X轴，第二列作为Y轴
      if (data[0].length > 1) {
        xSelect.value = 0;
        ySelect.value = 1;
      }
    }
  }
  
  // 添加数据排序选项
  const sortGroup = document.createElement('div');
  sortGroup.className = 'mb-3';
  sortGroup.innerHTML = `
    <label class="form-label">数据排序</label>
    <select class="form-select" id="dataSorting">
      <option value="none">不排序</option>
      <option value="asc">升序</option>
      <option value="desc">降序</option>
    </select>
  `;
  container.appendChild(sortGroup);
  
  // 创建一个隐藏的xAxisField元素，用于存储自动使用所有年份的标记
  if (isFinancialReport) {
    const hiddenXAxis = document.createElement('input');
    hiddenXAxis.type = 'hidden';
    hiddenXAxis.id = 'xAxisField';
    hiddenXAxis.value = 'all_years';
    container.appendChild(hiddenXAxis);
  }
}

// 解析CSV数据
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

// 生成图表
function generateChart() {
  const chartType = document.getElementById('chartType').value;
  const sourceIndex = document.getElementById('dataSource').value;
  
  if (!sourceIndex || !chartType || !currentData) {
    alert('请选择数据源和图表类型');
    return;
  }
  
  // 准备图表数据
  let chartData, chartOptions;
  
  if (chartType === 'pie' || chartType === 'polarArea') {
    const labelFieldIndex = parseInt(document.getElementById('labelField').value);
    const valueFieldIndex = parseInt(document.getElementById('valueField').value);
    const dataLimit = parseInt(document.getElementById('dataLimit').value) || 10;
    
    const result = preparePieChartData(currentData, labelFieldIndex, valueFieldIndex, dataLimit);
    chartData = result.data;
    chartOptions = result.options;
  } else {
    // 检测是否是财务报表格式，此时我们不使用xAxisField选择器
    const isFinancialReport = currentData.length > 1 && currentData[0].length > 2 && 
                             (currentData[0].includes('Fiscal Year') || 
                              currentData[0].includes('Period Ending'));
    
    let xFieldIndex, yFieldIndices;
    
    if (isFinancialReport) {
      // 财务报表格式：我们使用所有年份列
      xFieldIndex = 'all_years';
      
      // 获取所有选中的Y轴指标
      const options = document.getElementById('yAxisField').selectedOptions;
      yFieldIndices = Array.from(options).map(option => parseInt(option.value));
    } else {
      // 标准CSV格式
      xFieldIndex = parseInt(document.getElementById('xAxisField').value);
      
      // 处理单选和多选
      if (chartType === 'radar' && document.getElementById('yAxisField').multiple) {
        const options = document.getElementById('yAxisField').selectedOptions;
        yFieldIndices = Array.from(options).map(option => parseInt(option.value));
      } else {
        yFieldIndices = parseInt(document.getElementById('yAxisField').value);
      }
    }
    
    const sortingMethod = document.getElementById('dataSorting').value;
    
    const result = prepareAxisChartData(currentData, xFieldIndex, yFieldIndices, sortingMethod, chartType);
    chartData = result.data;
    chartOptions = result.options;
  }
  
  // 显示图表预览区域
  document.getElementById('preview-chart-container').style.display = 'block';
  
  // 创建图表
  const ctx = document.getElementById('previewChart').getContext('2d');
  
  // 如果已经存在图表实例，销毁它
  if (currentChartInstance) {
    currentChartInstance.destroy();
  }
  
  // 创建新的图表实例
  currentChartInstance = new Chart(ctx, {
    type: chartType,
    data: chartData,
    options: chartOptions
  });
  
  // 显示数据表格
  renderDataTable(chartData);
}

// 准备饼图/极区图数据
function preparePieChartData(data, labelIndex, valueIndex, limit) {
  // 跳过表头行
  const dataRows = data.slice(1);
  
  // 提取标签和数值
  let chartData = dataRows.map(row => {
    if (row.length <= Math.max(labelIndex, valueIndex)) return null;
    
    const label = row[labelIndex] || '未命名';
    const valueStr = row[valueIndex] || '0';
    
    // 处理百分比格式
    let value;
    if (valueStr.endsWith('%')) {
      value = parseFloat(valueStr.replace('%', '').replace(/,/g, '')) / 100;
    } else {
      value = parseFloat(valueStr.replace(/,/g, ''));
    }
    
    // 确保值是有效数字
    if (isNaN(value)) value = 0;
    
    return { label, value };
  }).filter(item => item !== null);
  
  // 排序并限制数据点数量
  chartData.sort((a, b) => b.value - a.value);
  if (chartData.length > limit) {
    const others = chartData.slice(limit).reduce((sum, item) => sum + item.value, 0);
    chartData = chartData.slice(0, limit);
    if (others > 0) {
      chartData.push({ label: '其他', value: others });
    }
  }
  
  // 生成随机颜色
  const backgroundColors = chartData.map(() => getRandomColor());
  
  // 检查是否为百分比数据
  const isPercentage = data[0][valueIndex] && 
                       (data[0][valueIndex].includes('Ratio') || 
                        data[0][valueIndex].includes('Rate') || 
                        data[0][valueIndex].includes('ROE') || 
                        data[0][valueIndex].includes('ROA') || 
                        data[0][valueIndex].includes('Yield') || 
                        data[0][valueIndex].includes('Growth') ||
                        data[0][valueIndex].includes('Return'));
  
  // 格式化为Chart.js需要的格式
  return {
    data: {
      labels: chartData.map(item => item.label),
      datasets: [{
        data: chartData.map(item => item.value),
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${data[0][labelIndex] || '标签'} vs ${data[0][valueIndex] || '数值'}`
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let value = context.raw;
              if (isPercentage) {
                return `${context.label}: ${(value * 100).toFixed(2)}%`;
              } else {
                return `${context.label}: ${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    }
  };
}

// 准备轴图表数据（折线图、柱状图、雷达图）
function prepareAxisChartData(data, xIndex, yIndexes, sorting, chartType) {
  // 检测是否是财务报表格式
  const isFinancialReport = data.length > 1 && data[0].length > 2 && 
                           (data[0].includes('Fiscal Year') || 
                            data[0].includes('Period Ending'));
  
  if (isFinancialReport) {
    // 如果xIndex是'all_years'，表示我们要使用所有年份列作为X轴
    // 将sorting参数传递给prepareFinancialReportData
    return prepareFinancialReportData(data, xIndex, yIndexes, chartType, sorting);
  }
  
  // 标准CSV格式数据处理
  // 跳过表头行
  const dataRows = data.slice(1);
  
  // 处理单选和多选
  let yIndices = [];
  if (Array.isArray(yIndexes)) {
    yIndices = yIndexes;
  } else if (chartType === 'radar' && document.getElementById('yAxisField').multiple) {
    // 获取所有选中的选项
    const options = document.getElementById('yAxisField').selectedOptions;
    yIndices = Array.from(options).map(option => parseInt(option.value));
  } else {
    yIndices = [parseInt(yIndexes)];
  }
  
  // 确保至少有一个Y轴指标
  if (yIndices.length === 0) {
    yIndices = [parseInt(document.getElementById('yAxisField').value)];
  }
  
  // 提取X轴和Y轴数据
  let chartData = dataRows.map(row => {
    if (row.length <= Math.max(xIndex, ...yIndices)) return null;
    
    const xValue = row[xIndex] || '';
    const yValues = yIndices.map(idx => {
      const valueStr = row[idx] || '0';
      
      // 处理百分比格式
      if (valueStr.endsWith('%')) {
        return parseFloat(valueStr.replace('%', '').replace(/,/g, '')) / 100;
      } 
      // 处理"Upgrade"或非数字情况
      else if (valueStr === 'Upgrade' || valueStr === '-') {
        return null;
      }
      else {
        return parseFloat(valueStr.replace(/,/g, ''));
      }
    });
    
    return { x: xValue, yValues };
  }).filter(item => item !== null);
  
  // 排序基于第一个Y值
  if (sorting === 'asc') {
    chartData.sort((a, b) => {
      const aVal = a.yValues[0] === null ? -Infinity : a.yValues[0];
      const bVal = b.yValues[0] === null ? -Infinity : b.yValues[0];
      return aVal - bVal;
    });
  } else if (sorting === 'desc') {
    chartData.sort((a, b) => {
      const aVal = a.yValues[0] === null ? -Infinity : a.yValues[0];
      const bVal = b.yValues[0] === null ? -Infinity : b.yValues[0];
      return bVal - aVal;
    });
  }
  
  // 检查是否为百分比数据
  const isPercentage = yIndices.some(idx => 
    data[0][idx] && (
      data[0][idx].includes('Ratio') || 
      data[0][idx].includes('Rate') || 
      data[0][idx].includes('ROE') || 
      data[0][idx].includes('ROA') || 
      data[0][idx].includes('Yield') || 
      data[0][idx].includes('Growth') ||
      data[0][idx].includes('Return')
    )
  );
  
  // 创建数据集
  const datasets = yIndices.map((yIndex, idx) => {
    const color = getRandomColor();
    return {
      label: data[0][yIndex] || `数值 ${idx + 1}`,
      data: chartData.map(item => item.yValues[idx]),
      backgroundColor: color + '80',  // 半透明
      borderColor: color,
      borderWidth: 1,
      fill: chartType === 'radar'
    };
  });
  
  // 格式化为Chart.js需要的格式
  return {
    data: {
      labels: chartData.map(item => item.x),
      datasets: datasets
    },
    options: {
      responsive: true,
      scales: chartType !== 'radar' ? {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              if (isPercentage) {
                return value * 100 + '%';
              }
              return value;
            }
          }
        }
      } : undefined,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${data[0][xIndex] || 'X轴'} vs ${yIndices.map(idx => data[0][idx] || 'Y轴').join(', ')}`
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let value = context.raw;
              if (value === null) return `${context.dataset.label}: N/A`;
              
              if (isPercentage) {
                return `${context.dataset.label}: ${(value * 100).toFixed(2)}%`;
              } else {
                return `${context.dataset.label}: ${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    }
  };
}

// 准备财务报表格式数据
function prepareFinancialReportData(data, xIndex, yIndexes, chartType, sorting) {
  // 财务报表格式：X轴是年份(位于表头行)，Y轴是指标(每个指标占一行)
  
  // 移除"全选"选项
  const yIndices = Array.isArray(yIndexes) ? 
                 yIndexes.filter(idx => idx !== 'all') : 
                 [parseInt(yIndexes)];
  
  // 收集所有年份列
  const yearColumns = [];
  for (let i = 1; i < data[0].length; i++) {
    if (data[0][i] && data[0][i] !== 'Upgrade') {
      yearColumns.push(i);
    }
  }
  
  // 对年份列进行排序处理
  // 尝试解析年份信息，按时间先后顺序排序
  const sortedYearColumns = [...yearColumns].sort((a, b) => {
    const yearA = data[0][a];
    const yearB = data[0][b];
    
    // 处理特殊情况：如果包含"Current"，放在最后
    if (yearA.includes('Current')) return 1;
    if (yearB.includes('Current')) return -1;
    
    // 尝试从字符串中提取年份
    const extractYear = (str) => {
      // 处理 "FY 2020" 格式
      const fyMatch = str.match(/FY\s+(\d{4})/);
      if (fyMatch) return parseInt(fyMatch[1]);
      
      // 处理 "2015 - 2019" 格式 - 取区间最早年份
      const rangeMatch = str.match(/(\d{4})\s*-\s*\d{4}/);
      if (rangeMatch) return parseInt(rangeMatch[1]);
      
      // 处理其他可能包含年份的字符串
      const yearMatch = str.match(/\b(20\d{2})\b/);
      if (yearMatch) return parseInt(yearMatch[1]);
      
      return 9999; // 默认值，无法识别的年份放在最后
    };
    
    const yearNumA = extractYear(yearA);
    const yearNumB = extractYear(yearB);
    
    // 根据用户选择的排序方向进行排序
    // 默认是升序（从早到晚），如果选择了desc则变为降序
    return sorting === 'desc' ? yearNumB - yearNumA : yearNumA - yearNumB;
  });
  
  // 为每个指标创建跨年份的数据集
  const timeSeriesDatasets = yIndices.map(rowIndex => {
    // 确保行存在
    if (rowIndex < 1 || rowIndex >= data.length) return null;
    
    const row = data[rowIndex];
    if (!row || row.length < 2) return null;
    
    // 获取指标名称(第一列)
    const metricName = row[0];
    
    // 判断是否为百分比数据
    const isPercentValue = metricName && (
      metricName.includes('Ratio') || 
      metricName.includes('Rate') || 
      metricName.includes('ROE') || 
      metricName.includes('ROA') || 
      metricName.includes('Yield') || 
      metricName.includes('Growth') ||
      metricName.includes('Return')
    );
    
    // 获取该指标在所有年份的值（按排序后的年份顺序）
    const values = sortedYearColumns.map(colIndex => {
      const value = row[colIndex];
      
      // 解析值
      if (typeof value === 'string') {
        if (value.endsWith('%')) {
          return parseFloat(value.replace('%', '').replace(/,/g, '')) / 100;
        } else if (value === 'Upgrade' || value === '-') {
          return null;
        } else {
          return parseFloat(value.replace(/,/g, ''));
        }
      } else {
        return value;
      }
    });
    
    // 随机颜色
    const color = getRandomColor();
    
    return {
      label: metricName || `指标 ${rowIndex}`,
      data: values,
      backgroundColor: color + '80',
      borderColor: color,
      borderWidth: 1,
      fill: chartType === 'radar',
      isPercentage: isPercentValue
    };
  }).filter(dataset => dataset !== null);
  
  // 获取排序后的年份标签
  const yearLabels = sortedYearColumns.map(colIndex => data[0][colIndex]);
  
  // 检查任意数据集是否包含百分比数据
  const hasPercentageData = timeSeriesDatasets.some(ds => ds.isPercentage);
  
  // 格式化为Chart.js需要的格式(时间序列)
  return {
    data: {
      labels: yearLabels,
      datasets: timeSeriesDatasets
    },
    options: {
      responsive: true,
      scales: chartType !== 'radar' ? {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              if (hasPercentageData) {
                return value * 100 + '%';
              }
              return value;
            }
          }
        }
      } : undefined,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `各年度财务指标趋势图`
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const dataset = timeSeriesDatasets[context.datasetIndex];
              let value = context.raw;
              if (value === null) return `${dataset.label}: N/A`;
              
              if (dataset.isPercentage) {
                return `${dataset.label}: ${(value * 100).toFixed(2)}%`;
              } else {
                return `${dataset.label}: ${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    }
  };
}

// 生成随机颜色
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// 渲染数据表格
function renderDataTable(chartData) {
  if (!chartData || !chartData.datasets || chartData.datasets.length === 0) {
    return;
  }
  
  const tableContainer = document.getElementById('dataTable');
  tableContainer.innerHTML = '';
  
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  
  // 创建表头
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // 添加"标签"列
  const labelHeader = document.createElement('th');
  labelHeader.textContent = '标签';
  headerRow.appendChild(labelHeader);
  
  // 添加每个数据集的列
  chartData.datasets.forEach((dataset, index) => {
    const header = document.createElement('th');
    header.textContent = dataset.label || `数据集 ${index + 1}`;
    headerRow.appendChild(header);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 创建表体
  const tbody = document.createElement('tbody');
  
  // 添加数据行
  for (let i = 0; i < chartData.labels.length; i++) {
    const row = document.createElement('tr');
    
    // 添加标签单元格
    const labelCell = document.createElement('td');
    labelCell.textContent = chartData.labels[i];
    row.appendChild(labelCell);
    
    // 添加每个数据集的值
    chartData.datasets.forEach(dataset => {
      const cell = document.createElement('td');
      
      // 处理空值或null
      if (dataset.data[i] === null || dataset.data[i] === undefined) {
        cell.textContent = 'N/A';
      } 
      // 处理百分比
      else if (dataset.label && (
          dataset.label.includes('Ratio') || 
          dataset.label.includes('Rate') || 
          dataset.label.includes('ROE') || 
          dataset.label.includes('ROA') || 
          dataset.label.includes('Yield') || 
          dataset.label.includes('Growth') ||
          dataset.label.includes('Return'))) {
        cell.textContent = (dataset.data[i] * 100).toFixed(2) + '%';
      } 
      // 普通数值
      else {
        cell.textContent = typeof dataset.data[i] === 'number' ? 
                          dataset.data[i].toLocaleString() : 
                          dataset.data[i];
      }
      
      row.appendChild(cell);
    });
    
    tbody.appendChild(row);
  }
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
}

// 保存图表
function saveChart() {
  if (!currentChartInstance) {
    alert('请先生成图表');
    return;
  }
  
  const title = document.getElementById('chartTitle').value || '未命名图表';
  const description = document.getElementById('chartDescription').value || '';
  
  // 获取图表的图像数据URL
  const chartImageURL = currentChartInstance.toBase64Image();
  
  // 创建图表对象
  const chartObj = {
    id: Date.now().toString(),
    title: title,
    description: description,
    type: currentChartInstance.config.type,
    data: currentChartInstance.data,
    options: currentChartInstance.options,
    imageURL: chartImageURL,
    timestamp: new Date().toISOString(),
    rawData: currentData
  };
  
  // 添加到savedCharts并保存到storage
  savedCharts.push(chartObj);
  chrome.storage.local.set({'visualizationCharts': savedCharts}, function() {
    // 关闭模态框前先移除焦点
    if (document.activeElement) {
      document.activeElement.blur();
    }
    
    if (bootstrap && bootstrap.Modal) {
      const saveModal = bootstrap.Modal.getInstance(document.getElementById('saveChartModal'));
      if (saveModal) {
        saveModal.hide();
        
        // 确保移除aria-hidden属性
        setTimeout(() => {
          const modalElement = document.getElementById('saveChartModal');
          if (modalElement) {
            modalElement.removeAttribute('aria-hidden');
          }
        }, 300);
      } else {
        // 手动关闭模态框
        const modal = document.getElementById('saveChartModal');
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.removeAttribute('aria-hidden');
        document.body.classList.remove('modal-open');
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }
    } else {
      // 手动关闭模态框
      const modal = document.getElementById('saveChartModal');
      modal.style.display = 'none';
      modal.classList.remove('show');
      modal.removeAttribute('aria-hidden');
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.parentNode.removeChild(backdrop);
      }
    }
    
    // 刷新已保存图表列表
    renderSavedCharts();
    
    // 切换到已保存图表标签
    const savedTab = document.getElementById('saved-tab');
    if (bootstrap && bootstrap.Tab) {
      const tab = new bootstrap.Tab(savedTab);
      tab.show();
    } else {
      // 备用方案：手动添加active类
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(el => {
        el.classList.remove('show', 'active');
      });
      savedTab.classList.add('active');
      document.getElementById('saved').classList.add('show', 'active');
    }
  });
}

// 导出图表
function exportChart() {
  if (!currentChartInstance) {
    alert('请先生成图表');
    return;
  }
  
  const format = document.getElementById('exportFormat').value;
  const filename = document.getElementById('exportFilename').value || 'financial_chart';
  
  // 关闭模态框前先移除焦点
  if (document.activeElement) {
    document.activeElement.blur();
  }
  
  // 关闭模态框
  if (bootstrap && bootstrap.Modal) {
    const exportModal = bootstrap.Modal.getInstance(document.getElementById('exportChartModal'));
    if (exportModal) {
      exportModal.hide();
      
      // 确保移除aria-hidden属性
      setTimeout(() => {
        const modalElement = document.getElementById('exportChartModal');
        if (modalElement) {
          modalElement.removeAttribute('aria-hidden');
        }
      }, 300);
    } else {
      // 手动关闭模态框
      const modal = document.getElementById('exportChartModal');
      modal.style.display = 'none';
      modal.classList.remove('show');
      modal.removeAttribute('aria-hidden');
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.parentNode.removeChild(backdrop);
      }
    }
  } else {
    // 手动关闭模态框
    const modal = document.getElementById('exportChartModal');
    modal.style.display = 'none';
    modal.classList.remove('show');
    modal.removeAttribute('aria-hidden');
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.parentNode.removeChild(backdrop);
    }
  }
  
  if (format === 'csv') {
    // 导出为CSV（包含图表URL和数据）
    exportToCSV(filename);
  } else {
    // 导出为图片
    exportToImage(filename, format);
  }
}

// 导出为CSV
function exportToCSV(filename) {
  if (!currentData) return;
  
  // 获取图表的图像数据URL
  const chartImageURL = currentChartInstance.toBase64Image();
  
  // 创建一个新的CSV数据，添加图表URL作为第一行
  let csvData = `Chart URL,${chartImageURL}\n`;
  
  // 添加原始数据
  csvData += currentData.map(row => row.map(cell => {
    // 处理包含逗号的单元格
    return cell.includes(',') ? `"${cell}"` : cell;
  }).join(',')).join('\n');
  
  // 创建Blob并下载
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  // 创建下载链接
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 导出为图片
function exportToImage(filename, format) {
  // 获取图表的图像数据URL
  let imageURL;
  
  if (format === 'png') {
    imageURL = currentChartInstance.toBase64Image();
  } else if (format === 'jpg') {
    imageURL = currentChartInstance.toBase64Image('image/jpeg');
  } else if (format === 'pdf') {
    // 对于PDF，我们需要更复杂的处理
    alert('PDF导出功能正在开发中');
    return;
  }
  
  // 创建下载链接
  const a = document.createElement('a');
  a.href = imageURL;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 渲染已保存的图表
function renderSavedCharts() {
  const container = document.getElementById('saved-charts-container');
  
  // 清空容器
  container.innerHTML = '';
  
  const noSavedChartsElement = document.getElementById('no-saved-charts');
  
  if (savedCharts.length === 0) {
    if (noSavedChartsElement) {
      noSavedChartsElement.style.display = 'block';
    }
    return;
  }
  
  if (noSavedChartsElement) {
    noSavedChartsElement.style.display = 'none';
  }
  
  // 渲染每个已保存的图表
  savedCharts.forEach(chart => {
    const chartElement = document.createElement('div');
    chartElement.className = 'chart-container';
    chartElement.dataset.chartId = chart.id;
    
    const chartHeader = document.createElement('div');
    chartHeader.className = 'chart-header';
    
    const title = document.createElement('h2');
    title.textContent = chart.title;
    
    const controls = document.createElement('div');
    controls.className = 'chart-controls';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-primary';
    viewBtn.textContent = '查看';
    viewBtn.addEventListener('click', () => viewSavedChart(chart.id));
    
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-success';
    exportBtn.textContent = '导出';
    exportBtn.addEventListener('click', () => exportSavedChart(chart.id));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => deleteSavedChart(chart.id));
    
    controls.appendChild(viewBtn);
    controls.appendChild(exportBtn);
    controls.appendChild(deleteBtn);
    
    chartHeader.appendChild(title);
    chartHeader.appendChild(controls);
    
    const chartImage = document.createElement('img');
    chartImage.src = chart.imageURL;
    chartImage.alt = chart.title;
    chartImage.style.width = '100%';
    
    const chartDescription = document.createElement('p');
    chartDescription.textContent = chart.description;
    chartDescription.className = 'mt-3';
    
    const chartDate = document.createElement('div');
    chartDate.className = 'text-muted mt-2';
    chartDate.textContent = `创建于: ${new Date(chart.timestamp).toLocaleString()}`;
    
    chartElement.appendChild(chartHeader);
    chartElement.appendChild(chartImage);
    if (chart.description) {
      chartElement.appendChild(chartDescription);
    }
    chartElement.appendChild(chartDate);
    
    container.appendChild(chartElement);
  });
}

// 查看已保存的图表
function viewSavedChart(chartId) {
  const chart = savedCharts.find(c => c.id === chartId);
  if (!chart) return;
  
  // 切换到新建图表标签页
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
  
  // 显示预览区域
  document.getElementById('preview-chart-container').style.display = 'block';
  
  // 创建图表
  const ctx = document.getElementById('previewChart').getContext('2d');
  
  // 如果已经存在图表实例，销毁它
  if (currentChartInstance) {
    currentChartInstance.destroy();
  }
  
  // 创建新的图表实例
  currentChartInstance = new Chart(ctx, {
    type: chart.type,
    data: chart.data,
    options: chart.options
  });
  
  // 设置当前数据
  currentData = chart.rawData;
  
  // 渲染数据表格
  renderDataTable(chart.data);
  
  // 填充标题和描述
  document.getElementById('chartTitle').value = chart.title;
  document.getElementById('chartDescription').value = chart.description || '';
}

// 导出已保存的图表
function exportSavedChart(chartId) {
  const chart = savedCharts.find(c => c.id === chartId);
  if (!chart) return;
  
  // 显示导出模态框
  if (bootstrap && bootstrap.Modal) {
    const exportModal = new bootstrap.Modal(document.getElementById('exportChartModal'));
    
    // 设置默认文件名
    document.getElementById('exportFilename').value = chart.title.replace(/\s+/g, '_').toLowerCase();
    
    // 设置临时的currentChartInstance和currentData
    const tempChartInstance = currentChartInstance;
    const tempCurrentData = currentData;
    
    // 创建临时图表实例
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 800;
    tempCanvas.height = 400;
    document.body.appendChild(tempCanvas);
    
    const tempContext = tempCanvas.getContext('2d');
    const tempChart = new Chart(tempContext, {
      type: chart.type,
      data: chart.data,
      options: chart.options
    });
    
    currentChartInstance = tempChart;
    currentData = chart.rawData;
    
    // 导出按钮点击事件
    const confirmExportBtn = document.getElementById('confirmExportBtn');
    const originalClickHandler = confirmExportBtn.onclick;
    
    confirmExportBtn.onclick = function() {
      exportChart();
      
      // 恢复原始状态
      currentChartInstance = tempChartInstance;
      currentData = tempCurrentData;
      
      // 销毁临时图表
      tempChart.destroy();
      document.body.removeChild(tempCanvas);
      
      // 恢复原始点击事件
      confirmExportBtn.onclick = originalClickHandler;
    };
    
    exportModal.show();
  } else {
    // 备用方案：手动显示模态框
    const modal = document.getElementById('exportChartModal');
    modal.style.display = 'block';
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    
    // 设置默认文件名
    document.getElementById('exportFilename').value = chart.title.replace(/\s+/g, '_').toLowerCase();
    
    // 设置临时的currentChartInstance和currentData
    const tempChartInstance = currentChartInstance;
    const tempCurrentData = currentData;
    
    // 创建临时图表实例
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 800;
    tempCanvas.height = 400;
    document.body.appendChild(tempCanvas);
    
    const tempContext = tempCanvas.getContext('2d');
    const tempChart = new Chart(tempContext, {
      type: chart.type,
      data: chart.data,
      options: chart.options
    });
    
    currentChartInstance = tempChart;
    currentData = chart.rawData;
    
    // 导出按钮点击事件
    const confirmExportBtn = document.getElementById('confirmExportBtn');
    const originalClickHandler = confirmExportBtn.onclick;
    
    confirmExportBtn.onclick = function() {
      exportChart();
      
      // 恢复原始状态
      currentChartInstance = tempChartInstance;
      currentData = tempCurrentData;
      
      // 销毁临时图表
      tempChart.destroy();
      document.body.removeChild(tempCanvas);
      
      // 恢复原始点击事件
      confirmExportBtn.onclick = originalClickHandler;
    };
    
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade show';
    document.body.appendChild(backdrop);
  }
}

// 删除已保存的图表
function deleteSavedChart(chartId) {
  if (!confirm('确定要删除此图表吗？此操作不可撤销。')) return;
  
  const index = savedCharts.findIndex(c => c.id === chartId);
  if (index === -1) return;
  
  // 从数组中移除
  savedCharts.splice(index, 1);
  
  // 更新存储
  chrome.storage.local.set({'visualizationCharts': savedCharts}, function() {
    // 刷新图表列表
    renderSavedCharts();
  });
}

// 导入数据
function importData() {
  const fileInput = document.getElementById('importFile');
  const resultDiv = document.getElementById('import-result');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    resultDiv.innerHTML = '<div class="alert alert-danger">请选择文件</div>';
    return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const csvData = e.target.result;
      
      // 创建导入的数据对象
      const importedData = {
        data: csvData,
        fileName: file.name,
        timestamp: new Date().toISOString()
      };
      
      // 保存到storage
      chrome.storage.local.set({'newImportedData': importedData}, function() {
        // 添加到数据源列表
        availableDataSources.push(importedData);
        populateDataSourceDropdown();
        
        // 选择新导入的数据
        const dataSourceSelect = document.getElementById('dataSource');
        dataSourceSelect.value = availableDataSources.length - 1;
        populateDataFields(availableDataSources.length - 1);
        
        // 显示成功消息
        resultDiv.innerHTML = '<div class="alert alert-success">数据导入成功！已添加到数据源列表。</div>';
        
        // 切换到新建图表标签
        setTimeout(() => {
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
        }, 1000);
      });
    } catch (error) {
      resultDiv.innerHTML = `<div class="alert alert-danger">导入失败: ${error.message}</div>`;
    }
  };
  
  reader.onerror = function() {
    resultDiv.innerHTML = '<div class="alert alert-danger">读取文件失败</div>';
  };
  
  reader.readAsText(file);
}

// API设置管理
function loadApiSettings() {
  chrome.storage.local.get(['aiAPIKey', 'aiAPIEndpoint', 'aiAPIModel'], function(result) {
    // 加载API密钥
    if (result.aiAPIKey) {
      document.getElementById('aiApiKey').value = result.aiAPIKey;
      
      // 更新状态显示
      updateApiStatus('密钥已设置', 'success');
    }
    
    // 加载API端点
    if (result.aiAPIEndpoint) {
      document.getElementById('aiApiEndpoint').value = result.aiAPIEndpoint;
      AI_API_CONFIG.apiEndpoint = result.aiAPIEndpoint;
    } else {
      // 设置默认值
      document.getElementById('aiApiEndpoint').value = AI_API_CONFIG.apiEndpoint;
    }
    
    // 加载模型选择
    if (result.aiAPIModel) {
      document.getElementById('aiApiModel').value = result.aiAPIModel;
      AI_API_CONFIG.model = result.aiAPIModel;
    }
  });
}

function saveApiKey() {
  const apiKey = document.getElementById('aiApiKey').value;
  
  if (!apiKey) {
    updateApiStatus('请输入有效的API密钥', 'danger');
    return;
  }
  
  chrome.storage.local.set({'aiAPIKey': apiKey}, function() {
    updateApiStatus('API密钥已保存', 'success');
  });
}

function saveApiEndpoint() {
  const apiEndpoint = document.getElementById('aiApiEndpoint').value;
  
  if (!apiEndpoint) {
    updateApiStatus('请输入有效的API端点', 'danger');
    return;
  }
  
  chrome.storage.local.set({'aiAPIEndpoint': apiEndpoint}, function() {
    // 更新当前配置
    AI_API_CONFIG.apiEndpoint = apiEndpoint;
    updateApiStatus('API端点已保存', 'success');
  });
}

function saveApiModel() {
  const apiModel = document.getElementById('aiApiModel').value;
  
  chrome.storage.local.set({'aiAPIModel': apiModel}, function() {
    // 更新当前配置
    AI_API_CONFIG.model = apiModel;
    updateApiStatus('模型选择已保存', 'success');
  });
}

function updateApiStatus(message, type) {
  const statusElement = document.getElementById('apiKeyStatus');
  statusElement.textContent = message;
  statusElement.className = `alert alert-${type}`;
  statusElement.style.display = 'block';
  
  // 3秒后隐藏状态消息
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('aiApiKey');
  const toggleBtn = document.getElementById('toggleApiKeyBtn');
  
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
  } else {
    apiKeyInput.type = 'password';
    toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
  }
}

// // AI分析功能
// // 生成AI分析
// function generateAIAnalysis() {
//   const sourceIndex = document.getElementById('aiDataSource').value;
//   const promptText = document.getElementById('aiPrompt').value;
  
//   if (!sourceIndex) {
//     alert('请选择要分析的数据源');
//     return;
//   }
  
//   const sourceData = availableDataSources[sourceIndex];
//   if (!sourceData || !sourceData.data) {
//     alert('所选数据源无效');
//     return;
//   }
  
//   // 显示加载提示
//   document.getElementById('ai-analysis-loading').style.display = 'block';
//   document.getElementById('ai-analysis-result').style.display = 'none';
//   document.getElementById('ai-analysis-loading').innerHTML = '正在生成AI分析，请稍候...<div class="spinner-border spinner-border-sm ms-2" role="status"><span class="visually-hidden">加载中...</span></div>';
  
//   // 获取API设置
//   chrome.storage.local.get(['aiAPIKey', 'aiAPIEndpoint', 'aiAPIModel'], function(result) {
//     let apiKey = result.aiAPIKey;
    
//     // 更新API配置
//     if (result.aiAPIEndpoint) {
//       AI_API_CONFIG.apiEndpoint = result.aiAPIEndpoint;
//     }
//     if (result.aiAPIModel) {
//       AI_API_CONFIG.model = result.aiAPIModel;
//     }
    
//     if (!apiKey) {
//       // 如果没有设置API密钥，提示用户设置
//       document.getElementById('ai-analysis-loading').style.display = 'none';
      
//       // 显示API密钥设置错误
//       updateApiStatus('请先设置API密钥', 'danger');
//       return;
//     }
    
//     // 测试端点连接
//     testAPIConnection(AI_API_CONFIG.apiEndpoint)
//       .then(isConnected => {
//         if (!isConnected) {
//           document.getElementById('ai-analysis-loading').style.display = 'none';
//           alert('无法连接到API服务器，请检查URL是否正确且服务器是否可用');
//           return;
//         }
        
//         // 构建AI提示信息
//         const analysisPrompt = buildAnalysisPrompt(sourceData, promptText);
        
//         // 调用AI API
//         callAIAPI(analysisPrompt, apiKey)
//           .then(response => {
//             // 处理并显示分析结果
//             displayAIAnalysisResult(response, sourceData);
//           })
//           .catch(error => {
//             document.getElementById('ai-analysis-loading').style.display = 'none';
//             alert('生成AI分析时出错: ' + error.message);
//             console.error('AI API错误:', error);
//           });
//       })
//       .catch(error => {
//         document.getElementById('ai-analysis-loading').style.display = 'none';
//         alert('测试API连接时出错: ' + error.message);
//       });
//   });
// }

// // 测试API端点连接
// async function testAPIConnection(endpoint) {
//   try {
//     // 确保endpoint是完整的URL
//     if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
//       endpoint = `https://${endpoint}`;
//     }
    
//     // 尝试使用HEAD请求测试连接
//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
//     try {
//       // 注意：某些API可能不支持HEAD请求或OPTIONS请求，这只是一个基本连接测试
//       // 建议使用一个专门的API健康检查端点，如果有的话
//       const response = await fetch(endpoint, {
//         method: 'HEAD',
//         mode: 'no-cors', // 使用no-cors模式以避免CORS错误
//         signal: controller.signal
//       });
      
//       clearTimeout(timeoutId);
//       return true; // 如果能执行到这里，连接基本正常
//     } catch (error) {
//       clearTimeout(timeoutId);
//       console.error('API连接测试失败:', error);
      
//       // 对于no-cors模式，我们可能收不到有意义的响应，这里只是做一个基本的网络可达性检查
//       // 如果是超时错误，则认为连接失败
//       if (error.name === 'AbortError') {
//         return false;
//       }
      
//       // 对于其他错误，可能是CORS问题而不是真正的连接问题
//       // 所以我们在这里仍然返回true，让真正的API调用去尝试
//       return true;
//     }
//   } catch (error) {
//     console.error('测试API连接时出错:', error);
//     return false;
//   }
// }

// // 构建分析提示
// function buildAnalysisPrompt(sourceData, userPrompt) {
//   // 解析CSV数据
//   const parsedData = parseCSVData(sourceData.data);
  
//   // 提取公司信息（如果有）
//   let companyInfo = '';
//   if (sourceData.info && sourceData.info.ticker) {
//     companyInfo = `公司代码: ${sourceData.info.ticker}\n`;
//   }
//   if (sourceData.fileName) {
//     companyInfo += `数据文件: ${sourceData.fileName}\n`;
//   }
  
//   // 将CSV数据转换为文本表格格式
//   const tableData = parsedData.map(row => row.join('\t')).join('\n');
  
//   // 构建标准提示
//   let standardPrompt = `
// 你是一位专业的财务分析师，请对以下财务数据进行分析。
// ${companyInfo}

// 财务数据（制表符分隔格式）:
// ${tableData}

// 请提供以下分析:
// 1. 公司财务状况概述
// 2. 主要财务指标分析和趋势
// 3. 公司的优势和风险因素
// 4. 投资价值分析和建议
// 5. 未来发展预测

// 请尽可能基于数据给出分析，避免主观猜测。如果数据不足以得出某些结论，请明确指出。
// 分析应该清晰、专业，并包含适当的财务术语。请以易于理解的方式呈现复杂的财务概念。
// `;

//   // 如果用户提供了额外提示，添加到标准提示
//   if (userPrompt && userPrompt.trim()) {
//     standardPrompt += `\n额外分析要求: ${userPrompt.trim()}`;
//   }
  
//   return standardPrompt;
// }

// // 调用AI API
// async function callAIAPI(prompt, apiKey) {
//   try {
//     const currentModel = AI_API_CONFIG.model;
//     const modelConfig = MODEL_CONFIGS[currentModel] || MODEL_CONFIGS['gpt-4o'];
    
//     // 检查是否是自定义端点
//     const isCustomEndpoint = AI_API_CONFIG.apiEndpoint !== MODEL_CONFIGS[currentModel]?.endpoint;
//     let endpoint = isCustomEndpoint ? AI_API_CONFIG.apiEndpoint : modelConfig.endpoint;
//     const provider = isCustomEndpoint ? 'openai' : modelConfig.provider; // 默认自定义端点使用OpenAI格式

//     // 确保endpoint是完整的URL
//     if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
//       // 只添加https://前缀，不修改路径
//       endpoint = `https://${endpoint}`;
//     }
    
//     console.log(`发送请求到API端点: ${endpoint}`);

//     // 检查网络连接
//     if (!navigator.onLine) {
//       throw new Error('网络连接已断开，请检查您的网络设置');
//     }

//     // 根据不同提供商构建请求
//     let requestBody, headers;
    
//     if (provider === 'anthropic') {
//       // Anthropic Claude API 格式
//       requestBody = {
//         model: currentModel,
//         messages: [
//           { role: "user", content: prompt }
//         ],
//         system: "你是一位专业的财务分析师，擅长分析公司财务报表和提供投资建议。",
//         max_tokens: modelConfig.maxTokens
//       };
      
//       headers = {
//         'Content-Type': 'application/json',
//         'x-api-key': apiKey,
//         'anthropic-version': '2023-06-01'
//       };
//     } else {
//       // OpenAI API 格式 (默认)
//       requestBody = {
//         model: currentModel,
//         messages: [
//           { role: "system", content: "你是一位专业的财务分析师，擅长分析公司财务报表和提供投资建议。" },
//           { role: "user", content: prompt }
//         ],
//         temperature: AI_API_CONFIG.temperature,
//         max_tokens: modelConfig.maxTokens
//       };
      
//       headers = {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${apiKey}`
//       };
//     }
    
//     // 增加超时控制
//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
//     try {
//       // 发送请求
//       const response = await fetch(endpoint, {
//         method: 'POST',
//         headers: headers,
//         body: JSON.stringify(requestBody),
//         signal: controller.signal,
//         mode: 'cors' // 尝试启用CORS
//       });
      
//       clearTimeout(timeoutId); // 清除超时
      
//       if (!response.ok) {
//         const contentType = response.headers.get('content-type');
//         if (contentType && contentType.includes('application/json')) {
//           const errorData = await response.json();
//           let errorMessage = '调用API时发生未知错误';
//           if (provider === 'anthropic') {
//             errorMessage = errorData.error?.message || errorMessage;
//           } else {
//             errorMessage = errorData.error?.message || errorMessage;
//           }
//           throw new Error(errorMessage);
//         } else {
//           // 处理非JSON响应
//           const errorText = await response.text();
//           throw new Error(`API错误 (${response.status}): ${errorText.substring(0, 100)}...`);
//         }
//       }
      
//       const data = await response.json();
      
//       // 从不同的API响应格式中提取内容
//       let content = '';
//       if (provider === 'anthropic') {
//         content = data.content?.[0]?.text || '';
//       } else {
//         content = data.choices?.[0]?.message?.content || '';
//       }
      
//       return content;
//     } catch (fetchError) {
//       clearTimeout(timeoutId); // 确保清除超时
//       if (fetchError.name === 'AbortError') {
//         throw new Error('请求超时，API服务器响应时间过长');
//       }
//       throw fetchError;
//     }
//   } catch (error) {
//     console.error('AI API调用错误:', error);
    
//     // 提供更友好的错误消息
//     if (error.message.includes('Failed to fetch')) {
//       throw new Error('无法连接到API服务器，请检查URL是否正确以及服务器是否可用');
//     } else if (error.message.includes('NetworkError')) {
//       throw new Error('网络错误，可能是CORS策略限制或服务器不可达');
//     } else if (error.message.includes('SyntaxError')) {
//       throw new Error('服务器响应格式错误，收到的不是有效的JSON数据');
//     }
    
//     throw error;
//   }
// }

// 显示AI分析结果
// function displayAIAnalysisResult(analysisText, sourceData) {
//   // 隐藏加载提示
//   document.getElementById('ai-analysis-loading').style.display = 'none';
  
//   // 将分析文本转换为HTML（处理换行符等）
//   const formattedText = analysisText
//     .replace(/\n\n/g, '</p><p>')
//     .replace(/\n/g, '<br>')
//     .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
//     .replace(/\*(.*?)\*/g, '<em>$1</em>');
  
//   // 设置分析内容
//   const contentElement = document.getElementById('ai-analysis-content');
//   contentElement.innerHTML = `<p>${formattedText}</p>`;
  
//   // 保存当前分析结果
//   currentAIAnalysis = {
//     text: analysisText,
//     sourceData: sourceData,
//     timestamp: new Date().toISOString()
//   };
  
//   // 显示结果区域
//   document.getElementById('ai-analysis-result').style.display = 'block';
  
//   // 设置默认分析标题
//   let defaultTitle = '财务分析';
//   if (sourceData.info && sourceData.info.ticker) {
//     defaultTitle = `${sourceData.info.ticker} 财务分析`;
//   } else if (sourceData.fileName) {
//     defaultTitle = `${sourceData.fileName} 分析`;
//   }
//   document.getElementById('aiAnalysisTitle').value = defaultTitle;
// }

// 保存AI分析结果
// function saveAIAnalysis() {
//   if (!currentAIAnalysis) {
//     alert('没有可保存的分析结果');
//     return;
//   }
  
//   const title = document.getElementById('aiAnalysisTitle').value || '未命名分析';
//   const tagsInput = document.getElementById('aiAnalysisTags').value;
//   const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
  
//   // 创建分析对象
//   const analysisObj = {
//     id: Date.now().toString(),
//     title: title,
//     text: currentAIAnalysis.text,
//     formattedHTML: document.getElementById('ai-analysis-content').innerHTML,
//     sourceData: {
//       fileName: currentAIAnalysis.sourceData.fileName,
//       timestamp: currentAIAnalysis.sourceData.timestamp
//     },
//     tags: tags,
//     timestamp: new Date().toISOString()
//   };
  
//   // 加载已保存的分析
//   chrome.storage.local.get('savedAIAnalyses', function(result) {
//     const savedAnalyses = result.savedAIAnalyses || [];
//     savedAnalyses.push(analysisObj);
    
//     // 保存到storage
//     chrome.storage.local.set({'savedAIAnalyses': savedAnalyses}, function() {
//       // 更新本地缓存
//       savedAIAnalyses = savedAnalyses;
      
//       // 关闭模态框
//       if (bootstrap && bootstrap.Modal) {
//         const saveModal = bootstrap.Modal.getInstance(document.getElementById('saveAIAnalysisModal'));
//         if (saveModal) {
//           saveModal.hide();
//         } else {
//           // 手动关闭模态框
//           const modal = document.getElementById('saveAIAnalysisModal');
//           modal.style.display = 'none';
//           modal.classList.remove('show');
//           document.body.classList.remove('modal-open');
//           const backdrop = document.querySelector('.modal-backdrop');
//           if (backdrop) {
//             backdrop.parentNode.removeChild(backdrop);
//           }
//         }
//       } else {
//         // 手动关闭模态框
//         const modal = document.getElementById('saveAIAnalysisModal');
//         modal.style.display = 'none';
//         modal.classList.remove('show');
//         document.body.classList.remove('modal-open');
//         const backdrop = document.querySelector('.modal-backdrop');
//         if (backdrop) {
//           backdrop.parentNode.removeChild(backdrop);
//         }
//       }
      
//       // 显示保存成功消息
//       alert('分析结果已保存');
//     });
//   });
// }

// // 复制AI分析文本
// function copyAIAnalysisText() {
//   if (!currentAIAnalysis) {
//     alert('没有可复制的分析结果');
//     return;
//   }
  
//   // 复制纯文本版本
//   navigator.clipboard.writeText(currentAIAnalysis.text)
//     .then(() => {
//       // 临时显示复制成功消息
//       const copyBtn = document.getElementById('copyAIAnalysisBtn');
//       const originalText = copyBtn.textContent;
//       copyBtn.textContent = '已复制!';
      
//       setTimeout(() => {
//         copyBtn.textContent = originalText;
//       }, 2000);
//     })
//     .catch(err => {
//       console.error('复制失败:', err);
//       alert('复制文本失败');
//     });
// } 