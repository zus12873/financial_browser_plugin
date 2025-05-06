// 金融数据抓取器 - 内容脚本
// 这个脚本实现了Finance_data_scaper_macOS.py的功能

// 常量配置
const FINANCIAL_TABLE_SELECTOR = "table[data-test='financials']";

// 定义财务标签及其选择器
const TABS = {
  "Income": ".navmenu.submenu li a[href*='/financials/']:not([href*='balance']):not([href*='cash']):not([href*='ratios'])",
  "Balance Sheet": ".navmenu.submenu li a[href*='/financials/balance-sheet/']",
  "Cash Flow": ".navmenu.submenu li a[href*='/financials/cash-flow-statement/']",
  "Ratios": ".navmenu.submenu li a[href*='/financials/ratios/']"
};

// URL模式映射到标签类型
const URL_TO_TAB_TYPE = {
  "financials/balance-sheet": "Balance Sheet",
  "financials/cash-flow-statement": "Cash Flow",
  "financials/ratios": "Ratios",
  "financials/": "Income" // 默认Income页面通常就是主财务页面
};

// 添加全局变量存储批量抓取请求ID
let batchRequestId = null;

// 处理直接下载的函数
function handleDirectDownload(data, filename, mimeType) {
  console.log('执行直接下载:', filename);
  
  // 尝试使用下载弹窗
  if (typeof window.downloadModal === 'undefined') {
    // 动态加载下载弹窗样式和脚本
    loadDownloadModalResources()
      .then(() => {
        if (window.downloadModal) {
          console.log('使用下载弹窗');
          window.downloadModal.show(data, filename || 'financial_data.csv', mimeType || 'text/plain');
          return true;
        } else {
          return fallbackDownload();
        }
      })
      .catch(error => {
        console.error('加载下载弹窗资源失败:', error);
        return fallbackDownload();
      });
  } else if (window.downloadModal) {
    // 已加载下载弹窗
    console.log('使用已加载的下载弹窗');
    window.downloadModal.show(data, filename || 'financial_data.csv', mimeType || 'text/plain');
    return true;
  } else {
    // 无法使用下载弹窗，使用备用方法
    return fallbackDownload();
  }
  
  // 备用直接下载方法
  function fallbackDownload() {
  try {
    // 创建并点击一个下载链接
    const blob = new Blob([data], {type: mimeType || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'financial_data.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('直接下载完成');
    }, 100);
    return true;
  } catch (error) {
    console.error('直接下载失败:', error);
    return false;
  }
  }
  
  return true;
}

// 动态加载下载弹窗资源
async function loadDownloadModalResources() {
  return new Promise((resolve, reject) => {
    // 加载CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('static/css/download-modal.css');
    document.head.appendChild(cssLink);
    
    // 加载JS
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('static/js/download-modal.js');
    script.onload = () => {
      console.log('下载弹窗JS已加载');
      resolve();
    };
    script.onerror = (error) => {
      console.error('下载弹窗JS加载失败:', error);
      reject(error);
    };
    document.body.appendChild(script);
  });
}

// 判断当前页面是否包含财务数据表格
function hasFinancialData() {
  const tables = document.querySelectorAll(FINANCIAL_TABLE_SELECTOR);
  if (tables.length > 0) return true;
  
  // 备用方法：检查是否有财务导航菜单
  return document.querySelector(".navmenu.submenu") !== null;
}

// 从表格中提取数据 - 对应Python的extract_table函数
function extractTableData(table) {
  const rows = table.querySelectorAll('tr');
  const tableData = [];
  
  rows.forEach(row => {
    const rowData = [];
    const cells = row.querySelectorAll('th, td');
    
    cells.forEach(cell => {
      rowData.push(cell.textContent.trim());
    });
    
    if (rowData.length > 0) {
      tableData.push(rowData);
    }
  });
  
  return tableData;
}

