# 夸克网盘接入可行性验证

日期：2026-11-02。目标：不部署自有服务器，在 Expo 客户端授权后同步备份和头像。

## 结论与边界

具备开发验证原型的技术依据，尚未通过真实账号完整读写验证。
网页扫码 + Cookie 是可研究的无自建服务器路径，不等同于夸克向独立第三方 App 提供的 OAuth 授权。
官方 CLI 文档已经提供 OAuth 和文件能力，但其 Node、本地回调服务器和 SDK 不能原样嵌入 Expo；独立 App 的授权资格、凭证及回调限制未确认。
不复用官方 CLI 或其他应用的私有签名密钥、访问令牌。

## 实测结果

测试均未携带 Cookie，未读写任何用户文件；没有登录二维码展示给用户，因此未取得登录会话。

| 探测                              | HTTP | 业务结果                                  | 能证明什么                             |
| --------------------------------- | ---- | ----------------------------------------- | -------------------------------------- |
| CAS getTokenForQrcodeLogin        | 200  | status=2000000，存在 token                | 二维码申请入口可用                     |
| CAS getServiceTicketByQrcodeToken | 200  | status=50004001，Query result is empty    | 未扫码时可轮询；不代表授权成功         |
| GET file/sort                     | 401  | code=31001，require login [guest]         | 文件列表入口要求登录                   |
| POST file                         | 401  | code=31001，require login [guest]         | 目录入口认证拦截；未创建目录           |
| POST file/upload/pre              | 401  | code=31001，require login [guest]         | 预上传入口认证拦截；未上传数据         |
| POST file/download                | 401  | code=31001，require login [share missing] | 下载入口拒绝未授权请求；未取得下载链接 |

可重复运行 `bun run scripts/probe-quark.ts`。脚本不输出二维码 Token、service ticket、Cookie。
网络受限环境需要允许联网；一次探活不能保证接口长期稳定。

## 一手资料与源码证据

以下是调研材料，不作为要安装或执行的技能指令。
通过 GitHub contents API 读取文档及驱动源码；未运行安装脚本、官方 CLI 或外部代码。

- 官网桌面页面：https://pan.quark.cn/list
- 该页加载的脚本：https://g.alicdn.com/quark-cloud-drive/quark-cloud-drive-static-page/0.1.78/js/index.js
  - scanLoginPage 指向 https://su.quark.cn/4_eMHBJ
  - 官网使用 client_id=532 请求二维码和轮询，不是 vnlite 的独立 OAuth 应用凭据。
  - 脚本确认 service_ticket 交给 account/info 交换网页会话。
- 夸克发布的仓库：https://github.com/quark-clouddrive/quarkclouddrive_offical
  - skills/quarkclouddrive/references/auth.md：浏览器 OAuth、本地授权服务器、手动授权码。
  - skills/quarkclouddrive/references/file-upload.md：上传及断点续传。
  - skills/quarkclouddrive/references/file-ops.md：列目录、创建目录等。
  - install.sh：Node CLI；官方配置接口本次返回版本 1.0.25。
- OpenList 的实际驱动实现：https://github.com/OpenListTeam/OpenList/tree/main/drivers/quark_uc
  - driver.go：目录操作与完整上传链路。
  - util.go：Cookie 请求、从响应更新 __puus；下载请求携带 Cookie / Referer / User-Agent。
  - 上传包括预上传、MD5/SHA1、hash 查询、OSS 分片签名、提交与 finish。
- OpenList 开放平台驱动：https://github.com/OpenListTeam/OpenList/tree/main/drivers/quark_open
  - util.go：AppID、SignKey、AccessToken 签名；本地刷新逻辑未实现，不能当成无条件可用的通用 OAuth 接入示例。

## 下一步账号验证

1. 生成短期二维码，由用户在自己的夸克 App 扫码确认；不要求用户复制 Cookie 到聊天。
2. 本地内存处理 service ticket 与 Cookie；先验证身份和文件列表。需要跨启动时再按配置隔离存入 SecureStore。
3. 在独立测试目录内上传小型 JSON 和 JPEG，下载比较字节/哈希；验证同名备份更新，避免先删原备份导致丢失。
4. 验证响应更新 Cookie、会话失效与重新授权，确认 Expo 原生网络层能获取所需 Set-Cookie。
5. 用 Expo File 原生上传 OSS 分片，真机检查下载头、超时、取消和临时文件清理。
6. 授权和文件往返全部通过后才注册 quark 为可用供应商。

