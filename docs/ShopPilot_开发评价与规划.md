# ShopPilot 开发评价与规划

> 审查日期：2026-04-01 | 审查版本：v0.1.0

---

## 一、项目总体评价

### 综合评分：72/100（可用原型，尚未达到上架标准）

| 维度 | 评分 | 说明 |
|:---|:---:|:---|
| 架构设计 | ★★★★☆ | MV3 规范、多入口构建、消息驱动架构清晰 |
| 代码质量 | ★★★★☆ | TypeScript 类型完备、组件拆分合理、命名规范 |
| 功能完成度 | ★★★☆☆ | 达人采集/AI 生成可用，批量邀约/自动监控未完成 |
| 可靠性 | ★★☆☆☆ | Content Script 沙盒问题未解决、DOM 选择器脆弱 |
| 上架就绪度 | ★★☆☆☆ | 图标占位、web_accessible_resources 不一致、host_permissions 过宽 |
| 用户体验 | ★★★★☆ | UI 精致、TikTok 品牌色到位、交互流畅 |

---

## 二、已完成功能清单 ✅

| 功能 | 状态 | 所在文件 |
|:---|:---:|:---|
| Chrome Extension 基础框架（MV3） | ✅ 完成 | manifest.json, vite.config.ts |
| Popup 设置面板（API Key 配置、用量仪表盘） | ✅ 完成 | PopupApp.tsx (353行) |
| Side Panel 四标签页架构 | ✅ 完成 | SidePanelApp.tsx (144行) |
| 达人数据采集（Fetch/XHR 拦截） | ✅ 完成 | content/index.ts (443行) |
| 达人列表展示（搜索/排序/分类/导出 CSV） | ✅ 完成 | CreatorsTab.tsx (312行) |
| AI 邀约信生成（多语气选择） | ✅ 完成 | InviteTab.tsx (124行) |
| AI Listing 文案生成（标题/描述/卖点/SEO 标签） | ✅ 完成 | ListingTab.tsx (136行) |
| 多模型 AI 后端（MiniMax/OpenAI/DeepSeek/Custom） | ✅ 完成 | services/ai.ts (182行) |
| 竞品监控 UI（价格趋势/销量显示） | ✅ 完成 | MonitorTab.tsx (219行) |
| 本地存储封装（配额/达人库/监控列表） | ✅ 完成 | utils/storage.ts (126行) |
| 消息路由 & 定时任务调度 | ✅ 完成 | background/index.ts (195行) |
| TikTok 品牌定制 UI（Tailwind 主题） | ✅ 完成 | tailwind.config.js, globals.css |

---

## 三、关键问题诊断 🔴

### P0 — 阻断性问题（必须修复才能正常使用）

#### 1. Content Script Fetch 拦截在沙盒中无效
- **位置**：`src/content/index.ts`
- **问题**：Content Script 默认运行在 `ISOLATED` world，拦截的是沙盒中的 `window.fetch`，而非页面真实的网络请求。
- **后果**：**达人数据采集功能在实际页面上完全无法工作**。
- **修复方案**：在 manifest 中设置 `"world": "MAIN"`，或改用注入 `<script>` 标签的方式将拦截代码注入到页面主上下文。

#### 2. DOM 选择器硬编码且无容错
- **位置**：`src/content/index.ts`
- **问题**：商品抓取使用了 `.product-info-title` 等 CSS 选择器，TikTok 前端频繁更新后极易失效。
- **后果**：商品数据抓取随时可能全部失灵，无法自愈。
- **修复方案**：实现多策略选择器链（主选择器 → 备用选择器 → 文本特征匹配），加入选择器失效上报机制。

### P1 — 功能缺失（影响核心卖点）

#### 3. 批量邀约未实现
- **位置**：`SidePanelApp.tsx`, `CreatorsTab.tsx`
- **问题**：`onBatchInvite` 只是占位回调，UI 上有"批量邀约"按钮但点击后无实际逻辑。
- **影响**：这是产品的核心差异化功能（"执行 > 分析"），不实现等于丧失竞争力。

#### 4. 竞品监控自动刷新机制不完整
- **位置**：`background/index.ts`, `MonitorTab.tsx`
- **问题**：`refreshAllTrackedProducts` 依赖当前有打开的 TikTok 标签页，否则无法抓取数据。Alarm 虽已设置但实际抓取链路断裂。
- **影响**：监控功能形同虚设，用户必须手动打开页面才能更新数据。

### P2 — 上架阻碍（提交 Chrome Web Store 会被拒）

#### 5. `web_accessible_resources` 与 `content_scripts` 不同步
- **位置**：`manifest.json`
- **问题**：content_scripts 覆盖了 ID/TH/MY/VN/PH 站点，但 web_accessible_resources 只配了 US/UK/SG 和 affiliate。
- **后果**：东南亚站点的 content script 访问扩展内部资源时会报错。

