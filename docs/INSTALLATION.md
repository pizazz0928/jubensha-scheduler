# 安装与运行说明

## 运行条件

- Node.js 22.13 或更高版本
- pnpm 11.9
- 正式环境使用 MySQL 8.0 或更高版本
- 腾讯云部署使用仓库根目录的 `Dockerfile`

## 获取项目

```bash
git clone https://github.com/pizazz0928/jubensha-scheduler.git
cd jubensha-scheduler
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
```

## 本地体验

```bash
pnpm dev
```

浏览器打开终端显示的本地地址。本地默认进入演示管理员账号，数据保存在 `data/scheduler-state.json`。这个模式只适合开发和体验。

## 本地正式模式检查

先生成登录资料：

```bash
pnpm auth:secret
pnpm auth:hash
```

把生成结果放入环境变量。单人使用只需一个管理员账号：

```text
NODE_ENV=production
AUTH_MODE=password
REQUIRE_MYSQL=true
CONNECTION_URI=mysql://账号:密码@地址:3306/数据库名
SESSION_SECRET=生成的随机密钥
APP_USERS_JSON=[{"username":"admin","passwordHash":"生成的密码哈希","displayName":"店长","role":"admin"}]
```

`CONNECTION_URI` 可以换成 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD` 和 `DB_NAME`。密码中含有 `@`、`:`、`/` 等字符时，优先使用分开的 `DB_` 变量。

构建并启动：

```bash
pnpm build
pnpm start:cloud
```

检查：

```bash
curl http://127.0.0.1:3000/healthz
```

正式数据库连接正常时会返回 `"storage":"mysql"`。

## MySQL 最小权限

首次启动需要创建表。建议为应用创建单独数据库和账号：

```sql
CREATE DATABASE jubensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'jubensha_app'@'%' IDENTIFIED BY '替换为高强度密码';
GRANT SELECT, INSERT, UPDATE, CREATE ON jubensha.* TO 'jubensha_app'@'%';
FLUSH PRIVILEGES;
```

正式使用前应限制数据库网络访问范围，只允许应用所在私有网络连接。

## 发布前检查

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm audit --prod
```

这些检查全部成功后再发布。Linux 和 MySQL 联合检查由 GitHub Actions 自动执行。

## 常见启动问题

### 服务立即退出

确认 `NODE_ENV=production` 时已经设置 `AUTH_MODE=password`、`SESSION_SECRET`、`APP_USERS_JSON` 和 MySQL 配置。

### 健康检查返回 503

检查 MySQL 地址、账号权限、安全组、私有网络和数据库实例状态。保留 `REQUIRE_MYSQL=true`，避免正式服务写入容器临时文件。

### 登录后马上回到登录页

正式服务需要 HTTPS。检查反向代理是否传递 Cookie，并确认 `SESSION_SECRET` 在各实例中完全相同。

### 页面提示数据已更新

另一页面已经先保存。刷新后重做当前操作即可，这说明并发保护正在生效。
