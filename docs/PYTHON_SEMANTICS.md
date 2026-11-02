# Python 语义与真实执行证据

## 基线与复现

交付基线：Windows、CPython **3.11.15**、pytest **9.1.1**。完整数据比对固定该补丁版本；开发者按 README 创建自己的虚拟环境，不随源码分发解释器。最初第一章曾在已装 3.12.13 验证，最终全部轨迹已由 3.11.15 重新生成；不将早期版本元数据留作基线。

2026-10-23 实际执行：

```text
.venv/Scripts/python.exe -m python.semantics.generate
Generated 29 scenarios with Python 3.11.15

.venv/Scripts/python.exe -m pytest -q tests/python/test_semantics.py tests/python/test_processor.py tests/python/test_exercises.py
62 passed

.venv/Scripts/python.exe -m python.semantics.generate --check
Verified 29 real Python scenarios

.venv/Scripts/python.exe -m python.task_processor
first: done 42; second: done 10; first: cached 42 (实际命令输出为 JSON)
```

62 项是本文件作者负责的语义/项目/练习测试，不包含内容示例测试，完整集成结果以 QA_REPORT 为准。沙箱首次运行 pytest 时，Windows 拒绝访问 pytest 私有临时目录；通过工具自动审批在正常文件权限下重跑成功。该故障不属于课程语义测试失败。独立审查发现异步扩展的重复 ID 会被结果字典覆盖，现已在启动任务前拒绝所有重复 ID，且同值/异值两种测试均通过；同步版仍遵守同输入复用、冲突输入拒绝的缓存契约。

练习开关另行核验：`COURSE_IMPL=exercises` 运行 ch01 测试时，未填写的 stub 实际产生 4 个 NotImplementedError 失败；清除开关后参考解答通过。这证明网页所推荐的学习者命令没有偷偷验证 solutions。此有意失败不计为交付失败项。

## 真值生成与显示约定

来源链是 `scenarios.py` 的受信任固定代码 → CPython `exec(compile(...))` → `sys.settrace`、stdout 捕获 → `traces.json` → 网页逐步播放。源码、累计输出、行号、帧名称、简单变量快照、异常链属性和异常组树均来自执行；教学说明另行编写。测试既比较完整 JSON 轨迹，也独立断言语言行为，避免仅由生成器与自身互相证明。

