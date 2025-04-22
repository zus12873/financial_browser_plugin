// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const analyzeBtn = document.getElementById('analyzeBtn');
    const viewDataBtn = document.getElementById('viewDataBtn');
    const promptInput = document.getElementById('promptInput');
    const loadingBox = document.getElementById('loadingBox');
    const resultBox = document.getElementById('resultBox');
    const analysisResult = document.getElementById('analysisResult');
    const dataTableBox = document.getElementById('dataTableBox');
    const dataTable = document.getElementById('dataTable');
    const errorBox = document.getElementById('errorBox');
    const errorMessage = document.getElementById('errorMessage');
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const fileSelect = document.getElementById('fileSelect');
    const uploadFeedback = document.getElementById('uploadFeedback');
    
    // 当页面加载时获取文件列表
    fetchFilesList();
    
    // 文件上传表单提交事件
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
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
        fetch('/api/upload', {
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
    });
    
    // 获取已上传文件列表
    function fetchFilesList() {
        fetch('/api/files')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 清空当前选项（除了默认选项）
                while (fileSelect.options.length > 1) {
                    fileSelect.remove(1);
                }
                
                // 添加文件选项
                data.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.name;
                    option.textContent = `${file.name} (${formatFileSize(file.size)})`;
                    fileSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('获取文件列表失败:', error);
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

    // 分析按钮点击事件
    analyzeBtn.addEventListener('click', function() {
        // 显示加载动画
        loadingBox.classList.remove('d-none');
        // 隐藏结果和错误信息
        resultBox.classList.add('d-none');
        errorBox.classList.add('d-none');
        
        // 获取用户输入的提示
        const prompt = promptInput.value.trim();
        
        // 获取选择的文件名
        const selectedFile = fileSelect.value;
        
        // 调用API分析数据
        fetch('/api/analyze', {
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
    });

    // 查看数据按钮点击事件
    viewDataBtn.addEventListener('click', function() {
        // 显示加载动画
        loadingBox.classList.remove('d-none');
        // 隐藏错误信息
        errorBox.classList.add('d-none');
        
        // 获取选择的文件名
        const selectedFile = fileSelect.value;
        
        // 构建URL
        let url = '/api/data';
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
                generateTable(data.data);
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
    });

    // 格式化分析结果（将换行符转换为HTML）
    function formatAnalysisResult(text) {
        // 使用正则表达式替换所有换行符为<br>标签
        return text.replace(/\n/g, '<br>');
    }

    // 生成表格
    function generateTable(data) {
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
}); 