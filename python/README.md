# Python 配套材料

在仓库根目录运行以下命令。推荐 Python 3.11；交付轨迹由 CPython 3.11.15 生成。代码不访问网络，也不需要 API 密钥。

```powershell
py -3.11 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m python.semantics.generate --check
.venv/Scripts/python.exe -m python.task_processor
```

已有项目内 `.venv` 时直接使用，不必重新创建。macOS/Linux 将 `.venv/Scripts/python.exe` 换成 `.venv/bin/python`。安装 pytest 是开发准备步骤；安装完成后，案例、练习与测试均可离线运行。完整逐事件轨迹比较使用 CPython 3.11；其他版本的追踪事件可能不同，见 `docs/PYTHON_SEMANTICS.md`。

## 做一章练习

网页中的预测题由网页评分；本地编程题必须运行真实 Python 测试。打开 `python/exercises/ch01.py`，按网页契约实现函数，然后运行：

```powershell
$env:COURSE_IMPL = 'exercises'
.venv/Scripts/python.exe -m pytest tests/python/test_exercises.py -k ch01 -q
Remove-Item Env:COURSE_IMPL
```

macOS/Linux：`COURSE_IMPL=exercises .venv/bin/python -m pytest tests/python/test_exercises.py -k ch01 -q`。

将 `ch01` 换成 `ch02` 至 `ch12`。学习者文件初始会抛出 `NotImplementedError`，因此首次测试失败是正常的，不代表课程自动验收失败。清除 `COURSE_IMPL` 后，测试默认验证 `python/solutions/` 的参考实现。测试按实际返回值、异常类型、异常链、调用次数、资源清理与传播结果评分，不扫描答案关键词。测试只覆盖列出的契约；通过测试后仍需读代码、解释边界。

| 章 | 函数 | 关键验收 |
|---|---|---|
| 01 | `parse_count(text)` | 转成整数，非法文本保留 ValueError |
| 02 | `read_key(mapping, key, default=None)` | 仅 KeyError 返回默认值，TypeError 传播 |
| 03 | `compute(events, fail=False)` | 记录 work；返回 2 或抛 ValueError("failed") 前记录 cleanup |
| 04 | `outer(text)` / `convert(text)` | 跨函数传播，traceback 保留 outer→convert |
| 05 | `classify(error)` | Exception 为 ordinary，其余 BaseException 为 control |
| 06 | `convert(text)` | ValueError 转成本模块 InputError，显式保留 cause |
| 07 | `validate_task(data)` | 仅 id/value，非空字符串 id、严格整数 value（拒绝 bool） |
| 08 | `managed(events, suppress=False)` | yield resource，open/close；仅按参数抑制 ValueError |
| 09 | `diagnose(operation)` | 正常 None，普通异常返回类型/消息并记录 exc_info，控制流异常传播 |
| 10 | `retry(operation, attempts=3, sleep=...)` | 仅暂时异常重试，延迟 0.01、0.02…；耗尽原异常传播 |
| 11 | `split_values(group)` | 匹配 ValueError 叶子，保留嵌套树与未匹配部分 |
| 12 | `run_batch(tasks, worker=None)` | 每任务隔离、同键同输入复用、失败继续；可复用 Processor |

## 真实轨迹

`python/semantics/scenarios.py` 保存可独立运行的代码字符串及教学说明。`generate.py` 用 `sys.settrace` 执行这些受信任的固定代码，捕获真实 stdout，然后生成 `src/data/traces.json`。这不是通用 Python 解释器或不可信代码沙箱。

```powershell
# 修改场景后生成新的候选真值，检查 git diff 并运行测试
.venv/Scripts/python.exe -m python.semantics.generate
.venv/Scripts/python.exe -m pytest tests/python/test_semantics.py -q
```

浏览器仅播放已经核验的轨迹，不能执行任意 Python。`line` 步骤在行执行之前；`output` 步骤在打印之后。协程的 call/return 也可能表示恢复/挂起。输出事件经标准库回调触发时，定位到最近的课程调用帧。