`line` 事件发生在执行行之前，不能解读成该行已执行完毕。`call`/`return` 也涉及生成器及协程恢复/挂起；异常展开的 return 事件不等于正常函数返回。`trace.return_arg` 记录追踪 API 给出的参数，不据此虚构正常返回。模块入口追踪行号 0 映射到第 1 行以支持编辑器高亮；输出经 ExitStack 回调产生时定位到最近课程帧。依据：[3.11 sys.settrace](https://docs.python.org/3.11/library/sys.html#sys.settrace)。

不序列化对象内存地址、系统文件路径或任意对象 repr。`state` 是供网页显示的字符串映射；异常 `.tree` 字段是结构化树的 JSON 文本，保留子组嵌套；cause/context/suppress 来自实际对象属性。调用栈仅含当前可见的课程物理帧，异步部分不宣称它等同完整逻辑 await 链。时间依赖以 asyncio.Event 同步消除，不用固定延迟猜测谁先执行。

## 核心覆盖及依据

| 行为 | 场景 ID / 独立测试 | 官方依据 |
|---|---|---|
| 转换失败后不再执行下一行 | `01-errors` | [3.11 异常教程](https://docs.python.org/3.11/tutorial/errors.html) |
| 类匹配、else 正常条件、else 中异常不由同组 except 捕获 | `02-match-normal/error/else-error`；五种控制转移参数化测试 | [3.11 try 语句](https://docs.python.org/3.11/reference/compound_stmts.html#the-try-statement) |
| finally 在正常/异常/return/break/continue 路径；返回/异常覆盖 | `03-finally-*`；return-over-return、return-over-error、error-over-return 及 context 断言 | [3.11 finally](https://docs.python.org/3.11/reference/compound_stmts.html#finally-clause) |
| 内层先清理，再外层清理和捕获 | `04-stack`；帧名称与清理顺序断言 | [3.11 教程](https://docs.python.org/3.11/tutorial/errors.html#handling-exceptions) |
| Exception 与 BaseException 捕获边界 | `05-hierarchy`；练习 05，BaseExceptionGroup 测试 | [3.11 内置异常](https://docs.python.org/3.11/library/exceptions.html#exception-hierarchy) |
| 隐式/显式/隐藏链，裸 raise，add_note | `06-chain/06-chain-none/06-reraise`；属性、对象身份和默认格式化断言 | [3.11 异常上下文](https://docs.python.org/3.11/library/exceptions.html#exception-context) |
| 业务异常转换、严格输入校验 | `07-contract`；JSON cause、bool 拒绝、非法字段 | [3.11 用户异常](https://docs.python.org/3.11/tutorial/errors.html#user-defined-exceptions) |
| enter 失败不 exit；exit 条件抑制；ExitStack LIFO | `08-with/08-enter-fail/08-exitstack`；真实资源事件测试 | [3.11 with](https://docs.python.org/3.11/reference/compound_stmts.html#the-with-statement)、[ExitStack](https://docs.python.org/3.11/library/contextlib.html#contextlib.ExitStack) |
| traceback、logger.exception、pytest.raises | `09-diagnose`；日志 exc_info 与 traceback 帧断言 | [traceback](https://docs.python.org/3.11/library/traceback.html)、[logging](https://docs.python.org/3.11/library/logging.html#logging.Logger.exception) |
| 有限重试、退避、幂等与部分失败 | `10-retry/12-project`；调用次数、提交字典、冲突检查、永久失败、控制流传播 | 项目明确的工程契约，非 Python 语言自动保证 |
| 多分支 except*、残留、嵌套、BaseExceptionGroup 自动类型 | `11-group/11-group-residual/11-group-nested`；叶子身份及嵌套路径断言 | [PEP 654](https://peps.python.org/pep-0654/) |
| CancelledError 基类；取消清理；TaskGroup 等待、取消与聚合 | `11-cancel/11-taskgroup`；Event 同步测试；清理异常参与聚合 | [3.11 取消与 TaskGroup](https://docs.python.org/3.11/library/asyncio-task.html#task-cancellation) |
| 生成器 StopIteration 转 RuntimeError；close 和 return value | `11-generator`；cause、清理、StopIteration.value 断言 | [PEP 479](https://peps.python.org/pep-0479/) |

## 次版本差异

- 课程使用的 ExceptionGroup、except*、TaskGroup 和 add_note 均以 3.11 为最低版本。CancelledError 从 3.8 起归 BaseException；本课不对 3.7 作兼容承诺。
- 3.13 改进 TaskGroup 内外同时取消时的处理与取消计数保持。当前场景只覆盖明确的单次取消和同伴失败，不把 3.13 的改进说成 3.11 已完整具备。[3.13 TaskGroup](https://docs.python.org/3.13/library/asyncio-task.html#task-groups)
- 3.13 起，生成器 close 时若捕获 GeneratorExit 并返回值，close 可返回该值。当前 3.11 场景没有依赖这一新行为。[3.13 generator.close](https://docs.python.org/3.13/reference/expressions.html#generator.close)
- 3.14 对离开 finally 的 return/break/continue 发出 SyntaxWarning。本课将 `finally return` 作为危险反例，基线 3.11 不产生该警告。[3.14 finally](https://docs.python.org/3.14/reference/compound_stmts.html#finally-clause)
- 逐行追踪是 CPython 工具接口，次版本可能产生不同事件序列。完整 `--check` 使用 3.11 基线；不要为消除其他版本差异随意覆盖网页真值。若扩展版本矩阵，先对输出、异常对象与行为断言验证，再单独审查事件差异。上述 3.13/3.14 差异本次已核对官方文档，未宣称在那些版本全部运行测试。

## 当前边界

没有任意代码浏览器执行、线程或多进程调度模拟、外部网络重试、持久化幂等数据库或进程崩溃事务。TaskGroup 的 KeyboardInterrupt/SystemExit 特殊传播由官方文档说明，本轮测试不在事件循环中注入这些进程控制异常；对 BaseException 捕获边界有独立测试。未穷举 except* 处理器重新抛出与新异常合并的所有组合，也不覆盖同时多次外部取消。遇到新增场景，先加真实脚本与断言，再开放 UI 变量。

## 2026-10-26 短课增补

第三章新增03-result-keep、03-result-replace、03-result-fail、03-error-replace四个简短脚本；总轨迹数从29变为33。CPython3.11.15生成。tests/python/test_guided_lessons.py独立断言新脚本的输出顺序和最终异常；与finally/else相关的局部检查共11项通过，未为这次内容改造重复运行整个工程测试矩阵。

第三章“待交付卡片”是控制流教学图，不是对象内存图。清理开始、输出发生、最终结果的状态分别对应真实轨迹事件。第四章直接复用04-stack；活动帧来自事件stack，已退出帧以虚线表示。traceback点读图从异常经过的调用位置反向排列，明确注明脚本在外层已捕获，因此不是冒充终端自动打印的未捕获traceback。

官方依据仍为[Python3.11 finally规则](https://docs.python.org/3.11/reference/compound_stmts.html#finally-clause)。本轮在线文档显示3.11.17修订版，实际生成与测试环境仍固定3.11.15；没有将新版本运行结果混入基线。

## 第五、六章的有限对照数据（2026-10-27）

原有33组事件轨迹保持不变，另增加两份专题数据：

- hierarchy.json：由 hierarchy.py 读取15个内置异常的 __bases__，并用 issubclass 生成4种处理器的匹配范围。页面只展示常见类型的子集，不代表完整异常体系。
- chaining.json：由 chaining.py 实际执行隐式链、显式链、from None、三种重抛与四种备注组合。记录对象身份、cause/context/suppress、真实 traceback 的课程帧，以及标准库格式化的异常摘要。

from None 抑制默认展示，未删除 __context__。裸 raise 保留原 traceback；raise error 在本例增加当前重抛位置，仍是同一异常对象。add_note 不改变类型与 args。页面将调用帧与异常摘要分开呈现，并明确标注省略调用帧；不将摘要冒充完整终端输出。

新增4项独立Python断言覆盖上述语义。两份JSON与生成器均随Python配套包交付；浏览器只在固定组合之间切换。

## 第七章：接口契约与吞错对照（2026-10-29）

python/semantics/contracts.py实际执行5个固定输入×2个submit实现，生成contracts.json。正常实现保留返回或传播异常；错误实现捕获Exception并返回0。测试独立断言：坏JSON的TaskInputError及JSONDecodeError原因；吞错与合法零返回结果完全一致；TypeError继续传播/被吞；布尔值不作为整数接受；双语消息的结构化字段保持稳定，构造器拒绝不合法属性。

网页的异常区域是外层观察器的摘要，不是完整终端traceback。对照提示中的“正常版本会抛出”来自另一次相同输入的真实运行，不声称错误版本仍报告了异常。bug=True只触发固定的错误语句；不是任意故障注入。教学类与配套项目InputError是不同模块中的类型。

运行基线CPython3.11.15；参考[Python3.11自定义异常](https://docs.python.org/3.11/tutorial/errors.html#user-defined-exceptions)及同页异常转换说明。网页文档当前标记3.11.18，运行数据未混入其他版本。3项局部pytest通过，独立审查者完成10种结果和2组属性的--check。此轮未重复无关Python场景。


## 第八章：进入边界、退出参数与清理栈（2026-10-31）

python/semantics/resources.py生成resources.json共11个真实结果：进入成功/失败2种；正常/ValueError/TypeError乘两种退出策略6种；ExitStack全部成功/B进入失败/块内失败3种。原33组逐行事件轨迹保持不变。网页只是回放，不运行任意Python。

Resource为教学管理器，不打开真实文件。emit打印并记录事件；registered是教学记录，不是读取ExitStack私有栈。enter_context返回后追加记录，__exit__移除记录；因此进入成功与登记各有一个可观察节点。真实的退出调用及顺序来自Python的with/ExitStack。exits记录实际收到的异常三参数与返回值；traceback仅展示是否存在，不编造路径或内存地址。

条件抑制使用精确类型比较（kind is ValueError），不含其子类；contextlib.suppress使用类型及子类匹配，页面明确区分。抑制之后with体剩余代码不会恢复。退出方法自身抛错仍传播；五项新测试还验证正常return不受退出真值取消。第八章既有文件示例和本地练习另作局部复验。

基线CPython3.11.15；本次核对[Python3.11 with规范](https://docs.python.org/3.11/reference/compound_stmts.html#the-with-statement)和[contextlib](https://docs.python.org/3.11/library/contextlib.html#contextlib.ExitStack)，在线文档标记3.11.18。未混用其他Python版本数据。内层抑制/替换异常会改变外层收到的异常状态，正文作说明；本轮ExitStack交互不扩展该组合。下载包包含生成器、JSON及测试。


## 第九章：诊断与真实测试对照（2026-10-31）

python/semantics/diagnostics.py生成diagnostics.json：一条ValueError的四个真实脚本帧；三种日志策略；三个固定实现乘三套pytest测试共九组实际执行结果。原33组完整逐行轨迹保持不变，09-diagnose仍可自由实验。

trace帧取自实际异常__traceback__，只保留虚拟文件chapter09.py的帧，源码行与真实行号对应。日志使用临时内存Handler和Formatter，普通error只记录消息；exception附加实际exc_info；记录后裸raise继续传播。afterHandler标记在整个try/except之后执行，重抛分支不会到达。logger及linecache的临时配置在采集后恢复。日志不含本机路径、令牌或完整业务输入。

测试对照真实调用本机Python的pytest进程，临时目录运行，禁用自动第三方插件及缓存。success只测合法输入，type只测坏字符串的领域异常，contract检查成功、错误task_id/显式cause及bool拒绝。correct三套通过；两个缺陷实现均被前两套遗漏、被contract分别发现一项。通过/失败计数和退出码来自实际pytest摘要，不是前端推测或关键词评分。页面不执行任意代码，也不为学习者开放题自动评分。

基线CPython3.11.15及pytest9.1.1，下载包requirements固定相同pytest版本。官方依据：[Python3.11 traceback](https://docs.python.org/3.11/library/traceback.html#traceback.extract_tb)、[logging](https://docs.python.org/3.11/library/logging.html#logging.Logger.exception)、[pytest异常断言](https://docs.pytest.org/en/stable/how-to/assert.html#assertions-about-expected-exceptions)。Python在线文档为3.11.18修订版，实际数据未混入其他运行版本。三套有限测试不代表穷举所有输入；日志配置故障、其他Handler组合及跨版本矩阵不在本轮范围。


## 第十章：重试与状态效果（2026-10-31）

python/semantics/reliability.py使用同一份完整展示脚本实际exec生成reliability.json，基线CPython3.11.15。8个重试计划（4种操作×2/3次上限）、3种确认丢失场景、3种部分成功策略，共14个有限结果；原33组逐行轨迹不改，10-retry继续作为自由实验。

重试直接导入python/solutions/ch10.py的retry和真实项目异常。sleep参数只记录0.01/0.02，不等待；操作次数、最后异常对象身份、是否耗尽均来自实际执行。PermanentError和TypeError不匹配TransientError，不会被重试。attempts包括首次执行；次数用完的那次没有额外等待。类型标签是本项目应用契约，并不证明任意同名故障都可恢复。

接收端在内存记录效果后才模拟确认丢失；稳定键及相同负载只追加一次，换键/不去重各两次。同键不同负载另真实拒绝。此模型明确无网络、无崩溃/并发，没有客户端成功后缓存足以解决重复副作用的假设。

部分成功的failure快照在通知已经实际抛错、包装operation捕获后记录，再裸raise交给重试；final在重试返回或外层捕获后记录。restart重复保存2次，resume只保存1次，两者最终通知成功；still-fails保留1次保存但最终通知仍失败。内存检查点不承诺事务、持久化或跨系统原子性。

测试独立断言上述变量与14个结果、JSON全比，并编译全部展示脚本、从项目根独立执行一个导入样本。官方Python依据仍为[3.11异常处理](https://docs.python.org/3.11/tutorial/errors.html#handling-exceptions)。超时/重试/退避与幂等的工程背景核对[AWS Builders Library](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)；具体状态保证属于本课显式案例契约，并非Python提供的自动保证。单次超时、总耗时、抖动/退避上限在正文说明，不模拟真实调度。


## 第十一章：异常组、取消与关闭（2026-10-31）

python/semantics/concurrency.py实际exec同一份完整展示代码，生成concurrency.json。共14个有限结果：3种split类型、4种except路由、2种取消处理、2种TaskGroup清理、3种生成器终点。原六组11自由轨迹和总33组逐行轨迹不改。

树直接递归序列化真实异常实例，保留组的str消息与嵌套路径。split也检查组对象；本例Exception直接匹配外层组，不能把split概括为只匹配叶子。ordinary通过内层except ValueError不匹配后到外层except ExceptionGroup；star分支记录真实捕获子组，未匹配KeyError由外层观察，未用split假装执行except*。

取消场景以Event确认worker已等待后调用cancel。正常版含except Exception但不命中CancelledError；错误副本捕获取消并返回pretend success。两者finally均执行，最终task.cancelled分别True/False。事件是实际顺序，浏览器只回放，不创建异步任务。

TaskGroup通过Event保证同伴先就绪、失败任务再抛错、同伴清理、外层收到组的因果顺序。正常同伴以取消结束，组叶子只有ValueError；清理抛RuntimeError时同伴done=True、cancelled=False，组保留ValueError与RuntimeError。测试按集合断言多失败类型，不泛化聚合成员或任意调度顺序。

生成器先next到yield open，再分别return9、意外StopIteration、close。正常耗尽的StopIteration.value为9，内部StopIteration逃逸变RuntimeError并保留cause；close观察GeneratorExit并清理，3.11返回None。原BaseExceptionGroup构造与捕获边界另用既有独立测试核对。

运行基线CPython3.11.15；在线3.11文档为3.11.18修订版。官方依据：[except*](https://docs.python.org/3.11/reference/compound_stmts.html#except-star)、[TaskGroup](https://docs.python.org/3.11/library/asyncio-task.html#task-groups)、[取消](https://docs.python.org/3.11/library/asyncio-task.html#task-cancellation)、[PEP479](https://peps.python.org/pep-0479/)。不混用3.13同时取消/关闭返回值行为；不测试所有except*重抛合并、同时多次外部取消或吞取消后的无限任务。


## 第十二章：真实处理器集成观察（2026-10-31）

python/semantics/project.py导入已有parse_tasks/Processor/Task/Result，不重建或修改处理器。展示脚本实际exec，Result用dataclasses.asdict序列化，生成project.json共11条有限观察（输入3、执行3、缓存3、真实CLI2）。原12-project自由轨迹仍为最小隔离示例，总33逐行轨迹不变。

输入整批通过才调用worker；坏JSON保留JSONDecodeError cause，后续任务bool类型非法时零调用且有task index备注。执行期PermanentError隔离，TransientError次数耗尽后隔离；未知TypeError中断process_batch，不返回结果列表，但a的成功缓存仍存在。教学外层捕获TypeError只为观察，不是Processor的恢复契约。

done.attempts包含成功那次；cached/failed使用默认0，不能据此推断历史真实调用0次。调用顺序/等待由注入的纯计算worker及sleep记录。相同id/value命中当前实例缓存；冲突InputError成为failed，旧缓存不覆盖；两个新实例各执行一次。无结果写回JSON或其他结果文件，没有跨进程/跨运行幂等承诺。

CLI实际子进程默认读sample_tasks.json，输出done/done/cached，退出0；临时损坏JSON输入退出2，无结果stdout。只保留stderr最后行避免临时路径/行号，页面标明省略traceback；随包broken_tasks.sample.txt提供同类损坏输入以实际复现命令。默认CLI worker纯乘2，执行失败是前三节显式注入的教学worker，不暗示默认worker会拒绝负数。

基线CPython3.11.15。本项目代码及原处理器契约测试为直接证据，异常传播/清理参考[3.11教程](https://docs.python.org/3.11/tutorial/errors.html)；预检查与尝试后捕获的取舍参考[3.11 EAFP/LBYL术语](https://docs.python.org/3.11/glossary.html#term-EAFP)，不是Python自动恢复保证。临时文件在系统目录并正常清理，生成器不依赖未打包的.test-temp或本机绝对路径。

## 第一章：阶段、异常对象与入门回溯（2026-11-01）

python/semantics/foundations.py 在CPython3.11.15实际执行完整展示源码，生成foundations.json：3个整份源码结果（compile失败/执行失败/正常完成）、3个异常对象观察（ValueError/TypeError/KeyError），以及一条两帧回溯。它们是补充有限观察，不增加原33组逐行轨迹数量。

阶段观察器先compile，再执行通过编译的程序；捕获发生在外部，写坏的源码中没有能让它通过解析的except。syntax没有stdout，runtime仅before，valid为before及after 3。交互式逐句输入、导入文件与运行中调用compile各有编译边界，页面说明不把整份脚本结果泛化到所有环境。

异常对象的完整独立脚本在except内读取type/str/args/repr，KeyError的消息引号与元组显示来自真实对象。args是构造参数元组，不等同于通用消息协议。trace在教学源码内部捕获ValueError，再用extract_tb与format_exception提取；自然只有module和parse_count两帧，没有外部观察器帧。固定chapter01.py与临时linecache消除本机路径，并在finally恢复之前缓存。

依据：Python3.11教程errors、内置异常BaseException.args及traceback标准库。文档在线3.11分支当前是3.11.18，实际生成基线仍3.11.15，未混入3.12+特性，也未实机验证其他版本。test_foundations四项涵盖完整数据相等、阶段/输出、对象字段与KeyError引号、两帧与源码位置。原01-errors及原练习继续保留。
