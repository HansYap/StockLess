# Homepage 使用说明

新增首页沿用 Desktop.png 的白底、青绿色、橙色强调、产品预览、四列 Benefits、图片与文字分栏、比较表、SDG 区块和四步流程，并采用组员 PDF 中更具体的文案。

## 查看页面

- 项目首页：运行后访问 http://localhost:5173/。
- 原业务流程：http://localhost:5173/#workspace。首页的开始按钮均进入此流程。
- 独立 HTML：`output/StockLess-Homepage.html`，可双击打开。图片、CSS、React 和示例交互脚本已内嵌，查看首页不需要启动服务器。开始按钮会连接本机运行的完整项目，因此进入实际数据流程需要本地服务器。

在 `StockLess 2` 目录运行：

```sh
npm install
npm run dev --workspace stockless-frontend
```

当前上级目录 `i2 iteration UI:UX` 包含冒号：npm 的工具查找以及 Vite 开发模式会受此影响。新增启动脚本直接解析工具路径；在此路径运行 `dev` 会先构建再启动本地预览，修改代码后需要重新运行。放到不含冒号的目录后，`dev` 自动使用普通 Vite 热更新。没有关闭 Vite 的文件访问保护。

## 维护文件

- `frontend/src/screens/HomePage.tsx`：首页内容与独立采购示例。
- `frontend/src/homepage.css`：首页样式，使用 `sl-` 前缀隔离现有业务样式。
- `frontend/src/Site.tsx`：首页与业务页切换；打开过的业务页保持挂载，返回首页不会清除当前会话。
- `frontend/src/components/AppShell.tsx`：增加返回首页链接。
- `frontend/public/homepage/`：从用户提供的 PNG / PDF 提取的本地图片。
- `frontend/scripts/export-homepage.mjs`：从同一 React 首页组件导出独立 HTML，避免维护两份页面。

## 验证和重新导出

```sh
npm run typecheck --workspace stockless-frontend
npm run build
npm run export:homepage --workspace stockless-frontend
```

独立 HTML 默认连接 `http://localhost:5173/#workspace`。在导出时设置 `STOCKLESS_WORKSPACE_URL` 可改为其他已部署的项目地址。

## 内容取舍

- 采购滑块是明确标注的示例，不调用或替代实际 DemandScreen 的需求引擎。以库存 12 件、四周需求 28–36 件和每件 RM 4 演示采购计划变化。60 件改为 20 件时，少支出 RM 160，潜在剩余为 0–4 件，同时提示最高需求下可能缺货 4 件。支出减少不代表实测减废或利润提升。
- 采用 PDF 的标题、收益、比较维度与流程结构；将自动清洗承诺改为确认列与检查缺失值、日期，符合现有流程。
- PDF 的两项马来西亚统计缺少原始出处，暂用可链接核对的 UNEP 全球统计与 SDG 12.3 目标代替。页面提供原文链接，后续可在取得本地研究来源后换回。
- 保留减废问题图片，使用 PDF 建议的小商店陈列照片，并减少重复的浪费照片。
- ERP 和 Excel 比较采用按配置而异的描述，避免把某一产品的能力概括为整个类别。
- 修复原有 MappingScreen 遗漏的 MappingProposal 类型导入；补齐项目已声明但本机缺失的依赖，未更改业务算法。

## 已完成检查

- TypeScript 类型检查与 Vite 生产构建。
- 浏览器中首页进入上传页、返回首页、重新进入后保留示例 CSV 的字段匹配状态。
- 采购示例按钮、键盘方向键调整滑块和计算结果。
- 桌面 1440px、手机 390px 的布局和图片加载；手机页面不横向溢出，宽比较表在自身区域滚动。

本次未重新验证原业务的完整四步算法，也没有把首页示例当作真实产品效果验证。