## 贯穿项目

```powershell
.venv/Scripts/python.exe -m python.task_processor
.venv/Scripts/python.exe -m python.task_processor python/task_processor/sample_tasks.json
```

输入是 JSON 数组：`[{"id":"first","value":21}]`。默认任务把 value 乘 2；输出含 `done`、`cached`、`failed` 状态。文件读取使用 `with`，文件与 JSON 错误转换成 `InputError` 并保留 cause。整批输入先完成格式校验，才开始执行；它不会把格式错误的半批数据偷偷执行。

`Processor.process_batch` 只隔离声明过的 `TaskError`；代码错误（例如 TypeError）、KeyboardInterrupt 和 SystemExit 继续传播，便于停止并诊断。暂时失败最多重试固定次数，注入 `sleep` 便于无等待测试；永久失败不重试。成功后才写入内存结果，同 id 同 value 复用结果，同 id 不同 value 拒绝。日志在异常处理器内通过 `logger.exception` 保留 traceback。

这份幂等记录只在当前 Processor 实例存活期间有效，没有磁盘持久化、跨进程锁或事务保证。worker 应为纯计算，或者自行提供幂等操作；处理器不能撤销已经发生的外部副作用。`async_example.process_group` 展示 TaskGroup 的整组快速失败策略，与同步版逐任务隔离策略不同：全部成功才返回字典；失败先取消并等待同伴，再传播异常组。异步批次要求 id 唯一，同值或异值的重复 id 均在启动任务前拒绝，以免结果字典覆盖数据；该扩展没有共享同步处理器的幂等缓存。示例不承诺任意调度顺序，也不把取消当成可重试故障。

## 家谱与异常链数据

第五、六章另用两份真实 Python 生成的数据。核对命令（Windows；其他系统使用 .venv/bin/python）：

```powershell
.venv/Scripts/python.exe -m python.semantics.hierarchy --check
.venv/Scripts/python.exe -m python.semantics.chaining --check
.venv/Scripts/python.exe -m pytest tests/python/test_hierarchy.py tests/python/test_chaining.py -q
```

去掉 --check 可重新生成候选数据。生成器与 JSON 均随下载包提供，需使用 CPython 3.11。家谱只列常见类型，异常链图只覆盖页面提供的有限组合。

## 接口契约与反例实验

第七章数据由真实Python生成，下载包包含源码、JSON和局部测试。五个输入各有正常/吞错两种实现；错误实现仅供比较。

```powershell
.venv/Scripts/python.exe -m python.semantics.contracts --check
.venv/Scripts/python.exe -m pytest tests/python/test_contracts.py -q
```

macOS/Linux使用 .venv/bin/python。去掉 --check 可重新生成候选数据。网页中的TaskInputError是独立教学类；编程练习仍使用python.task_processor.InputError和Task。


## 资源管理与清理栈数据

第八章的11个有限结果由真实Python生成：进入成功/失败、三种块体结果与两种退出策略、三种ExitStack路径。Resource只记录教学事件，不打开文件；文件与JSON错误路径见原08示例及测试。

```powershell
.venv/Scripts/python.exe -m python.semantics.resources --check
.venv/Scripts/python.exe -m pytest tests/python/test_resources.py -q
```

macOS/Linux使用.venv/bin/python。去掉--check可重新生成候选数据；与其他生成器一致，核对记录版本时使用CPython3.11.15。registered是教学事件记录，不是ExitStack的私有实现。测试另断言进入失败不退出、异常参数、条件抑制不重试与逆序清理。


## 诊断、日志与pytest测试对照

第九章下载资料含diagnostics.py、diagnostics.json及test_diagnostics.py。日志只在内存采集，traceback使用虚拟教学文件名。九组固定pytest结果由三个实现和三套测试实际运行产生；错误实现用于观察测试覆盖，不是建议写法。

```powershell
.venv/Scripts/python.exe -m python.semantics.diagnostics --check
.venv/Scripts/python.exe -m pytest tests/python/test_diagnostics.py -q
```

