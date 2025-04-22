# GM财务数据分析平台

这是一个基于Flask的Web应用，用于分析GM公司的财务数据。该应用使用DeepSeek API进行智能分析，提供财务数据的可视化和分析结果。

## 功能特点

- 通过Web界面查看GM公司的财务数据
- 支持CSV文件上传和管理
- 使用AI进行智能数据分析
- 支持自定义分析提示
- 响应式设计，适配各种设备

## 环境要求

- Python 3.8+
- 安装requirements.txt中列出的依赖库

## 安装步骤

1. 克隆或下载项目代码
2. 创建并激活虚拟环境(可选但推荐)：
   ```
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate  # Windows
   ```
3. 安装依赖：
   ```
   pip install -r requirements.txt
   ```
4. 创建.env文件，配置以下环境变量：
   ```
   DEEPSEEK_API_KEY=your_api_key_here
   DEEPSEEK_BASE_URI=your_base_uri_here
   ```
5. 确保uploads目录存在:
   ```
   mkdir -p uploads
   ```

## 运行应用

执行以下命令启动应用：
```
python app.py
```

然后在浏览器中访问：`http://127.0.0.1:5000/`

## 使用说明

1. 上传CSV文件或使用默认文件
   - 点击"选择文件"，然后点击"上传"按钮上传CSV文件
   - 从下拉菜单中选择一个已上传的文件
   - 如不选择文件，则使用默认文件
2. 在分析控制面板输入自定义分析提示（可选）
3. 点击"分析数据"按钮进行AI分析
4. 点击"查看原始数据"查看CSV数据表格
5. 分析结果将显示在页面下方

## 文件上传规则

- 仅支持CSV格式的文件
- 最大文件大小限制为16MB
- 上传的文件将保存在服务器的uploads目录中

## 文件结构

- `app.py`: Flask应用主文件
- `templates/index.html`: 前端界面模板
- `static/css/style.css`: CSS样式文件
- `static/js/script.js`: JavaScript交互脚本
- `GM_利润表_2025-04-22.csv`: 默认财务数据文件
- `uploads/`: 用户上传文件存储目录
- `requirements.txt`: 项目依赖列表 