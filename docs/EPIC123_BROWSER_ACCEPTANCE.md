# Epic 1–3 浏览器验收补做记录

日期：2026-10-07。浏览器：本机 Chrome 154。数据全部为合成数据或项目自带样例，不是商户真实导出。用户已确认目前没有真实 CSV/XLS/XLSX，因此不宣称通过真实文件基准或全部 Iteration 3 AC。

此前把可在本机执行的浏览器检查整体放入待办，属于收尾遗漏。本次已执行下列检查，并保存可复核的结果。

## 实际执行结果

| 检查 | 实测结果 | 证据 |
|---|---|---|
| IndexedDB 跨刷新恢复 | 刷新页面后恢复 8 条记录、000101 前导零、已确认列映射、就绪结果、预测、40 件计划采购量及保存的供应商条款。 | `qa/browser-acceptance-refresh.json` |
| 关闭页面后重开 | 关闭原测试标签页，再以保存链接打开新标签页，以上内容仍可恢复；正式采购页显示 40 件及 MYR 100.00。 | `qa/browser-acceptance-download.json`；`qa/browser-acceptance-restored-plan.jpg` |
| 实际问题报告下载 | 正式就绪页下载的两个 CSV 均在 Downloads 找到并读取。正常路径文件 381 字节；异常样例文件 213,995 字节，267 条报告记录，包含 Used / Left out。下载副本及 SHA-256 已保存。正常路径虽然使用 `sourceMode=user`，输入仍为合成数据。 | `qa/browser-acceptance-report-downloads.json`；两个 `StockLess_*correction_report_2026-10-07.csv` |
| 容量边界 | 实际 Worker 接受 10,485,760 字节、100,000 行；本次耗时 653ms，主线程心跳最大间隔 152ms，166 次进度事件，进度最大间隔 251ms。正式上传页也接受相同容量的合成大样例，并显示 100,000 行进入映射页。 | `qa/browser-acceptance-download.json`；`qa/browser-acceptance-upload-capacity.json` |
| 读取期间交互 | 正式上传页的 Cancel 控件可用；一次键盘滚动交互观察到页面位置改变，响应记录为 27ms。该数值仅代表本次操作，不能推断所有设备和所有交互。 | `qa/browser-acceptance-upload-scroll.json` |
| 取消 | 正式上传页点击 Cancel 后约 356ms 返回可选文件状态；无文件名、行数或预览，本次内存会话清空。另在实际 Worker 首次 parse 进度事件处中止，未得到加载结果。 | `qa/browser-acceptance-upload-cancel.json`；`qa/browser-acceptance-download.json` |
| 超限拒绝 | 10 MiB + 1 字节返回 FILE_TOO_LARGE；100,001 行返回 ROW_LIMIT_EXCEEDED。 | `qa/browser-acceptance-download.json` |
| 模型真实运行 | 使用已安装的本地模型完成实际推理；不自动确认任何字段。模型权重及运行库均由本机应用提供。 | `qa/browser-acceptance-normal-model.json` |
| 模型 HTTP 503 回退 | 测试服务器仅对模型文件返回真实 HTTP 503，未使用假评分器。8 条测试记录仍保留，自动确认数为 0；手动匹配日期后 8 条均可使用，无需重新上传。正式映射页也用 1,226 条项目样例验证了失败提示、必填列清空时禁止继续及重新选择后继续至就绪。 | `qa/browser-acceptance-model-failure-final.json`；`qa/browser-acceptance-ui-model-recovery.json` |
| 数据外发检查 | 记录实际语义 Worker 的 fetch 参数及回环验收服务器请求。正常和模型失败场景均检查 URL、请求头和请求体中的测试表头/商品值；未发现测试数据外发。成功路径的模型与 WASM 请求为同一应用来源。此记录不是完整浏览器 HAR。 | `qa/browser-acceptance-network-summary.json`；对应 JSON/HTTP JSONL |
| 三语及布局 | 上传、映射、就绪、采购四个页面 × 英/中/马三语 × 390/1280px，共 24 组。实际 DOM 检查未发现页面横向溢出或按钮文字裁切，并查看截图。覆盖了展开的存储说明；未穷举所有跨 Epic 对话框、错误和空状态。 | `qa/browser-acceptance-languages.json`；手机及桌面 JPG |

