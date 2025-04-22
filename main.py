from openai import OpenAI
import dotenv
import pandas as pd
import os
csv_file=pd.read_csv("GM_利润表_2025-04-22.csv")
dotenv.load_dotenv()
# api_key = os.getenv("OPENAI_API_KEY")
# base_url = os.getenv("OPENAI_BASE_URI")
api_key=os.getenv("DEEPSEEK_API_KEY")
base_url=os.getenv("DEEPSEEK_BASE_URI")
print(api_key, base_url)
client = OpenAI(api_key=api_key, base_url=base_url)
# file_path = "GM_利润表_2025-04-22.csv"
# file = client.files.create(
#     file=open(file_path, "rb"),
#     purpose="user_data"
# )

completion = client.chat.completions.create(
    model="deepseek-reasoner",
        messages=[
        {"role": "system", "content": "You are a financial analyst, you are given a csv file, you need to analyze the csv file, and give me the result in chinese."},
        {"role": "user", "content": f"Here is the csv file: {csv_file}"},
    ],
    stream=False

    
)

print(completion.choices[0].message.content)