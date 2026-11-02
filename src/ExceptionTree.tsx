interface Tree { type: string; message: string; children?: Tree[] }
function validTree(node: unknown, depth = 0): node is Tree {
  if (!node || typeof node !== 'object' || depth > 12) return false;
  const n = node as Partial<Tree>;
  return typeof n.type === 'string' && typeof n.message === 'string' && (!n.children || (Array.isArray(n.children) && n.children.every(child => validTree(child, depth + 1))));
}
function Branch({node}: {node: Tree}) {
  return <li><div className={node.children ? 'group-node' : 'leaf-node'}><strong>{node.type}</strong><span>{node.message}</span></div>{node.children && <ul>{node.children.map((child,i)=><Branch key={i} node={child}/>)}</ul>}</li>;
}
export default function ExceptionTree({state}: {state: Record<string,string>}) {
  const trees = Object.entries(state).filter(([key])=>key.endsWith('.tree')).flatMap(([key,value])=>{
    try { const node:unknown=JSON.parse(value); return validTree(node) ? [{key,node}] : []; } catch {return [];}
  });
  if(!trees.length)return null;
  return <div className="exception-trees"><h4>异常组结构 · 当前帧的真实对象</h4>{trees.map(({key,node})=><figure key={key}><figcaption>{key.replace(/\.tree$/,'')}</figcaption><ul aria-label={key+' 嵌套结构'}><Branch node={node}/></ul></figure>)}<p>缩进表示组的嵌套，叶子是具体异常。各变量可指向原组、匹配组或残留组，按代码中的绑定区分。</p></div>;
}