// 将提取的数据转换为各种格式
function convertDataToFormat(tableData, format, fileName) {
  switch(format) {
    case 'csv':
      return {
        data: convertToCSV(tableData),
        mimeType: 'text/csv;charset=utf-8',
        extension: 'csv',
        addBOM: true
      };
    case 'json':
      return {
        data: convertToJSON(tableData),
        mimeType: 'application/json;charset=utf-8',
        extension: 'json'
      };
    case 'excel':
      return {
        data: convertToCSV(tableData),
        mimeType: 'application/vnd.ms-excel;charset=utf-8',
        extension: 'xls',
        addBOM: true
      };
    default:
      return {
        data: convertToCSV(tableData),
        mimeType: 'text/csv;charset=utf-8',
        extension: 'csv',
        addBOM: true
      };
  }
}

// 将数据转换为CSV格式
function convertToCSV(tableData) {
  if (!tableData || !tableData.length) return '';
  
  return tableData.map(row => 
    row.map(cell => 
      // 处理包含逗号的单元格
      cell.includes(',') ? `"${cell}"` : cell
    ).join(',')
  ).join('\n');
}

// 将数据转换为JSON格式
function convertToJSON(tableData) {
  if (!tableData || tableData.length < 2) return '[]';
  
  const result = [];
  let currentSection = null;
  
  // 查找标题行 (通常是第一行或包含财务报表名称的行)
  let titleRow = 0;
  for (let i = 0; i < tableData.length; i++) {
    if (tableData[i].length > 0 && (tableData[i][0].includes('-') || tableData[i][0].includes('表'))) {
      titleRow = i;
      currentSection = tableData[i][0].trim();
      break;
    }
  }
  
  // 找到实际的表头(期间/年份)
  let headerRow = -1;
  for (let i = titleRow + 1; i < tableData.length; i++) {
    // 查找包含多个列的行，且可能包含"Period"、"年"、"FY"等字样
    if (tableData[i].length > 1 && 
        (tableData[i].some(cell => 
          cell.includes('Period') || 
          cell.includes('Fiscal') || 
          cell.includes('年') || 
          cell.includes('FY') ||
          /20\d\d/.test(cell)) // 匹配年份格式如2021
        )) {
      headerRow = i;
      break;
    }
  }
  
  // 如果没找到标准表头，尝试使用第一个有多列的行作为表头
  if (headerRow === -1) {
    for (let i = titleRow + 1; i < tableData.length; i++) {
      if (tableData[i].length > 1) {
        headerRow = i;
        break;
      }
    }
  }
  
  // 如果仍然找不到表头，使用第一行
  if (headerRow === -1) {
    headerRow = 0;
  }
  
  // 提取表头（期间/年份）
  const headers = tableData[headerRow].map(header => header.trim());
  
  // 处理数据行
  for (let i = headerRow + 1; i < tableData.length; i++) {
    const row = tableData[i];
    
    // 跳过空行
    if (row.length <= 1 || row.every(cell => !cell.trim())) {
      continue;
    }
    
    // 处理新的数据段落
    if (row.length === 1 && row[0].trim()) {
      currentSection = row[0].trim();
      continue;
    }
    
    // 确保行有足够的数据
    if (row.length < 2) continue;
    
    const rowLabel = row[0].trim();
    if (!rowLabel) continue; // 跳过没有标签的行
    
    // 为每个期间/年份创建数据对象
    for (let j = 1; j < Math.min(row.length, headers.length); j++) {
      const period = headers[j];
      if (!period) continue;
      
      // 查找或创建此期间的数据对象
      let periodData = result.find(item => item.period === period);
      if (!periodData) {
        periodData = { period: period };
        result.push(periodData);
      }
      
      // 将指标名称和值添加到期间数据中
      const metricKey = `${currentSection ? currentSection + ' - ' : ''}${rowLabel}`;
      periodData[metricKey] = row[j].trim();
    }
  }
  
  return JSON.stringify(result, null, 2);
}

