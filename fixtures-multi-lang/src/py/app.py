"""fixtures-multi-lang/src/py/app.py"""
from fastapi import FastAPI
from typing import List

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"id": item_id}

class User:
    pass

def helper():
    pass

__all__ = ["User", "helper"]
