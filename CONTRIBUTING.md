# 参与修改

先按README配置开发环境。当前课程可以在浏览器中离线使用，无需账号或密钥。

## 文件位置

- src/content/chapters.ts：课程元数据、36题及本地练习契约。
- src/ChapterOne.tsx至ChapterTwelve.tsx：各章专题交互；GuidedChapter.tsx共享逐节组织，第二章保留独立组件。
- src/CourseNavigation.tsx、ChapterNavigation.tsx：课程目录与章间导航。
- python/semantics：生成33组完整轨迹及专题结果。src/data保存已核验数据。
- python/exercises、python/solutions、python/task_processor：练习、参考实现与综合项目。
- tests/web、tests/python、tests/e2e：网页逻辑、Python语义和浏览器行为。
- app.html是开发模板，index.html是构建产物，不直接修改。

## 内容与验证

一节围绕一个问题，文字自然简短。不要把制作说明塞入学习页。交互随概念选择，不强制套同一种播放器。错误反例需明确标识，并与正常状态分开。

Python行为必须有可运行证据；新增交互使用有限的已验证输入。开放编程题不得用关键词匹配判断通过。语义限定、版本差异与模拟边界要写清楚。

按改动选择检查：内容核对和构建；逻辑修改加相关单元/集成测试；交互修改加相应桌面/窄屏流程；数据修改用固定Python版本核对生成结果。Python配套变化后先package:python再build。无需为纯文案修改重复无关的全量测试。

视觉基准目前为Windows Edge。`npm run test:visual -- --update-snapshots`只生成候选，必须先实看、解释变化并提交，再运行不带update的比较。跨平台不能机械复用不同字体渲染器的像素基准。

## 提交

说明具体问题、最终行为、实际验证与未覆盖范围。不得降低断言来掩盖产品故障；测试入口过时则按真实操作更新。贡献原创代码与内容时按项目MIT许可提交，外部素材保留其原有许可与来源。
