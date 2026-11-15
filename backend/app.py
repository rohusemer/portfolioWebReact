"""API Flask heredada. El sitio en producción no la usa (todo corre sobre Firebase),
pero si se vuelve a desplegar, solo acepta peticiones de los dominios del portafolio."""

import os

from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# CORS restringido: solo los orígenes del portafolio (y localhost en desarrollo).
# Se puede ampliar con la variable de entorno ALLOWED_ORIGINS="https://a.com,https://b.com".
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://portfoliowebsite-ccc81.web.app,https://portfoliowebsite-ccc81.firebaseapp.com,http://localhost:4321",
).split(",")
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=False, methods=["GET"])


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.route("/")
def home():
    return {"message": "Hola desde el Backend de Flask!"}


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