容量测试使用真实业务引擎和 Worker。专用服务器在 `/samples/sample_with_issues.csv` 提供合成大样例，使正式 UploadScreen 的读取、进度、取消及映射可以验证。没有改写生产样例，也没有把该方式当成 Chrome 原生文件选择器验收。

## 本次实测发现并修正的问题

- 补充非 Impact 页的动态语言文本：处理百分比、等待秒数、商品位置、库存年龄、需求区间依据、估算/不可用状态、保存决策按钮及辅助标签等。
- 采购页手机紧凑标题曾隐藏返回和下载按钮。展开较长存储说明后，滚动到按钮时触发紧凑模式，导致无法点击。已去掉采购页该隐藏规则，按原场景验证返回成功。
- Transformers 默认使用 CDN 提供 ONNX WASM。虽然原请求没有数据内容，仍与“只请求应用自身文件和模型文件”的口径不完全一致。现在将安装依赖中的 WASM 和模块作为 Vite 资源构建，显式指定同源地址；真实模型成功运行已复测。没有添加远程推理 API。

主要改动：`frontend/src/i18n/epic123.ts`、`App.tsx`、`purchase-plan/purchase-plan.css`、`workers/semantic.worker.ts`、`vite.config.ts`。验收工具独立于应用入口，未包含在生产页面中。

## 仍缺什么

1. **真实文件及人工正确列答案**：用户已回答“没有”。US1.4 AC7 的至少 12 份真实 CSV 基准、真实 XLS/XLSX 导出格式适应性无法用虚构文件替代。一份文件即可开始功能检查；12 份是正式基准规模。
2. **Chrome 原生文件选择器路径**：自动上传被 Chrome 扩展的文件 URL 访问权限限制，本次没有扩大权限。此前 XLSX 文件选择/工作表/映射验收来自应用内浏览器；本次普通 Chrome 的大样例通过专用样例入口进入真实上传页面。要补齐原生选择器路径，可在 Chrome 手动选择现有测试包文件，或另行明确授权扩展文件访问权限。
3. **完整流量及其他环境**：现有证据包含模型 Worker fetch 和本地服务器请求，不是全浏览器、所有传输通道的 HAR。尚未关闭用户整个 Chrome 进程来测试浏览器进程重启；已验证的是刷新和关闭重开标签页。其他浏览器及全部跨 Epic 状态不据此宣称通过。
4. **Impact Dashboard 及 Step 4/5 金额一致性**：继续按用户此前明确要求暂缓。Impact 页面、专属 CSS 和全局 styles.css 没有本次改动；首页及全部跨 Epic 视觉标准也不能由 24 组核心页面检查替代。

## 复现入口

在 `frontend` 目录执行，均仅监听本机回环地址：

```sh
node scripts/acceptance-server.mjs
```

访问 `http://localhost:5174/qa/browser-acceptance.html`，执行保存、恢复、容量、取消、超限、模型失败及手动匹配按钮。模型失败仅作用于此 QA 服务器。

```sh
STOCKLESS_QA_MODEL_MODE=normal node scripts/acceptance-server.mjs
```

访问 `http://127.0.0.1:5175/qa/browser-acceptance.html` 检查真实本地模型；正常模式要求模型推理确实成功，否则显示 FAIL。

```sh
STOCKLESS_QA_SAMPLE=boundary node scripts/acceptance-server.mjs
```

访问 `http://localhost:5176/#workspace`，点 Use sample file，检查正式上传页的 10 MiB / 100,000 行大样例与 Cancel。该模式输入明确为合成数据，仅用于验收。

## 回归检查

后端 57/57，前端 87/87（17 个文件），存储/路由 3/3；前后端 TypeScript、生产构建和 `git diff --check` 通过。测试环境的 `scrollTo` 未实现提示不是失败；滚动/手机返回行为以 Chrome 实测为据。验收证据已保存于 `qa/`；版本状态以 Git 提交记录为准。本次未部署。

公开的 QA JSON/JSONL 中，本机仓库绝对路径替换为 `/__REPOSITORY__`，其余请求来源、方法、状态及测试结果保留。该占位符仅用于记录展示。
