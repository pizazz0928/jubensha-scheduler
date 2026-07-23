# 归来剧场实时排班系统

面向盒装剧本杀门店的当日调度系统，支持临时开本、快速换 DM、DM 玩家补位、共享数据、冲突检查、角色权限和操作留痕。

## 当前能力

- 今日调度大屏、风险提醒、场次筛选和 DM 实时状态
- 临时开本、主 DM 推荐、快速换 DM 和玩家补位
- 场次开始、结束、取消、时间调整、人数调整和补位退出
- 自定义 DM、剧本、熟练度、房间容量、房态和支持类型
- MySQL 云端持久化与本地文件演示模式
- 乐观版本锁与 MySQL 行锁，避免并发重复占用
- CloudBase 身份上下文与管理员、店长、前台、DM 四级权限
- 中文桌面界面、手机浏览器适配、CSV 操作记录导出
- 动态端口、健康检查、非 root 容器和安全响应头

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
pnpm install
pnpm dev
```

本地默认使用演示管理员和 `data/scheduler-state.json`。首次启动会生成 12 名 DM、15 个剧本、6 个房间和 8 个场次。

完整检查：

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm audit --prod
```

## 本地生产模式

先执行构建，再启动腾讯兼容网关：

```bash
pnpm build
AUTH_MODE=demo pnpm start:cloud
```

Windows PowerShell 可以这样设置环境变量：

```powershell
$env:AUTH_MODE="demo"
pnpm start:cloud
```

本地演示账号为“本地管理员”，拥有管理员权限且没有密码。这个模式仅用于开发。

## 腾讯云正式环境

仓库根目录包含 `Dockerfile`，CloudBase Run 从 GitHub 拉取后可以直接构建。

构建设置：

- 构建目录填写仓库根目录
- Dockerfile 填写 `Dockerfile`
- 服务端口填写 `3000`
- 健康检查路径填写 `/healthz`
- 启动命令留空

正式环境必须配置：

```text
NODE_ENV=production
AUTH_MODE=cloudbase
REQUIRE_MYSQL=true
DB_HOST=MySQL 内网地址
DB_PORT=3306
DB_USER=数据库账号
DB_PASSWORD=数据库密码
DB_NAME=数据库名称
CLOUDBASE_ADMIN_UIDS=管理员 UID
CLOUDBASE_MANAGER_UIDS=店长 UID
CLOUDBASE_FRONTDESK_UIDS=前台 UID
CLOUDBASE_DM_UID_MAP={"DM账号UID":"dm-aheng"}
```

也可以使用 `CONNECTION_URI` 代替五个 `DB_` 变量。

数据库表会在首次启动时自动创建。`REQUIRE_MYSQL=true` 会让缺少数据库配置的容器直接停止，防止正式环境误用临时文件。

生产环境默认要求 CloudBase 登录。HTTP 访问服务需要开启身份验证，并确保服务只通过会注入 `x-cloudbase-context` 的 CloudBase 网关访问。请勿公开绕过网关的容器直连地址。

完整控制台操作见 [腾讯云正式上线清单](docs/TENCENT_LAUNCH.md)。

## 角色权限

| 角色 | 场次调度 | 基础资料 | 数据可见范围 |
| --- | --- | --- | --- |
| 管理员 | 可以 | 可以 | 全部门店数据 |
| 店长 | 可以 | 可以 | 全部门店数据 |
| 前台 | 可以 | 只读 | 手机号脱敏后的门店数据 |
| DM | 只读 | 只读 | 自己的场次、技能和资料 |

未列入管理员、店长或前台 UID 名单的已登录账号会进入 DM 角色。DM 账号需要在 `CLOUDBASE_DM_UID_MAP` 中关联 DM 编号。

## 共享数据接口

- `GET /api/shared/snapshot` 获取当前账号可见的数据和版本号
- `POST /api/shared/catalog` 保存 DM、剧本、房间和熟练度
- `POST /api/shared/dispatch` 创建场次、安排 DM、调整和关闭场次
- `GET /api/shared/me` 获取当前账号角色
- `GET /healthz` 获取服务和存储状态

每次写操作都要带 `expectedVersion`。版本落后时接口返回 `409`，页面会刷新云端状态并提示重试。

## 数据备份

正式数据存放在 MySQL 的 `scheduler_state` 表。建议在腾讯云数据库中开启自动备份，并在重大资料调整前创建手动备份。操作日志在应用状态中保留最近 200 条。

## 演示流程

1. 点击“临时开本”，选择剧本、时间、玩家人数和房间。
2. 在缺 DM 的场次点击“安排 DM”，选择合格候选人。
3. 在缺玩家的场次点击“添加补位”。
4. 点击场次“详情”，可以调整时间和人数，也可以开始、结束或取消场次。
5. 真实玩家到店后，在详情中让补位 DM 退出。
6. 在 DM 状态、剧本管理和房间管理中维护自定义资料。
7. 在记录统计中查看并导出操作记录。
