from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routes.auth import router as auth_router
from routes.session import router as sessions_router
from routes.stats import router as stats_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("PosturePal backend starting...")
    yield
    print("PosturePal backend stopped")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://localhost:8080"],
    allow_methods     = ["*"],
    allow_headers     = ["*"],
    allow_credentials = True
)

# Register auth router
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(stats_router)


@app.get("/")
def home():
    return {
        "data" : "welcome to home page"
    }
@app.get("/health")
def health():
    return {
        "status": "running",
        "app"   : "PosturePal"
    }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)