#### 6. Host Permissions 过宽
- **位置**：`manifest.json`
- **问题**：`https://www.tiktok.com/*` 覆盖了整个 TikTok 域名，Google 审核大概率要求说明理由。
- **建议**：缩窄到实际使用的路径模式，或准备充分的审核说明。

#### 7. 图标仍为占位符
- **位置**：`public/icons/`
- **问题**：虽然 4 个尺寸的图标文件都存在，但内容是否为正式设计未确认。

### P3 — 体验优化（不紧急但影响留存）

#### 8. AI 生成历史不持久化
- ListingTab 生成的文案关闭后丢失，无法回溯。

#### 9. PopupApp 代码臃肿
- 353 行混合了 UI 和状态逻辑，应拆分出 SettingsForm 等子组件。

#### 10. 全局 CSS 注入存在样式污染风险
- `globals.css` 中的 `*` 重置和通用类名（`.card`, `.btn-primary`）如果被注入到宿主页面会污染 TikTok 界面。
- Content Script 的 UI 应使用 Shadow DOM 隔离。

---

## 四、开发规划

### Phase 1：修复致命问题（预计 2-3 天）

> 目标：让核心功能在真实 TikTok 卖家中心页面上可用

| # | 任务 | 优先级 | 预估 |
|:--|:---|:---:|:---:|
| 1.1 | 修复 Content Script 执行上下文（`world: "MAIN"` 或 inject script 方案） | P0 | 3h |
| 1.2 | 实现多策略 DOM 选择器（主+备+特征匹配），添加失效检测 | P0 | 4h |
| 1.3 | 修复 manifest `web_accessible_resources` 覆盖所有站点 | P2 | 0.5h |
| 1.4 | 清理 Service Worker 的 Vite preload 错误 | P3 | 0.5h |
| 1.5 | 实际页面测试验证（需你在 TikTok 卖家中心登录状态下测试） | P0 | 2h |

### Phase 2：完善核心功能（预计 3-4 天）

> 目标：补全产品差异化功能

| # | 任务 | 优先级 | 预估 |
|:--|:---|:---:|:---:|
| 2.1 | 实现批量邀约逻辑（队列调度、进度展示、失败重试） | P1 | 6h |
| 2.2 | 完善竞品监控自动刷新（background 独立抓取，不依赖活动标签页） | P1 | 4h |
| 2.3 | AI 生成历史持久化（存入 chrome.storage，支持回溯） | P3 | 2h |
| 2.4 | Content Script UI 样式隔离（Shadow DOM 封装） | P2 | 3h |

### Phase 3：上架准备（预计 2-3 天）

> 目标：通过 Chrome Web Store 审核

| # | 任务 | 优先级 | 预估 |
|:--|:---|:---:|:---:|
| 3.1 | 设计正式图标（icon16/32/48/128 + promotional images） | P2 | 2h |
| 3.2 | 收窄 host_permissions，编写审核说明 | P2 | 1h |
| 3.3 | 编写隐私政策页面（BYOK 模式，数据本地存储，不收集用户数据） | P2 | 1h |
| 3.4 | 完整功能测试 + Bug 修复 | P1 | 4h |
| 3.5 | Chrome Web Store 上架包打包与提交 | P2 | 1h |

### Phase 4：增长与迭代（上架后）

> 目标：获取首批用户，验证 PMF

| # | 任务 | 优先级 | 预估 |
|:--|:---|:---:|:---:|
| 4.1 | 落地页开发（产品介绍 + 安装引导） | P2 | 4h |
| 4.2 | 用户反馈收集机制（插件内嵌入反馈入口） | P3 | 2h |
| 4.3 | 付费功能门控实现（Free/Pro/Business 分层限制） | P1 | 6h |
| 4.4 | 性能优化（达人列表虚拟滚动、存储分片） | P3 | 3h |

---

## 五、技术债务清单

| 类型 | 描述 | 影响 |
|:---|:---|:---|
| 安全 | Content Script 在 MAIN world 运行时需防止用户页面代码访问扩展内部状态 | 中 |
| 性能 | storage.ts 整数组读写，达人超 1000 条时可能卡顿 | 低 |
| 可维护性 | PopupApp.tsx 过于臃肿（353行），需拆分 | 低 |
| 兼容性 | MiniMax API URL 有两个域名（minimaxi.chat / minimax.chat），需确认 | 低 |
| CSS | 动画名 `fadeIn`/`pulse` 过于通用，可能与宿主页面冲突 | 中 |

---

## 六、结论

ShopPilot 的架构和 UI 打磨度 **远超一般 MVP 原型**，代码质量好、类型安全、组件化程度高。但有一个 **致命的技术盲点**：Content Script 的 Fetch 拦截在隔离沙盒中无法工作，意味着核心的达人数据采集功能在真实环境下是 **完全不可用** 的。

**立即行动项**：从 Phase 1.1（修复执行上下文）开始，这是所有后续功能的基础。

---

*报告生成：Accio | 2026-04-01*
