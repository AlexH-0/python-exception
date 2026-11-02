# 发布指南

公开分发单位是导出的源码目录或ZIP，而不是个人开发目录及其全部历史。

1. 在准备好的项目中运行内容检查、必要测试和构建；涉及Python配套时先package:python。
2. 执行 `npm run release:source`。默认输出release/exception-lab-1.0.0及同名ZIP。目标已存在时工具会停止；使用 `npm run release:source -- --output release/另一个名称` 生成新目录，不覆盖旧交付。
3. 查看目录内README、LICENSE、docs/QA_RELEASE.md和RELEASE_MANIFEST.json。后者给出各源码与成品文件的SHA-256（清单自身除外）；压缩包旁附整个ZIP的SHA-256。
4. 把该目录作为新仓库起点，在其中执行git init、git add、git commit；在自己的GitHub账号下创建空仓库，再按GitHub提供的命令添加remote并推送。不要把旧个人工作仓库的历史直接附上。
5. 首次远程CI需实际运行并检查。可以把独立index.html和源码ZIP附在Release中；首次发布前补齐仓库简介、主题和当前验收说明。

公开源码仓库：https://github.com/AlexH-0/exception-lab 。源码发布与网站部署是独立步骤；本项目未部署在线站点。源码使用MIT，内嵌字体与依赖保留各自声明。

## 导出范围

工具按清单复制源码、必要脚本、测试、审核后的视觉基准、公开说明和构建入口。排除依赖目录、解释器、缓存、测试日志、个人提示词、内部工作记录及Git历史；开发原件不删除。导出后检查单文件可用、相对路径、下载包、许可及可疑凭据/个人路径。

## 当前验证边界

以QA_RELEASE.md为准。Windows的结果不等于macOS/Linux实机结果；CI声明尚未运行不代表通过。不要为发布文案夸大浏览器、平台或完整可访问性认证范围。