// 单个标签页数据抓取 - 对应Python的scrape_financials函数的部分功能
async function scrapeTabData(tabName, selector) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 导航到 ${tabName}...`);
      
      // 查找并点击标签页
      const tabElement = document.querySelector(selector);
      
      if (!tabElement) {
        console.log(`⚠️ 未找到标签页: ${tabName}`);
        resolve({ success: false, error: `未找到标签页: ${tabName}` });
        return;
      }
      
      // 滚动到标签页并点击
      tabElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => {
        try {
          tabElement.click();
          console.log(`✅ 成功点击 ${tabName}`);
          
          // 等待表格加载
          setTimeout(() => {
            const table = document.querySelector(FINANCIAL_TABLE_SELECTOR);
            if (!table) {
              console.log(`❌ 未找到表格: ${tabName}`);
              resolve({ success: false, error: `未找到表格: ${tabName}` });
              return;
            }
            
            // 提取表格数据
            const tableData = extractTableData(table);
            console.log(`✅ 成功提取 ${tabName} 数据`);
            
            resolve({
              success: true,
              tabName: tabName,
              data: tableData
            });
          }, 2000);
        } catch (clickError) {
          console.log(`⚠️ 点击失败，尝试直接导航: ${clickError}`);
          
          try {
            // 获取链接的href属性并直接导航
            const href = tabElement.getAttribute('href');
            if (href) {
              // 如果是相对URL，转换为绝对URL
              const absoluteUrl = new URL(href, window.location.origin).href;
              window.location.href = absoluteUrl;
              
              // 等待页面加载
              console.log(`✅ 正在导航到 ${absoluteUrl}`);
              
              // 给足够的时间加载新页面，然后解析表格
              setTimeout(() => {
                const table = document.querySelector(FINANCIAL_TABLE_SELECTOR);
                if (!table) {
                  console.log(`❌ 导航后未找到表格: ${tabName}`);
                  resolve({ success: false, error: `导航后未找到表格: ${tabName}` });
                  return;
                }
                
                // 提取表格数据
                const tableData = extractTableData(table);
                console.log(`✅ 成功提取 ${tabName} 数据`);
                
                resolve({
                  success: true,
                  tabName: tabName,
                  data: tableData
                });
              }, 5000);
            } else {
              throw new Error("链接没有href属性");
            }
          } catch (navError) {
            console.log(`❌ 导航失败: ${navError}`);
            resolve({ success: false, error: `导航失败: ${navError}` });
          }
        }
      }, 1000);
    } catch (error) {
      console.error(`抓取标签页时出错: ${error}`);
      reject(error);
    }
  });
}

// 获取当前页面的标签类型
function getCurrentTabType() {
  // 首先从URL判断
  const currentUrl = window.location.href.toLowerCase();
  
  for (const [urlPattern, tabType] of Object.entries(URL_TO_TAB_TYPE)) {
    if (currentUrl.includes(urlPattern)) {
      return tabType;
    }
  }
  
  // 如果URL不匹配，检查活动的标签
  const activeTab = document.querySelector(".navmenu.submenu li a.active");
  if (activeTab) {
    const href = activeTab.getAttribute('href');
    if (href) {
      for (const [urlPattern, tabType] of Object.entries(URL_TO_TAB_TYPE)) {
        if (href.includes(urlPattern)) {
          return tabType;
        }
      }
      
      // 基于文本内容判断
      if (activeTab.textContent.includes("Income")) return "Income";
      if (activeTab.textContent.includes("Balance")) return "Balance Sheet";
      if (activeTab.textContent.includes("Cash Flow")) return "Cash Flow";
      if (activeTab.textContent.includes("Ratios")) return "Ratios";
    }
  }
  
  // 默认假设是收入表
  return "Income";
}

// 抓取当前页面的所有财务数据 - 对应Python的main函数的部分功能
async function scrapeAllFinancialData(format, isWindows = false) {
  try {
    const results = [];
    const ticker = extractTickerFromPage();
    
    // 先抓取当前页面
    const currentTable = document.querySelector(FINANCIAL_TABLE_SELECTOR);
    if (currentTable) {
      const currentTabType = getCurrentTabType();
      console.log(`✅ 找到当前页面的表格: ${currentTabType}`);
      const currentData = extractTableData(currentTable);
      results.push({
        tabName: currentTabType,
        data: currentData
      });
    } else {
      console.log(`⚠️ 当前页面未找到表格`);
    }
    
    // 依次抓取其他标签页的数据
    for (const [tabName, selector] of Object.entries(TABS)) {
      // 如果已经抓取了当前标签页，跳过
      if (results.some(r => r.tabName === tabName)) {
        console.log(`已经抓取了 ${tabName}，跳过`);
        continue;
      }
      
      const tabResult = await scrapeTabData(tabName, selector);
      if (tabResult.success) {
        results.push({
          tabName: tabResult.tabName,
          data: tabResult.data
        });
      }
    }
    
    if (results.length === 0) {
      return { 
        success: false, 
        error: '未能成功抓取任何数据' 
      };
    }
    
    // 整合所有数据
    const allData = [];
    results.forEach(result => {
      allData.push([`${ticker ? ticker + ' - ' : ''}${result.tabName}`]);
      allData.push([]);  // 空行
      if (result.data && result.data.length > 0) {
        allData.push(...result.data);
      }
      allData.push([]);  // 空行
      allData.push([]);  // 空行
    });
    
    // 转换为请求的格式
    const formattedData = convertDataToFormat(allData, format);
    
    // 生成文件名，并处理Windows兼容性
    let fileName = `${ticker || 'financial_data'}_${formatDate(new Date())}.${formattedData.extension}`;
    
    // 如果是Windows系统，处理文件名
    if (isWindows) {
      fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
    }
    
    return {
      success: true,
      data: formattedData.data,
      mimeType: formattedData.mimeType,
      extension: formattedData.extension,
      fileName: fileName,
      addBOM: formattedData.addBOM
    };
  } catch (error) {
    console.error('抓取数据时出错:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 从页面提取股票代码
function extractTickerFromPage() {
  // 尝试从URL、标题或页面内容中提取股票代码
  
  // 常见金融网站URL模式匹配（适用于Windows和macOS）
  const urlPatterns = [
    // 匹配 /stocks/AAPL/ 或 /stocks/AAPL/financials/ 格式
    /\/stocks\/([A-Z0-9]{1,5})\/?/i,
    // 匹配 /symbol/AAPL 格式
    /\/symbol\/([A-Z0-9]{1,5})\/?/i,
    // 匹配 /quote/AAPL 格式
    /\/quote\/([A-Z0-9]{1,5})\/?/i,
    // 匹配 /companies/AAPL 格式
    /\/companies\/([A-Z0-9]{1,5})\/?/i,
    // 匹配URL中任何位置的股票代码格式（例如股票代码后跟特定参数）
    /[\/=]([A-Z0-9]{1,5})\/financials/i,
    // 匹配URL最后部分的股票代码
    /\/([A-Z0-9]{1,5})$/i
  ];

  const currentUrl = window.location.href;
  
  // 依次尝试所有模式
  for (const pattern of urlPatterns) {
    const match = currentUrl.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  
  // 从页面标题中查找股票代码 - 通常在括号中 如 "Apple Inc. (AAPL)"
  const titlePatterns = [
    /\(([A-Z0-9]{1,5})\)/i,  // 标准括号格式
    /\[([A-Z0-9]{1,5})\]/i,  // 方括号格式
    /：([A-Z0-9]{1,5})/i,    // 中文冒号格式（常见于中文网站）
    /:\s*([A-Z0-9]{1,5})/i   // 英文冒号格式
  ];
  
  for (const pattern of titlePatterns) {
    const match = document.title.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  
  // 尝试从页面内容中查找股票代码
  // 查找常见的页面元素如标题、副标题等
  const headerElements = document.querySelectorAll('h1, h2, .company-title, .ticker-symbol, .stock-symbol');
  for (const element of headerElements) {
    const text = element.textContent || '';
    
    // 尝试找到元素中的股票代码
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }
    
    // 检查是否有单独的股票代码元素
    if (/^[A-Z0-9]{1,5}$/.test(text.trim())) {
      return text.trim().toUpperCase();
    }
  }
  
  // 如果所有方法都失败，返回空字符串或通用名称
  return '';
}

// 格式化日期为YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 抓取当前页面的财务数据 - 对应扩展API的scrapeData
function scrapeFinancialData(dataType, format, isWindows = false) {
  if (dataType === 'all') {
    // 抓取所有标签页的数据
    return scrapeAllFinancialData(format, isWindows);
  } else {
    // 不区分具体类型，直接抓取当前页面数据
    try {
      const table = document.querySelector(FINANCIAL_TABLE_SELECTOR);
      if (!table) {
        return { success: false, error: '未在当前页面找到财务数据表格' };
      }
      
      const ticker = extractTickerFromPage();
      const tableData = extractTableData(table);
      
      // 获取当前标签页类型
      const currentType = getCurrentTabType();
      
      // 标签页类型的中文映射
      const typeNameMap = {
        "Income": "利润表",
        "Balance Sheet": "资产负债表", 
        "Cash Flow": "现金流量表",
        "Ratios": "财务比率"
      };
      
      // 使用中文名称（如果有）
      let tabName = currentType;
      if (typeNameMap[currentType]) {
        tabName = typeNameMap[currentType];
      }
      
      const allData = [
        [`${ticker ? ticker + ' - ' : ''}${tabName}`],
        [],  // 空行
        ...tableData
      ];
      
      // 转换为请求的格式
      const formattedData = convertDataToFormat(allData, format);
      
      // 生成文件名，并处理Windows兼容性
      let fileName = `${ticker || 'financial_data'}_${tabName}_${formatDate(new Date())}.${formattedData.extension}`;
      
      // 如果是Windows系统，处理文件名
      if (isWindows) {
        fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
      }
      
      return {
        success: true,
        data: formattedData.data,
        mimeType: formattedData.mimeType,
        extension: formattedData.extension,
        fileName: fileName,
        addBOM: formattedData.addBOM
      };
    } catch (error) {
      console.error('抓取数据时出错:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 辅助函数 - 下载数据
function downloadData(data, filename, mimeType, addBOM) {
  // 确保文件名对Windows和macOS都有效
  const sanitizedFilename = sanitizeFilename(filename);
  
  // 添加UTF-8 BOM以支持Excel中的中文显示
  let blobData = data;
  if (addBOM) {
    blobData = '\ufeff' + data; // 添加BOM标记
  }
  
  const blob = new Blob([blobData], {type: mimeType || 'text/plain'});
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

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('收到消息:', request.action, request);
  
  // 处理直接下载请求
  if (request.action === 'directDownload') {
    console.log('收到直接下载请求:', request.filename);
    const result = handleDirectDownload(request.data, request.filename, request.mimeType);
    sendResponse({success: result});
    return true;
  }
  
  // 注册批量请求ID
  if (request.action === 'registerRequestId') {
    batchRequestId = request.requestId;
    console.log('注册批量请求ID:', batchRequestId);
    sendResponse({ success: true });
    return true;
  }
  
  // 检查页面是否包含财务数据
  if (request.action === 'checkPage') {
    sendResponse({
      hasFinancialData: hasFinancialData()
    });
  }
  
  // 抓取数据请求
  else if (request.action === 'scrapeData') {
    // 获取Windows标志
    const isWindows = request.isWindows || false;
    const isBatchScrape = request.isBatchScrape || false;
    
    console.log('开始抓取数据, 数据类型:', request.dataType, '批量抓取:', isBatchScrape);
    
    // 确认页面已加载完毕
    if (!document.body || !hasFinancialData()) {
      console.error('页面尚未加载完毕或未找到财务数据');
      
      // 检查是否是重试请求
      if (request.retry) {
        console.log('这是重试请求，但仍未找到财务数据，返回失败');
        sendResponse({
          success: false,
          error: '页面未加载完毕或未找到财务数据'
        });
        return true;
      }
      
      // 对于批量抓取，首次尝试时，可以等待页面加载
      if (isBatchScrape) {
        console.log('批量抓取：等待页面加载后再抓取');
        setTimeout(() => {
          if (!document.body || !hasFinancialData()) {
            console.error('等待后仍未找到财务数据');
            sendResponse({
              success: false,
              error: '等待后页面仍未找到财务数据'
            });
          } else {
            const result = scrapeFinancialData(request.dataType, request.format, isWindows);
            console.log('成功抓取数据:', result);
            sendResponse(result);
          }
        }, 5000);
        return true;
      }
      
      sendResponse({
        success: false,
        error: '页面未加载完毕或未找到财务数据'
      });
      return true;
    }
    
    // 抓取数据 - 仅区分all和非all
    if (request.dataType === 'all') {
      console.log('抓取所有标签页数据开始');
      // 由于是异步操作，先返回正在处理的消息
      scrapeAllFinancialData(request.format, isWindows)
        .then(result => {
          console.log('所有标签页抓取完成，结果:', result);
          console.log('结果数据大小:', result.data ? result.data.length : '无数据');
          
          // 先尝试直接下载数据，作为备份
          if (isBatchScrape && result.success && result.data) {
            console.log('尝试直接从内容脚本下载数据...');
            handleDirectDownload(
              result.addBOM ? '\ufeff' + result.data : result.data,
              result.fileName,
              result.mimeType
            );
          }
          
          // 批量抓取情况下直接回复结果
          if (isBatchScrape) {
            try {
              console.log('尝试通过sendResponse发送结果...');
              sendResponse(result);
            } catch (e) {
              console.error('回复批量抓取结果出错，将通过消息传递:', e);
              
              // 创建一个安全的消息对象，确保可以被序列化
              const safeResult = {
                success: result.success,
                error: result.error,
                fileName: result.fileName,
                extension: result.extension,
                mimeType: result.mimeType,
                addBOM: result.addBOM
              };
              
              // 如果有数据，单独处理以避免日志中的大量输出
              if (result.data) {
                safeResult.data = result.data;
                safeResult.hasData = true;
                console.log(`数据长度: ${result.data.length} 字符`);
              } else {
                safeResult.hasData = false;
                console.log('没有数据');
              }
              
              // 尝试通过消息传递
              console.log('发送异步结果到后台脚本，请求ID:', batchRequestId);
              chrome.runtime.sendMessage({
                action: 'scrapeDataResult',
                result: safeResult,
                isBackgroundMessage: true,  // 标记为后台消息
                requestId: batchRequestId,  // 包含请求ID以便正确识别
                timestamp: Date.now()       // 添加时间戳以便跟踪
              }, function(response) {
                if (chrome.runtime.lastError) {
                  console.error('发送异步错误结果失败:', chrome.runtime.lastError);
                }
              });
              
              // 为确保消息被发送，添加一个直接下载的备份方法
              if (result.data) {
                console.log('尝试直接从内容脚本下载数据...');
                try {
                  // 创建一个临时链接并点击它来下载文件
                  const blob = new Blob([result.data], {type: result.mimeType || 'text/plain'});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = result.fileName || 'financial_data.csv';
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 100);
                } catch (downloadError) {
                  console.error('直接下载也失败:', downloadError);
                }
              }
            }
          } else {
            // 正常情况使用chrome.runtime.sendMessage发送结果到popup.js
            console.log('向popup发送抓取结果');
            chrome.runtime.sendMessage({
              action: 'scrapeDataResult',
              result: result,
              tabId: chrome.devtools ? chrome.devtools.inspectedWindow.tabId : null  // 添加标签页ID以避免收到自己的消息
            });
          }
        })
        .catch(error => {
          console.error('抓取所有标签页时出错:', error);
          const errorResult = {
            success: false,
            error: error.message || '抓取过程中出错'
          };
          
          if (isBatchScrape) {
            try {
              sendResponse(errorResult);
            } catch (e) {
              chrome.runtime.sendMessage({
                action: 'scrapeDataResult',
                result: errorResult,
                isBackgroundMessage: true,  // 标记为后台消息
                requestId: batchRequestId,  // 包含请求ID以便正确识别
                timestamp: Date.now()       // 添加时间戳以便跟踪
              }, function(response) {
                if (chrome.runtime.lastError) {
                  console.error('发送异步错误结果失败:', chrome.runtime.lastError);
                }
              });
            }
          } else {
            chrome.runtime.sendMessage({
              action: 'scrapeDataResult',
              result: errorResult,
              tabId: chrome.devtools ? chrome.devtools.inspectedWindow.tabId : null  // 添加标签页ID以避免收到自己的消息
            });
          }
        });
      
      // 告诉popup我们会异步响应
      sendResponse({ processing: true });
    } else {
      // 所有非all选项，统一抓取当前页面
      console.log('抓取当前页面数据');
      const result = scrapeFinancialData(request.dataType, request.format, isWindows);
      console.log('抓取结果:', result);
      sendResponse(result);
    }
  }
  
  // 返回true表示我们将异步发送响应
  return true;
}); 