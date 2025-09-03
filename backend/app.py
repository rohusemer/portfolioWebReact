
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Esto permite que el frontend se comunique con el backend

@app.route("/")
def home():
    return {"message": "Hola desde el Backend de Flask!"}

if __name__ == "__main__":
    app.run(debug=True)
