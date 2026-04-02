# TikTok Shop Seller Center & Affiliate Center 调研报告 (2025/2026)

本报告针对 TikTok Shop 卖家中心（Seller Center）及其达人广场（Affiliate Center/Find Creators）的页面结构、功能流程及技术实现进行详细调研。

## 1. TikTok Shop Seller Center 完整 URL 结构

TikTok Shop 的卖家中心根据国家/地区有不同的子域名。

### 1.1 基础域名
- **美国 (US):** `https://seller-us.tiktok.com/`
- **英国 (UK):** `https://seller-uk.tiktok.com/`
- **东南亚:** `https://seller-ph.tiktok.com/` (菲律宾), `https://seller-my.tiktok.com/` (马来西亚), `https://seller-sg.tiktok.com/` (新加坡), `https://seller-vn.tiktok.com/` (越南), `https://seller-id.tiktok.com/` (印尼)

### 1.2 主要功能路由 (以 US 为例)
- **首页/仪表盘:** `https://seller-us.tiktok.com/homepage`
- **达人中心首页 (Affiliate Center):** `https://seller-us.tiktok.com/affiliate/`
- **达人广场 (Find Creators):** `https://seller-us.tiktok.com/affiliate/marketplace` 或 `https://seller-us.tiktok.com/affiliate/find-creators`
- **达人管理 (Creator Management):** `https://seller-us.tiktok.com/affiliate/creator-management`
- **定向计划/邀约管理 (Target Collaboration):** `https://seller-us.tiktok.com/affiliate/collaboration/target`
- **公开计划 (Open Collaboration):** `https://seller-us.tiktok.com/affiliate/collaboration/open`
- **店铺健康度:** `https://seller-us.tiktok.com/account-health`

---

## 2. 达人广场 (Find Creators) 页面结构

### 2.1 核心功能
达人广场是卖家寻找带货达人的核心工具。卖家可以通过以下维度筛选达人：
- **达人画像:** 粉丝数、主要带货类目、粉丝性别/年龄比例。
- **带货表现:** 历史 GMV、带货视频数量、直播场次、转换率。
- **联系方式:** 部分达人公开了联系邮箱或 WhatsApp（通常标记为 "Contact"）。

### 2.2 页面技术特征
- **动态加载:** 页面使用 React 构建，内容通过异步 JSON API 请求加载。
- **内部 API:** 页面通常调用类似 `api/v1/affiliate/creator/search` 的内部接口获取达人列表。
- **反爬策略:** TikTok 具有较强的反爬机制，包括动态 Token (如 `msToken`, `_signature`) 和验证码。

---

## 3. 邀约达人 (Invitation Flow) 流程

邀约主要分为“站内定向邀约”和“站外主动联系”。

### 3.1 站内定向计划 (Target Collaboration) 流程
1. **搜索达人:** 在达人广场筛选出目标达人。
2. **发起邀约 (Invite):** 点击 "Invite" 按钮。
3. **设置参数:**
   - 选择要推广的商品。
   - 设置专属佣金比例 (通常高于公开计划)。
   - (可选) 邮寄样品设置。
4. **发送:** 邀约信息发送至达人的 TikTok 手机端后台。
5. **达人端:** 达人在 TikTok App 的 "TikTok Shop" 收件箱中看到邀请，点击接受后，商品会自动加入达人的橱窗。

### 3.2 站外联系
如果达人公开了联系方式，卖家会通过邮件或社交软件进行私下沟通，谈好条件后再通过站内发送定向计划。

---

## 4. TikTok Shop 官方 Open API

TikTok 提供了专门的 **TikTok Shop Partner Center** 给开发者使用。

### 4.1 达人相关 API (Affiliate Seller API)
官方 API 涵盖了大部分卖家中心的操作：
- **`search_creator`**: 搜索达人，获取达人基础数据和带货表现。
- **`create_target_collaboration`**: 创建定向计划，发送邀约。
- **`get_collaboration_report`**: 获取计划的推广效果报告。
- **`manage_samples`**: 管理样品发放申请。

### 4.2 API 使用限制
- 需要注册成为 TikTok Shop Partner 并申请应用权限。
- API 调用受频率限制 (Rate Limiting)。
- 部分高级数据（如达人的粉丝详细画像）可能不在基础 API 中开放，需特定权限。

---

## 5. 现有插件 (Chrome Extension) 技术实现分析

市面上的 TikTok Shop 插件（如达人爬虫、批量邀约工具）通常采用以下技术：

1. **XHR/Fetch 拦截 (Request Interception):** 
   - 插件通过 `chrome.webRequest` 或注入 `hook` 到 `window.fetch` 来捕获 Seller Center 页面本身请求的 JSON 数据。
   - 这种方式可以直接获取结构化的达人列表数据，而无需解析复杂的 HTML。

2. **DOM 注入与自动化 (Content Scripts):**
   - 在页面上添加“导出数据”或“一键批量邀约”按钮。
   - 使用 JavaScript 模拟点击、填充表单。例如，自动化填写佣金比例并点击发送邀请。

3. **数据存储与同步:**
   - 将采集到的达人数据同步到插件的后台数据库或导出为 CSV/Excel。

4. **绕过验证:**
   - 由于验证码 (Captcha) 的存在，插件通常依赖于用户的活跃登录会话 (Session/Cookies)，避免直接在后台进行无界面的模拟请求。

---

## 6. 总结与建议

- **URL 确定性:** 核心路由为 `/affiliate/marketplace` 和 `/affiliate/collaboration/target`。
- **数据获取:** 优先通过拦截内部 API 获取 JSON 数据，其次考虑解析 DOM。
- **自动化核心:** 重点在于模拟 `Target Collaboration` 的创建过程，包括商品选择和佣金设置。
- **合规性:** 官方 API 功能强大，建议优先考虑官方授权接入；若开发插件，需注意 TikTok 的安全检测机制。

---
*报告生成于: 2026-03-31*
