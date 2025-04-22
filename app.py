from flask import Flask, render_template, request, jsonify, send_from_directory
from openai import OpenAI
import dotenv
import pandas as pd
from flask_cors import CORS
import os
import json
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
# 配置上传文件夹
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 限制16MB

# 确保上传文件夹存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 加载环境变量
dotenv.load_dotenv()

# 检查文件扩展名是否允许
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 读取CSV文件
def load_csv_data(file_path=None):
    try:
        if file_path and os.path.exists(file_path):
            return pd.read_csv(file_path)
        # 默认文件
        default_file = "example.csv"
        if os.path.exists(default_file):
            return pd.read_csv(default_file)
        # 检查上传目录
        uploaded_files = os.listdir(UPLOAD_FOLDER)
        if uploaded_files:
            # 使用最新上传的文件
            latest_file = sorted(uploaded_files, key=lambda x: os.path.getmtime(os.path.join(UPLOAD_FOLDER, x)), reverse=True)[0]
            return pd.read_csv(os.path.join(UPLOAD_FOLDER, latest_file))
        return "找不到CSV文件"
    except Exception as e:
        return str(e)

# 初始化API客户端
def get_api_client():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URI")
    
    if not api_key or not base_url:
        return None, "API配置缺失"
    
    try:
        return OpenAI(api_key=api_key, base_url=base_url), None
    except Exception as e:
        return None, str(e)

# 首页路由
@app.route('/')
def index():
    return render_template('index.html')

# 文件上传路由
@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        file = request.files['file']
        
        # 检查文件名是否为空
        if file.filename == '':
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        # 检查文件类型
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': '不支持的文件类型，仅支持CSV文件'}), 400
        
        # 保存文件
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # 尝试读取文件验证格式
        csv_data = load_csv_data(file_path)
        if isinstance(csv_data, str):
            # 删除无效文件
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'success': False, 'error': f'无法解析CSV文件: {csv_data}'}), 400
        
        return jsonify({
            'success': True, 
            'message': '文件上传成功',
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API路由 - 获取CSV数据
@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        # 从请求参数获取文件名（如果有）
        filename = request.args.get('filename')
        file_path = None
        
        if filename:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        
        csv_data = load_csv_data(file_path)
        if isinstance(csv_data, str):
            return jsonify({"success": False, "error": csv_data}), 500
        
        # 将DataFrame转换为JSON格式
        csv_json = csv_data.to_json(orient='records')
        return jsonify({"success": True, "data": json.loads(csv_json)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# API路由 - 获取已上传文件列表
@app.route('/api/files', methods=['GET'])
def get_files():
    app.logger.debug(">>> 收到 /api/files 请求, headers: %s", dict(request.headers))
    try:
        # 获取上传目录中的所有文件
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for filename in os.listdir(UPLOAD_FOLDER):
                if allowed_file(filename):
                    file_path = os.path.join(UPLOAD_FOLDER, filename)
                    files.append({
                        'name': filename,
                        'size': os.path.getsize(file_path),
                        'modified': os.path.getmtime(file_path)
                    })
        
        # 按修改时间排序（最新的在前）
        files.sort(key=lambda x: x['modified'], reverse=True)
        
        return jsonify({"success": True, "files": files})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# API路由 - 分析数据
@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    try:
        # 获取用户输入的提示（如果有）
        user_prompt = request.json.get('prompt', '')
        
        # 获取文件名（如果有）
        filename = request.json.get('filename')
        file_path = None
        
        if filename:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        
        # 加载CSV数据
        csv_data = load_csv_data(file_path)
        if isinstance(csv_data, str):
            return jsonify({"success": False, "error": csv_data}), 500
        
        # 获取API客户端
        client, error = get_api_client()
        if error:
            return jsonify({"success": False, "error": error}), 500
        
        # 系统提示
        system_prompt = "You are a financial analyst, you are given a csv file, you need to analyze the csv file, and give me the result in chinese."
        
        # 用户提示
        if not user_prompt:
            user_prompt = f"Here is the csv file: {csv_data}"
        else:
            user_prompt = f"{user_prompt}\n\nHere is the csv file: {csv_data}"
        
        # 调用API
        completion = client.chat.completions.create(
            model="deepseek-reasoner",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=False
        )
        
        # 返回分析结果
        return jsonify({
            "success": True, 
            "analysis": completion.choices[0].message.content
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # host='0.0.0.0' 确保任何本机来源都能连上
    app.run(host='0.0.0.0', port=5000, debug=True)