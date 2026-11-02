const maps: Record<string, { title: string; nodes: string[]; note: string }> = {
  '01': { title: '从 traceback 找到失败现场', nodes: ['最外层调用', '内层函数', '失败表达式', '异常类型：消息'], note: '普通 traceback 按调用方向列出帧。先读最后一行确认异常，再向上查相关调用；异常链会分成多个 traceback。' },
  '02': { title: '四个子句各管一段路径', nodes: ['try：执行受保护代码', 'except：首次匹配才处理', 'else：try 正常走完', 'finally：退出前清理'], note: 'except 与 else 不是顺序必经站。try 以异常、return、break 或 continue 离开时，else 不执行。finally 后仍可能传播异常。' },
  '03': { title: '退出原因也可能被清理代码改变', nodes: ['待返回 / 待传播', '进入 finally', '清理正常：继续原退出', '新 return / 异常：改写退出'], note: '不要在 finally 中 return。清理代码再次抛异常时，原异常可留在 __context__；进程被强制结束不保证清理执行。' },
  '04': { title: '沿调用关系寻找处理者', nodes: ['读任务 read()', '解析 parse()', '执行 run()', '应用边界报告'], note: '异常从失败帧向外寻找匹配处理器。每个离开的帧先执行相应清理；调用栈显示当前发生了什么，传播方向与调用方向相反。' },
  '05': { title: '异常继承树（节选）', nodes: ['BaseException', 'Exception → ValueError / OSError…', 'KeyboardInterrupt / SystemExit', 'GeneratorExit / CancelledError'], note: '后三类特殊退出与 asyncio.CancelledError 不属于 Exception。普通业务异常通常继承 Exception；裸 except 的匹配范围更宽。' },
  '06': { title: '显示与对象信息分开看', nodes: ['__context__：处理中的异常', '__cause__：显式原因', '__suppress_context__：抑制显示', 'traceback：出错调用位置'], note: 'from None 改变默认异常展示，旧异常仍可通过 __context__ 访问。显式 cause 优先展示。' },
  '07': { title: '跨越边界时保持可诊断', nodes: ['底层异常', '边界转换', '稳定业务异常', '调用者决定恢复'], note: '只转换自己能解释的底层失败，保留 cause；程序缺陷不能伪装成可重试业务失败。' },
  '08': { title: 'with 的进入与退出协议', nodes: ['调用 __enter__', '成功后进入代码块', '调用 __exit__', '异常抑制或继续传播'], note: '__enter__ 自身失败时不调用该管理器的 __exit__。__exit__ 接收异常信息，可返回真值抑制代码块异常；其自身异常仍可传播。' },
  '09': { title: '把猜测变成可验证的证据', nodes: ['复现固定输入', '检查类型与 traceback', '在边界记录日志', '为失败路径写断言'], note: '错误消息需要上下文。logger.exception 在异常处理期间记录 traceback；测试既要证明抛出，也要证明副作用与清理。' },
  '10': { title: '每次重试前都要有理由', nodes: ['失败是否暂时', '操作是否可安全重复', '次数与退避上限', '耗尽后报告失败'], note: '重试不能修复坏输入；幂等性需要业务设计。成功缓存、去重键或事务有各自边界，不能假设任意副作用可撤销。' },
  '11': { title: '一组失败可以分开处理', nodes: ['原异常组（保留嵌套）', 'except* 匹配子组', '剩余子组继续匹配', '未处理部分向外传播'], note: '多个 except* 分支可以运行。TaskGroup 会取消其他任务并等待清理，随后汇总非取消异常；不能依赖任意并发打印顺序。' },
  '12': { title: '任务处理器的错误边界', nodes: ['读取与校验', '分类并逐任务运行', '有限重试与去重', '汇总成功和失败'], note: '输入格式错误与任务执行失败分层处理。验收要覆盖部分成功、重复执行、永久失败、取消及资源清理。' },
};
export default function ConceptMap({ id }: { id: string }) {
  const map = maps[id]; if (!map) return null;
  return <figure className="concept-map"><figcaption>{map.title}</figcaption><ol>{map.nodes.map((node,i) => <li key={node}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{node}</li>)}</ol><p>{map.note}</p></figure>;
}
