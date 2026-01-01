#!/usr/bin/env python3
"""
TinyProxy 代理测试脚本
测试代理服务器是否正常工作
"""

import requests
import time

PROXY_HOST = "115.190.229.8"
PROXY_PORT = 8888
PROXY_URL = f"http://{PROXY_HOST}:{PROXY_PORT}"

proxies = {
    "http": PROXY_URL,
    "https": PROXY_URL
}

def test_proxy():
    """测试代理连接"""
    print("=" * 50)
    print("  TinyProxy 代理测试")
    print("=" * 50)
    print(f"\n代理地址: {PROXY_URL}\n")
    
    # 测试 1: 获取出口 IP
    print("[TEST 1] 获取出口 IP...")
    try:
        start = time.time()
        response = requests.get(
            "http://httpbin.org/ip",
            proxies=proxies,
            timeout=30
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] 出口 IP: {data.get('origin', 'unknown')}")
            print(f"  [OK] 响应时间: {elapsed:.2f}s")
        else:
            print(f"  [FAIL] HTTP {response.status_code}")
    except Exception as e:
        print(f"  [ERROR] {e}")
    
    print()
    
    # 测试 2: 请求普通网页
    print("[TEST 2] 请求百度首页...")
    try:
        start = time.time()
        response = requests.get(
            "http://www.baidu.com",
            proxies=proxies,
            timeout=30
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            print(f"  [OK] 状态码: {response.status_code}")
            print(f"  [OK] 内容长度: {len(response.content)} bytes")
            print(f"  [OK] 响应时间: {elapsed:.2f}s")
        else:
            print(f"  [FAIL] HTTP {response.status_code}")
    except Exception as e:
        print(f"  [ERROR] {e}")
    
    print()
    
    # 测试 3: HTTPS 请求
    print("[TEST 3] HTTPS 请求 (通过 CONNECT)...")
    try:
        start = time.time()
        response = requests.get(
            "https://httpbin.org/headers",
            proxies=proxies,
            timeout=30
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            print(f"  [OK] HTTPS 代理正常")
            print(f"  [OK] 响应时间: {elapsed:.2f}s")
        else:
            print(f"  [FAIL] HTTP {response.status_code}")
    except Exception as e:
        print(f"  [ERROR] {e}")
    
    print()
    print("=" * 50)
    print("  测试完成")
    print("=" * 50)

if __name__ == "__main__":
    test_proxy()

