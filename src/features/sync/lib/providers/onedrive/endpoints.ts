/**
 * OneDrive 的服务端点。
 *
 * 做成**可改的对象**而不是写死的常量：
 *   - 国内版（21Vianet：`microsoftgraph.chinacloudapi.cn`）要换地址
 *   - 冒烟测试要用本地的假服务器
 *
 * 属性可写，所以测试里直接改这两个字段就行（`ONEDRIVE_ENDPOINTS.graph = …`）。
 */
export const ONEDRIVE_ENDPOINTS = {
  /** Microsoft Graph */
  graph: "https://graph.microsoft.com/v1.0",
  /** 微软登录（`common` = 个人账号 + 工作/学校账号都支持） */
  login: "https://login.microsoftonline.com/common/oauth2/v2.0",
};
