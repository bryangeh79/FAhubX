#!/usr/bin/env python3
"""
Facebook Auto Bot 负载测试脚本
使用 Locust 进行系统压力测试
"""

from locust import HttpUser, task, between, TaskSet, events
import json
import random
import time
from datetime import datetime

# 测试配置
BASE_URL = "http://localhost:3000"
TEST_USERS = [
    {"email": f"test_user_{i}@example.com", "password": "test123"}
    for i in range(1, 11)
]

class AuthTaskSet(TaskSet):
    """认证相关任务"""
    
    def on_start(self):
        """每个虚拟用户开始时执行"""
        self.token = None
        self.user_data = random.choice(TEST_USERS)
        self.login()
    
    def login(self):
        """用户登录"""
        headers = {"Content-Type": "application/json"}
        data = {
            "email": self.user_data["email"],
            "password": self.user_data["password"]
        }
        
        with self.client.post(
            f"{BASE_URL}/api/auth/login",
            json=data,
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                result = response.json()
                self.token = result.get("access_token")
                response.success()
                print(f"✅ 用户 {self.user_data['email']} 登录成功")
            else:
                response.failure(f"登录失败: {response.status_code}")
                print(f"❌ 用户 {self.user_data['email']} 登录失败")
    
    @task(3)
    def get_user_profile(self):
        """获取用户信息"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        with self.client.get(
            f"{BASE_URL}/api/users/me",
            headers=headers,
            name="/api/users/me",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"获取用户信息失败: {response.status_code}")

class AccountTaskSet(TaskSet):
    """账号管理任务"""
    
    def __init__(self, parent):
        super().__init__(parent)
        self.account_ids = []
    
    @task(5)
    def list_accounts(self):
        """获取账号列表"""
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        with self.client.get(
            f"{BASE_URL}/api/accounts",
            headers=headers,
            name="/api/accounts",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if "data" in data and isinstance(data["data"], list):
                    self.account_ids = [acc["id"] for acc in data["data"][:5]]
                response.success()
            else:
                response.failure(f"获取账号列表失败: {response.status_code}")
    
    @task(2)
    def create_account(self):
        """创建测试账号"""
        if not self.parent.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        account_data = {
            "username": f"test_account_{int(time.time())}_{random.randint(1000, 9999)}",
            "email": f"fb_test_{int(time.time())}@example.com",
            "password": "test123456",
            "status": "active",
            "notes": "测试账号 - 负载测试创建"
        }
        
        with self.client.post(
            f"{BASE_URL}/api/accounts",
            json=account_data,
            headers=headers,
            name="/api/accounts [POST]",
            catch_response=True
        ) as response:
            if response.status_code == 201:
                data = response.json()
                if "id" in data:
                    self.account_ids.append(data["id"])
                response.success()
            else:
                response.failure(f"创建账号失败: {response.status_code}")
    
    @task(1)
    def update_account(self):
        """更新账号信息"""
        if not self.account_ids:
            return
        
        account_id = random.choice(self.account_ids)
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        update_data = {
            "status": random.choice(["active", "paused", "maintenance"]),
            "notes": f"更新于 {datetime.now().isoformat()}"
        }
        
        with self.client.patch(
            f"{BASE_URL}/api/accounts/{account_id}",
            json=update_data,
            headers=headers,
            name="/api/accounts/[id] [PATCH]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"更新账号失败: {response.status_code}")

class TaskTaskSet(TaskSet):
    """任务管理任务"""
    
    def __init__(self, parent):
        super().__init__(parent)
        self.task_ids = []
    
    @task(4)
    def list_tasks(self):
        """获取任务列表"""
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        with self.client.get(
            f"{BASE_URL}/api/tasks",
            headers=headers,
            name="/api/tasks",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if "data" in data and isinstance(data["data"], list):
                    self.task_ids = [task["id"] for task in data["data"][:5]]
                response.success()
            else:
                response.failure(f"获取任务列表失败: {response.status_code}")
    
    @task(2)
    def create_task(self):
        """创建测试任务"""
        if not self.parent.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        task_data = {
            "name": f"负载测试任务_{int(time.time())}",
            "type": random.choice(["message", "post", "like", "comment"]),
            "schedule": random.choice(["immediate", "daily", "weekly"]),
            "target_accounts": [1, 2, 3] if random.random() > 0.5 else [1],
            "content": "这是一个负载测试创建的任务",
            "priority": random.choice(["low", "medium", "high"]),
            "status": "pending"
        }
        
        with self.client.post(
            f"{BASE_URL}/api/tasks",
            json=task_data,
            headers=headers,
            name="/api/tasks [POST]",
            catch_response=True
        ) as response:
            if response.status_code == 201:
                data = response.json()
                if "id" in data:
                    self.task_ids.append(data["id"])
                response.success()
            else:
                response.failure(f"创建任务失败: {response.status_code}")
    
    @task(1)
    def execute_task(self):
        """执行任务"""
        if not self.task_ids:
            return
        
        task_id = random.choice(self.task_ids)
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        with self.client.post(
            f"{BASE_URL}/api/tasks/{task_id}/execute",
            headers=headers,
            name="/api/tasks/[id]/execute [POST]",
            catch_response=True
        ) as response:
            if response.status_code in [200, 202]:
                response.success()
            else:
                response.failure(f"执行任务失败: {response.status_code}")

class SystemTaskSet(TaskSet):
    """系统监控任务"""
    
    @task(10)
    def get_system_status(self):
        """获取系统状态"""
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        with self.client.get(
            f"{BASE_URL}/api/system/status",
            headers=headers,
            name="/api/system/status",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"获取系统状态失败: {response.status_code}")
    
    @task(5)
    def get_metrics(self):
        """获取性能指标"""
        headers = {
            "Authorization": f"Bearer {self.parent.token}",
            "Content-Type": "application/json"
        }
        
        with self.client.get(
            f"{BASE_URL}/api/system/metrics",
            headers=headers,
            name="/api/system/metrics",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"获取性能指标失败: {response.status_code}")
    
    @task(2)
    def health_check(self):
        """健康检查"""
        with self.client.get(
            f"{BASE_URL}/health",
            name="/health",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"健康检查失败: {response.status_code}")

class FacebookAutoBotUser(HttpUser):
    """
    Facebook Auto Bot 负载测试用户
    模拟真实用户行为
    """
    
    # 任务权重配置
    tasks = {
        AuthTaskSet: 1,
        AccountTaskSet: 3,
        TaskTaskSet: 4,
        SystemTaskSet: 2
    }
    
    # 思考时间（请求间隔）
    wait_time = between(1, 3)
    
    # 用户初始化
    def on_start(self):
        print(f"🚀 虚拟用户 {self.__class__.__name__} 启动")
    
    # 用户停止
    def on_stop(self):
        print(f"🛑 虚拟用户 {self.__class__.__name__} 停止")

# 自定义事件监听器
@events.init.add_listener
def on_locust_init(environment, **kwargs):
    print("=" * 60)
    print("🎯 Facebook Auto Bot 负载测试启动")
    print(f"📅 开始时间: {datetime.now().isoformat()}")
    print(f"🌐 目标地址: {BASE_URL}")
    print("=" * 60)

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("🔥 测试开始!")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("✅ 测试完成!")
    print(f"📅 结束时间: {datetime.now().isoformat()}")
    
    # 生成测试摘要
    stats = environment.stats
    total_requests = stats.total.num_requests
    total_failures = stats.total.num_failures
    failure_rate = (total_failures / total_requests * 100) if total_requests > 0 else 0
    
    print("\n📊 测试摘要:")
    print(f"   总请求数: {total_requests}")
    print(f"   失败请求: {total_failures}")
    print(f"   失败率: {failure_rate:.2f}%")
    print(f"   平均响应时间: {stats.total.avg_response_time:.2f}ms")
    print(f"   最大响应时间: {stats.total.max_response_time:.2f}ms")
    print(f"   请求速率: {stats.total.total_rps:.2f}/s")

# 自定义失败处理
@events.request_failure.add_listener
def on_request_failure(request_type, name, response_time, exception, **kwargs):
    print(f"❌ 请求失败: {name} - {exception}")

# 运行配置
if __name__ == "__main__":
    import sys
    from locust import runners
    
    # 检查参数
    if len(sys.argv) < 2:
        print("使用方法: python locustfile.py [用户数] [生成速率] [运行时间]")
        print("示例: python locustfile.py 100 10 5m")
        sys.exit(1)
    
    print("📝 负载测试配置:")
    print(f"   虚拟用户数: {sys.argv[1] if len(sys.argv) > 1 else '未指定'}")
    print(f"   生成速率: {sys.argv[2] if len(sys.argv) > 2 else '未指定'}/s")
    print(f"   运行时间: {sys.argv[3] if len(sys.argv) > 3 else '未指定'}")