两条命令均会执行有限的九组pytest组合，通常选择一条即可核对；避免无改动重复运行。使用CPython3.11.15及requirements.txt的pytest9.1.1以复现精确版本记录，macOS/Linux使用.venv/bin/python。去掉--check可生成候选JSON；重新生成后需审查差异，不应直接覆盖其他版本基线。网页可展开当前完整测试文件，在本地保存运行；浏览器本身只回放已验证的计数，不判定任意代码。


## 有限重试、重复效果与部分成功

第十章reliability.py实际执行14个有限场景生成reliability.json。重试复用solutions/ch10.py，sleep只记参数不等待；接收端记录/检查点都在内存，不发网络请求或通知、不写业务文件。

```powershell
.venv/Scripts/python.exe -m python.semantics.reliability --check
.venv/Scripts/python.exe -m pytest tests/python/test_reliability.py -q -p no:cacheprovider
```

macOS/Linux使用.venv/bin/python。生成数据记录CPython3.11.15，精确版本比对使用该基线。去掉--check可重新生成候选数据。网页可展开完整代码，从解压目录根运行；数据与展示代码由同一脚本实际执行产生。稳定键模型不处理并发、崩溃或持久化事务；真实副作用不能靠本地成功结果缓存自动撤销。


## 异常组、取消与生成器关闭

第十一章concurrency.py使用实际Python异常、Event同步的asyncio任务以及生成器生成14条有限结果。所有协程任务均被等待，取消错误副本会返回并结束，不留下无限后台任务；不依赖毫秒sleep或网络。

```powershell
.venv/Scripts/python.exe -m python.semantics.concurrency --check
.venv/Scripts/python.exe -m pytest tests/python/test_concurrency.py -q -p no:cacheprovider
```

macOS/Linux使用.venv/bin/python。记录基线CPython3.11.15，其他版本的事件或版本字段不同不可直接覆盖课程数据。去掉--check可生成候选JSON，先审查差异。网页可展开产生数据的完整代码；异常树来自真实实例，TaskGroup多失败测试按类型集合核对。保留原六组11逐行轨迹，不将有限结果数混作逐行轨迹数。


## 综合项目观察与本地复现

第十二章project.py实际调用原处理器生成11条有限观察，未复制处理器逻辑。前三节的worker失败由脚本注入；CLI默认worker只把value乘2。运行下面命令可对照网页：

```powershell
.venv/Scripts/python.exe -m python.task_processor
.venv/Scripts/python.exe -m python.task_processor python/task_processor/broken_tasks.sample.txt
.venv/Scripts/python.exe -m pytest tests/python/test_project.py -q -p no:cacheprovider
```

第二条故意使用损坏JSON样本（内容为左花括号），预期退出码2、stderr有InputError和异常链、没有结果stdout；这次失败是输入边界教学案例。第一条预期退出0并输出done/done/cached。macOS/Linux改用.venv/bin/python。

project.py --check会重新核对11条记录（包括两个CLI子进程）；局部test_project.py也通过一次generate完成完整比对，通常任选一种即可，避免无改动重复。结果数据使用CPython3.11.15。缓存属于当前Processor实例，不是落盘结果；failed/cached的attempts默认0不代表真实调用0次。

## 第一章：真实阶段与异常对象

foundations.py生成有限阶段、对象和两帧回溯数据；它们来自Python，不在浏览器执行。可在项目根目录任选一种核对方式：

```powershell
.venv/Scripts/python.exe -m python.semantics.foundations --check
.venv/Scripts/python.exe -m pytest tests/python/test_foundations.py -q -p no:cacheprovider
```

macOS/Linux改用.venv/bin/python。数据基线CPython3.11.15，其他版本的消息或版本字段不同不能直接覆盖课程数据。语法错误案例是交给compile的源码字符串，不是损坏的生成器文件。回溯在教学源码内部捕获并格式化，固定教学文件名chapter01.py，不依赖本机路径；运行时输出不会自动修复或重试。
