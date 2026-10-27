import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / ".env")

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "sevencore-conversa-dev-fallback-key-replace-in-prod")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",")
    if host.strip()
]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "rest_framework",
    "corsheaders",
    # Sevencore Conversa modular apps
    "apps.accounts",
    "apps.organizations",
    "apps.agents",
    "apps.knowledge_base",
    "apps.contacts",
    "apps.campaigns",
    "apps.calls",
    "apps.analytics",
    "apps.meetings",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database: PostgreSQL with SQLite fallback for isolated local development
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization & Indian timezone
LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # Controlled per-viewset
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DATETIME_FORMAT": "%Y-%m-%d %H:%M:%S",
}

# CORS settings
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

# ==============================================================================
# Sarvam AI Voice Agents Settings
# ==============================================================================
SARVAM_USE_MOCK = os.getenv("SARVAM_USE_MOCK", "True").lower() in ("true", "1", "yes")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_API_BASE_URL = os.getenv("SARVAM_API_BASE_URL", "https://apps.sarvam.ai")
SARVAM_ORG_ID = os.getenv("SARVAM_ORG_ID", "")
SARVAM_WORKSPACE_ID = os.getenv("SARVAM_WORKSPACE_ID", "")
SARVAM_CONNECTION_ID = os.getenv("SARVAM_CONNECTION_ID", "")
SARVAM_AGENT_PHONE_NUMBER = os.getenv("SARVAM_AGENT_PHONE_NUMBER", "")
SARVAM_DEFAULT_APP_ID = os.getenv("SARVAM_DEFAULT_APP_ID", "")
SARVAM_DEFAULT_APP_VERSION = int(os.getenv("SARVAM_DEFAULT_APP_VERSION", "1"))
SARVAM_WEBHOOK_SECRET = os.getenv("SARVAM_WEBHOOK_SECRET", "")

# Telephony Cost Constants (Sarvam Published INR rates)
SARVAM_PAYG_RATE_PER_MIN_INR = 3.50  # ₹3.50/min
SARVAM_BUSINESS_RATE_PER_MIN_INR = 3.00

# Indian Telecom Compliance Rules
CALLING_WINDOW_START_HOUR = int(os.getenv("CALLING_WINDOW_START_HOUR", "9"))   # 09:00 IST
CALLING_WINDOW_END_HOUR = int(os.getenv("CALLING_WINDOW_END_HOUR", "20"))      # 20:00 IST
MAX_CALLS_PER_SECOND = int(os.getenv("MAX_CALLS_PER_SECOND", "2"))
DEFAULT_MAX_RETRIES = int(os.getenv("DEFAULT_MAX_RETRIES", "2"))