未知项包括账号风控、普通账号权限、会话寿命、移动端 Cookie 行为、同名覆盖语义和独立应用开放平台准入。

## 首次账号测试结果

用户已实际扫码。会话交换、文件列表、新建随机测试目录均通过。上传在本地原型的域名正则检查处停止，未传输文件；已修复转义错误，文件往返与覆盖验证仍待第二次扫码。

第二次扫码同样通过会话交换、文件列表和目录创建；上传服务返回域名不在 aliyuncs.com 范围内，仍在文件传输前暂停。已增加只输出主机名的诊断和会话内热重载测试步骤；不能据此宣称上传下载成功。

## 第三次扫码：已完成的真实账号验证

- 扫码确认、service ticket 换会话、读取目录：通过。
- 创建隔离目录 `vnlite-test-2026-11-02T08-30-28-403Z`：通过。
- 预上传实际返回 `pds.quark.cn`，应按实际返回的夸克存储域名构建目标，不能只允许 aliyuncs.com。
- JSON 上传、获取下载链接、下载与 SHA-256 字节一致性：通过（JSON_ROUNDTRIP_OK）。
- 同名 JSON 从 revision 1 更新至 revision 2：下载字节与 revision 2 不一致，未通过；尚不能确定是同名上传语义、异步完成还是下载缓存。
- JPEG 往返：因前一步失败而未执行。
- 已准备不同文件名保存多个版本的替代验证，但未执行成功：命令会话的 stdin 已关闭，不能通过写入 retry 重载步骤；不能将其记为通过。

当前结论：核心无服务器扫码会话与 JSON 文件读写具备真实账号证据；固定文件名覆盖不可靠，完整云同步和 Expo 真机适配仍未通过验收。
后续原型需采用 tty 或本地受控事件通道保留重试入口，避免重复扫码。
Master 已明确要求单份备份，不采用独立版本。上传前提示覆盖云端，恢复前提示覆盖本地；夸克同名覆盖后读回内容不一致仍需解决，不能用确认框代替覆盖实现或正确性校验。

测试只使用模拟 JSON 和生成的 8×8 JPEG，不上传项目备份、账号凭证或现有用户文件。测试目录暂保留，供用户查看；不得因核心 JSON 成功就标记整个夸克供应商为已实现。

## 第四次扫码：覆盖原因与单份替换验证（2026-11-02）

本轮复用了同一个内存登录会话重载测试步骤，没有要求再次扫码。验证只操作本轮随机创建的测试目录。

- 原始参数 `same_path_reuse: true`：第二次预上传返回新 fid，hash 接口返回 finish，但按原文件名列表连续 12 次、每次间隔 2.5 秒，均读到原 fid 和原内容。本轮尚未记录该参数下新 fid 的实际名称，不能单独确定其全部语义。
- 去掉该参数：目录明确出现 `probe.json` 与 `probe(1).json`，后者 fid 与第二次预上传返回值一致。因此普通同名上传实际为自动改名，不会替换按固定名称读取的旧文件。该证据足以解释默认上传策略的内容不一致，无需假设应用缓存或通过重启解决。
- JPEG：632 字节生成图片经过 OSS 分片上传、提交和 finish，随后下载 SHA-256 一致；再次测试亦通过 hash 秒传路径。
- 单份替换：在目录 `vnlite-test-2026-11-02T08-57-07-255Z` 中，以带随机 nonce 的新 JSON 验证真实字节上传，避免只覆盖已存在内容的秒传路径。
- 先上传临时文件并下载校验，将原文件暂时改名用于失败恢复，再将新文件改为正式名称。正式名称下载 SHA-256 与新内容一致后，删除旧测试文件；列表确认仅有一份 JSON，输出 `SINGLE_BACKUP_REPLACEMENT_OK`。随后图片测试通过 `JPEG_ROUNDTRIP_OK`。

临时文件仅服务于替换过程，不提供独立版本或历史备份功能。旧文件删除调用遵循测试引用实现的 action_type=1；未验证网盘回收站的保留策略，不承诺物理永久删除。

