// 下载模态窗口管理
class DownloadModal {
  constructor() {
    this.initialized = false;
    this.overlay = null;
    this.modal = null;
    this.closeBtn = null;
    this.downloadBtn = null;
    this.cancelBtn = null;
    this.filenameEl = null;
    this.fileSizeEl = null;
    this.fileTypeEl = null;
    
    // 当前下载数据
    this.currentDownload = {
      data: null,
      filename: '',
      mimeType: ''
    };
    
    // 绑定方法的this
    this.init = this.init.bind(this);
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
    this.handleDownload = this.handleDownload.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }
  
  // 初始化模态窗口
  init() {
    if (this.initialized) return;
    
    // 创建模态窗口结构
    this.overlay = document.createElement('div');
    this.overlay.className = 'download-modal-overlay';
    
    this.modal = document.createElement('div');
    this.modal.className = 'download-modal';
    
    // 创建模态窗口头部
    const header = document.createElement('div');
    header.className = 'download-modal-header';
    
    const title = document.createElement('h3');
    title.className = 'download-modal-title';
    title.textContent = '下载文件';
    
    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'download-modal-close';
    this.closeBtn.innerHTML = '&times;';
    this.closeBtn.setAttribute('aria-label', '关闭');
    
    header.appendChild(title);
    header.appendChild(this.closeBtn);
    
    // 创建模态窗口内容
    const content = document.createElement('div');
    content.className = 'download-modal-content';
    
    const info = document.createElement('div');
    info.className = 'download-info';
    
    const filenameP = document.createElement('p');
    filenameP.innerHTML = '<strong>文件名: </strong><span id="download-filename"></span>';
    this.filenameEl = filenameP.querySelector('#download-filename');
    
    const fileSizeP = document.createElement('p');
    fileSizeP.innerHTML = '<strong>文件大小: </strong><span id="download-filesize"></span>';
    this.fileSizeEl = fileSizeP.querySelector('#download-filesize');
    
    const fileTypeP = document.createElement('p');
    fileTypeP.innerHTML = '<strong>文件类型: </strong><span id="download-filetype"></span>';
    this.fileTypeEl = fileTypeP.querySelector('#download-filetype');
    
    info.appendChild(filenameP);
    info.appendChild(fileSizeP);
    info.appendChild(fileTypeP);
    
    const message = document.createElement('p');
    message.textContent = '您的数据已准备好下载。点击下载按钮以保存文件。';
    
    content.appendChild(info);
    content.appendChild(message);
    
    // 创建模态窗口按钮
    const actions = document.createElement('div');
    actions.className = 'download-actions';
    
    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = 'download-btn download-btn-secondary';
    this.cancelBtn.textContent = '取消';
    
    this.downloadBtn = document.createElement('button');
    this.downloadBtn.className = 'download-btn download-btn-primary pulse';
    this.downloadBtn.textContent = '下载文件';
    
    actions.appendChild(this.cancelBtn);
    actions.appendChild(this.downloadBtn);
    
    // 组装模态窗口
    this.modal.appendChild(header);
    this.modal.appendChild(content);
    this.modal.appendChild(actions);
    
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
    
    // 添加事件监听
    this.closeBtn.addEventListener('click', this.hide);
    this.cancelBtn.addEventListener('click', this.hide);
    this.downloadBtn.addEventListener('click', this.handleDownload);
    document.addEventListener('keydown', this.handleKeyDown);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    
    this.initialized = true;
  }
  
  // 显示模态窗口
  show(data, filename, mimeType) {
    if (!this.initialized) this.init();
    
    // 存储当前下载数据
    this.currentDownload = {
      data,
      filename: filename || 'financial_data.csv',
      mimeType: mimeType || 'text/csv'
    };
    
    // 更新弹窗信息
    this.filenameEl.textContent = this.currentDownload.filename;
    this.fileSizeEl.textContent = this.getFileSize(data);
    this.fileTypeEl.textContent = this.getFileType(mimeType, filename);
    
    // 显示弹窗
    this.overlay.classList.add('active');
    this.downloadBtn.focus();
  }
  
  // 隐藏模态窗口
  hide() {
    if (!this.initialized) return;
    this.overlay.classList.remove('active');
  }
  
  // 处理下载
  handleDownload() {
    if (!this.currentDownload.data) return;
    
    try {
      // 使用chrome下载API
      const blob = new Blob([this.currentDownload.data], {type: this.currentDownload.mimeType});
      const dataUrl = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: dataUrl,
        filename: this.currentDownload.filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError || downloadId === undefined) {
          console.error('下载出错:', chrome.runtime.lastError);
          this.fallbackDownload();
        } else {
          setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
          this.hide();
        }
      });
    } catch (error) {
      console.error('下载处理出错:', error);
      this.fallbackDownload();
    }
  }
  
  // 备用下载方法
  fallbackDownload() {
    try {
      const blob = new Blob([this.currentDownload.data], {type: this.currentDownload.mimeType});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.currentDownload.filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      this.hide();
    } catch (error) {
      console.error('备用下载也失败:', error);
      alert('下载失败，请稍后重试');
    }
  }
  
  // 处理键盘事件
  handleKeyDown(e) {
    if (!this.overlay.classList.contains('active')) return;
    
    if (e.key === 'Escape') {
      this.hide();
    } else if (e.key === 'Enter' && document.activeElement === this.downloadBtn) {
      this.handleDownload();
    }
  }
  
  // 获取文件大小
  getFileSize(data) {
    if (!data) return '未知';
    const bytes = new Blob([data]).size;
    
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  
  // 获取文件类型描述
  getFileType(mimeType, filename) {
    if (!mimeType && !filename) return '未知';
    
    if (mimeType) {
      switch (mimeType) {
        case 'text/csv': return 'CSV表格文件';
        case 'application/json': return 'JSON数据文件';
        default: return mimeType;
      }
    }
    
    if (filename) {
      const ext = filename.split('.').pop().toLowerCase();
      switch (ext) {
        case 'csv': return 'CSV表格文件';
        case 'json': return 'JSON数据文件';
        default: return ext.toUpperCase() + '文件';
      }
    }
    
    return '未知';
  }
}

// 创建全局实例
window.downloadModal = new DownloadModal(); 