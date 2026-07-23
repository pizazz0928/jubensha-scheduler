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
AUTH_MODE=cloudbase
REQUIRE_MYSQL=true
DB_HOST=你的 MySQL 内网地址
DB_PORT=3306
DB_USER=你的数据库账号
DB_PASSWORD=你的数据库密码
DB_NAME=你的数据库名称
```

请勿把数据库密码提交到 GitHub。

## 三、配置登录和角色

1. 在 CloudBase 身份认证中开启计划使用的登录方式。
2. 在 HTTP 访问服务中启用身份验证。
3. 确认登录请求会向容器注入 `x-cloudbase-context`。
4. 完成一次登录并取得用户 UID。
5. 把 UID 放入对应环境变量。

示例：

```text
CLOUDBASE_ADMIN_UIDS=管理员UID
CLOUDBASE_MANAGER_UIDS=店长UID1,店长UID2
CLOUDBASE_FRONTDESK_UIDS=前台UID1,前台UID2
CLOUDBASE_DM_UID_MAP={"DM用户UID1":"dm-aheng","DM用户UID2":"dm-nanzhi"}
```

正式网址应使用启用了身份验证的网关域名。容器直连地址应关闭公开访问，或限制为仅接受网关流量。

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
"auth":"cloudbase"
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

## 六、上线后维护

- 每周检查数据库自动备份是否成功。
- 每月导出一次操作记录。
- 员工离职后立即从角色 UID 环境变量中移除。
- 每次更新代码后检查 `/healthz`，再执行一次临时开本和换 DM。
- 数据库连接失败时保留 `REQUIRE_MYSQL=true`，先修复连接，避免服务回退到临时文件。
