from fastapi import FastAPI

app = FastAPI(title='Life Debug', version='0.1.0')

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'life-debug'}