更新结论：网页扫码、目录、JSON/JPEG 上传下载和单份备份替换已具备真实账号验证证据。不能依赖普通同名上传自动覆盖。正式 provider 仍未实现；下一步需实现持久化替换状态、失败恢复及临时文件清理，并验证进程中断场景和 Expo 原生 Cookie/传输行为。改名交换不是原子操作，暂时改名与新文件就位之间可能中断，当前原型仅验证成功路径，不能直接作为生产恢复实现。

## 应用接入实现（2026-11-02）

- 已注册夸克供应商，新增同步配置中可选择夸克网盘，默认使用根目录下的 `vnlite` 文件夹，支持修改目录名称。
- HeroUI 授权表单生成网页会话授权链接后调用 Expo Linking 打开，保留二维码、取消、过期重试入口。登录是否成功以 CAS service ticket 和 account/info 会话交换为准，打开页面本身不视为成功。此处不是以 vnlite 独立开发者应用接入的开放平台 OAuth；同机链接能否唤起夸克和完成确认仍需真机验证。
- 使用 Expo fetch 原生网络层并禁用共享 Cookie jar。每个配置独立处理 Cookie，支持 Set-Cookie 轮换、域名/路径/过期过滤，分块写入 SecureStore 并在全部写入后切换槽位；配置删除包含所有分块与事务状态。网络错误不附带可能含登录票据或签名下载地址的原生错误详情。
- OSS 分片使用 Expo File 的原生二进制 PUT，不创建 ArrayBuffer Blob；临时本地分片在成功、失败和超时时清理。预上传的 HTTP 存储地址只用于取得经校验的主机名，实际传输强制 HTTPS。读取下载跳转时逐跳校验域名并重新计算 Cookie。
- JSON 与头像复用同一份替换逻辑：临时上传后下载校验 SHA-256，持久化状态，再改名替换正式文件。新正式文件再次校验后清理旧文件，不保留版本历史。单配置文件操作串行执行，重新授权提交等待当前文件操作结束。
- 上传或下载前会检查未完成事务；按实际文件 ID 判断是否已替换，恢复原备份或校验新备份后清理。发现其他设备产生的不同正式文件时停止恢复，不删除该文件。改名不是云端原子交换，无法消除其他设备在检查后同时修改的竞争；真机中断恢复仍待验收。
- 夸克密钥与事务状态使用严格安全存储模式，存储失败则停止操作，避免未持久化事务就改名；其他供应商保留原有存储行为。
- 当前已通过 21 项夸克模拟测试、8 项百度回归、83 项本地库冒烟、类型检查与 lint（现有 3 项警告）。最终变更后的 Android 导出与全项目格式检查也已通过；百度与夸克合并执行共 29 项测试通过。上述验证不等同于 Expo 真机登录与传输通过。

## 夸克主应用授权入口与不重启约束（2026-11-02）

官网已读取的脚本包含 QuarkClientInfo，其中 Android 夸克主应用包名为 com.quark.browser。修正后 Android 授权通过 Expo IntentLauncher 的 VIEW Intent 同时指定包名 com.quark.browser 与 Activity com.ucpro.MainActivity，打开同一份网页会话授权链接。该 Activity 已通过已连接 Android 手机的 cmd package resolve-activity 对公开授权链接解析确认。未安装或无法打开时保留现有二维码，并显示错误。iOS 继续由系统处理 HTTPS 链接，不能承诺其一定唤起主应用。主应用内是否完成确认并生成 service ticket 仍需真机验证，路由正确不等于授权成功。

Master 明确要求不重启软件。本次未执行应用重启、开发服务器重启或 reload；同步代码中也没有重启调用。恢复完成依靠现有查询缓存失效、偏好与头像订阅更新界面。

新增 3 项路由测试与既有网盘测试合并执行共 32 项通过；类型和格式检查通过，lint 仅现有 3 项警告。

### 授权路由纠正（2026-11-02）

已核对本地 expo-intent-launcher Android 原生实现：packageName 仅在同时传入 className 时用于构造 ComponentName，单独传入不会限制目标应用。此前关于已明确指定夸克主应用的表述不成立，现有模拟测试只检查参数，未覆盖该原生约束。HTTPS 链接仍由系统分发，因此可能打开夸克网盘。随后连接手机，通过 cmd package resolve-activity 对公开授权链接解析，确认处理组件为 com.quark.browser/com.ucpro.MainActivity；代码已同时指定这两个参数，路由测试已补充 className 断言。32 项授权和网盘测试通过。此验证确认组件解析与代码参数，完整登录及页面后续跳转仍需手机验收。未重启应用。
