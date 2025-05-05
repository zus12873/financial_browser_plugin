// scripts/index.js

const BASE = 'http://127.0.0.1:5050';

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素
  const uploadForm     = document.getElementById('uploadForm');
  const fileInput      = document.getElementById('fileInput');
  const fileSelect     = document.getElementById('fileSelect');
  const uploadFeedback = document.getElementById('uploadFeedback');
  
  const analyzeBtn     = document.getElementById('analyzeBtn');
  const viewDataBtn    = document.getElementById('viewDataBtn');
  const promptInput    = document.getElementById('promptInput');
  const loadingBox     = document.getElementById('loadingBox');
  const resultBox      = document.getElementById('resultBox');
  const analysisResult = document.getElementById('analysisResult');
  const dataTableBox   = document.getElementById('dataTableBox');
  const dataTable      = document.getElementById('dataTable');
  const errorBox       = document.getElementById('errorBox');
  const errorMessage   = document.getElementById('errorMessage');

  // 页面加载时：获取文件列表
  fetchFilesList();

  // —— 文件上传 —— 
  uploadForm.addEventListener('submit', e => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
      showFeedback('请选择要上传的文件', 'warning');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showFeedback('只支持 CSV 文件', 'warning');
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      showFeedback('文件大小不能超过 16MB', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    showFeedback('文件上传中...', 'info');

    fetch(`${BASE}/api/upload`, {
      method: 'POST',
      mode: 'cors',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showFeedback(`文件 ${data.filename} 上传成功`, 'success');
        fileInput.value = '';
        fetchFilesList();
      } else {
        showFeedback(`上传失败: ${data.error}`, 'danger');
      }
    })
    .catch(err => {
      showFeedback(`上传失败: ${err.message}`, 'danger');
    });
  });

  // —— 数据分析 —— 
  analyzeBtn.addEventListener('click', () => {
    loadingBox.classList.remove('d-none');
    resultBox.classList.add('d-none');
    errorBox.classList.add('d-none');

    const prompt   = promptInput.value.trim();
    const filename = fileSelect.value;

    fetch(`${BASE}/api/analyze`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, filename })
    })
    .then(res => res.json())
    .then(data => {
      loadingBox.classList.add('d-none');
      if (data.success) {
        analysisResult.innerHTML = formatAnalysisResult(data.analysis);
        resultBox.classList.remove('d-none');
      } else {
        errorMessage.textContent = data.error || '服务器处理请求时发生错误';
        errorBox.classList.remove('d-none');
      }
    })
    .catch(err => {
      loadingBox.classList.add('d-none');
      errorMessage.textContent = '网络请求失败: ' + err.message;
      errorBox.classList.remove('d-none');
    });
  });

  // —— 查看原始数据 —— 
  viewDataBtn.addEventListener('click', () => {
    loadingBox.classList.remove('d-none');
    errorBox.classList.add('d-none');

    let url = `${BASE}/api/data`;
    const selectedFile = fileSelect.value;
    if (selectedFile) {
      url += `?filename=${encodeURIComponent(selectedFile)}`;
    }

    fetch(url, { method: 'GET', mode: 'cors' })
    .then(res => res.json())
    .then(data => {
      loadingBox.classList.add('d-none');
      if (data.success) {
        generateTable(data.data);
        dataTableBox.classList.remove('d-none');
      } else {
        errorMessage.textContent = data.error || '获取数据失败';
        errorBox.classList.remove('d-none');
      }
    })
    .catch(err => {
      loadingBox.classList.add('d-none');
      errorMessage.textContent = '网络请求失败: ' + err.message;
      errorBox.classList.remove('d-none');
    });
  });

  // —— Helpers —— 
  function fetchFilesList() {
    fetch(`${BASE}/api/files`, {
      method: 'GET',
      mode: 'cors'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        updateFileSelect(data.files);
      } else {
        console.error('文件列表接口返回错误:', data.error);
      }
    })
    .catch(err => {
      console.error('获取文件列表失败:', err);
    });
  }

  function updateFileSelect(files) {
    // 清除除“使用默认文件”以外的选项
    while (fileSelect.options.length > 1) {
      fileSelect.remove(1);
    }
    files.forEach(file => {
      const opt = document.createElement('option');
      opt.value = file.name;
      opt.textContent = `${file.name} (${formatFileSize(file.size)})`;
      fileSelect.appendChild(opt);
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatAnalysisResult(markdownText) {
    // 先用 marked 转成 HTML，再用 DOMPurify 清洗
    const rawHtml = marked.parse(markdownText);
    return DOMPurify.sanitize(rawHtml);
  }
  

  function generateTable(data) {
    dataTable.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
      dataTable.innerHTML = '<tr><td>无数据</td></tr>';
      return;
    }
    // 表头
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    Object.keys(data[0]).forEach(key => {
      const th = document.createElement('th');
      th.textContent = key;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    dataTable.appendChild(thead);
    // 表体
    const tbody = document.createElement('tbody');
    data.forEach(rowData => {
      const tr = document.createElement('tr');
      Object.values(rowData).forEach(val => {
        const td = document.createElement('td');
        td.textContent = val != null ? val : '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    dataTable.appendChild(tbody);
  }

  function showFeedback(msg, type) {
    uploadFeedback.textContent = msg;
    uploadFeedback.className = `alert alert-${type} mb-4`;
    uploadFeedback.classList.remove('d-none');
    if (type === 'info' || type === 'success') {
      setTimeout(() => uploadFeedback.classList.add('d-none'), 5000);
    }
  }
});