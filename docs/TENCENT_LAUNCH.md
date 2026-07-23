# 腾讯云正式上线清单

这份清单用于把 GitHub 仓库部署成可以给门店员工长期使用的 CloudBase Run 服务。

## 一、准备 MySQL

1. 在当前腾讯云环境创建 MySQL 数据库。
2. 确认数据库与 CloudBase Run 服务处于可互通的网络。
3. 创建专用数据库账号，并授予目标数据库的建表、查询、插入和更新权限。
4. 保存内网地址、端口、账号、密码和数据库名称。
5. 开启自动备份。

应用启动时会自动创建 `scheduler_state` 表并写入初始演示数据。

## 二、配置服务环境变量

在 CloudBase Run 服务的环境变量中填写：

```text
NODE_ENV=production
AUTH_MODE=password
REQUIRE_MYSQL=true
DB_HOST=你的 MySQL 内网地址
DB_PORT=3306
DB_USER=你的数据库账号
DB_PASSWORD=你的数据库密码
DB_NAME=你的数据库名称
SESSION_SECRET=至少32个字符的随机字符串
APP_USERS_JSON=门店账号配置
```

请勿把数据库密码、会话密钥或员工账号配置提交到 GitHub。

## 三、配置登录和角色

1. 在自己的电脑进入项目目录。
2. 运行 `pnpm auth:secret`，把输出填入 `SESSION_SECRET`。
3. 为每位员工运行一次 `pnpm auth:hash`。
4. 在终端输入员工密码，复制输出的密码哈希。
5. 根据员工权限生成 `APP_USERS_JSON`。
6. 在腾讯云 HTTP 访问服务中关闭身份验证，让系统自己的登录页处理员工登录。
7. 保持服务全程使用 HTTPS。

示例：

```json
[
  {"username":"admin","passwordHash":"生成的哈希","displayName":"管理员","role":"admin"},
  {"username":"manager01","passwordHash":"生成的哈希","displayName":"晚班店长","role":"manager"},
  {"username":"frontdesk01","passwordHash":"生成的哈希","displayName":"前台","role":"frontdesk"},
  {"username":"dm01","passwordHash":"生成的哈希","displayName":"阿衡","role":"dm","dmId":"dm-aheng"}
]
```

把整段 JSON 压缩成一行后填入 `APP_USERS_JSON`。至少保留一个 `admin` 账号。DM 账号的 `dmId` 要与系统 DM 资料中的编号一致。

## 四、部署 GitHub 主分支

1. 代码仓库选择 `pizazz0928/jubensha-scheduler`。
2. 分支选择 `main`。
3. 构建目录选择仓库根目录。
4. Dockerfile 路径填写 `Dockerfile`。
5. 服务端口填写 `3000`。
6. 健康检查路径填写 `/healthz`。
7. 保存并开始部署。

成功日志会包含：

```text
"message":"cloud service ready"
"storage":"mysql"
"auth":"password"
```

## 五、上线验收

用管理员账号完成：

1. 登录后能看到“云端已同步”。
2. 新增一名测试 DM，刷新页面后仍然存在。
3. 新增一个测试房间和一个测试剧本。
4. 创建临时场次并安排主 DM。
5. 用另一台手机同时打开页面，能在八秒内看到新场次。
6. 两台设备同时安排同一名 DM，只有一台成功。
7. 开始并结束测试场次，DM 恢复空闲，房间进入清理中。
8. 真实玩家替换补位 DM 后，补位 DM 恢复空闲。
9. 前台账号无法修改基础资料。
10. DM 账号只能看到自己的场次。
11. 导出 CSV 操作记录。
12. 重启服务，确认数据仍然存在。
13. 连续输入错误密码达到限制后，系统会暂时拒绝继续尝试。

## 六、上线后维护

- 每周检查数据库自动备份是否成功。
- 每月导出一次操作记录。
- 员工离职后立即从 `APP_USERS_JSON` 中移除该账号并重新部署。
- 每三个月更换管理员密码和 `SESSION_SECRET`。
- 每次更新代码后检查 `/healthz`，再执行一次临时开本和换 DM。
- 数据库连接失败时保留 `REQUIRE_MYSQL=true`，先修复连接，避免服务回退到临时文件。
