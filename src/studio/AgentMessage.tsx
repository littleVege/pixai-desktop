import { LoaderCircle, Check, CircleAlert } from 'lucide-react'
import Markdown from 'react-markdown'
import { studio, type StudioEntity } from './api'
import { Button } from '@/components/ui/button'

export function AgentMessage({ message, onError }: { message: StudioEntity; onError: (error: unknown) => void }) {
  const { data } = message
  if (data.type === 'promptFeedback') return <details className="text-sm">
    <summary className="cursor-pointer">{data.text}</summary>
    <p className="mt-2 whitespace-pre-wrap"><b>修改前</b><br />{data.before}</p>
    <p className="mt-2 whitespace-pre-wrap"><b>修改后</b><br />{data.after}</p>
  </details>
  if (data.type === 'saveProposal') {
    const target = data.target === 'preset' ? '生成预设' : '跨作品偏好'
    const respond = (accept: boolean) => void studio.confirmSave({ messageId: message.id, accept }).catch(onError)
    return <div className="space-y-2">
      <p>{target} · {data.text}</p>
      {data.status === 'pending'
        ? <div className="flex gap-2"><Button size="sm" onClick={() => respond(true)}>确认保存</Button><Button size="sm" variant="ghost" onClick={() => respond(false)}>跳过</Button></div>
        : <small className="text-muted-foreground">{data.status === 'accepted' ? '已保存' : '已跳过'}</small>}
    </div>
  }
  if (data.type === 'tool') return <details className="agent-tool">
    <summary>{data.status === 'running' ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : data.status === 'complete' ? <Check /> : <CircleAlert />}<span>{data.text}</span><small>{({ running: '执行中', complete: '完成', failed: '失败', interrupted: '已中断' })[data.status as string] ?? data.status}</small></summary>
    <p>调用参数</p><pre>{data.input}</pre>
    {data.result && <><p>执行结果</p><pre>{data.result}</pre></>}
  </details>
  return <div className={`agent-message ${data.role}`} aria-live={data.status === 'streaming' ? 'polite' : undefined}>
    {data.role === 'user' ? data.text : <div className="agent-markdown">
      <Markdown skipHtml components={{ img: () => null, a: ({ children }) => <span>{children}</span> }}>{data.text}</Markdown>
    </div>}
    {data.status === 'streaming' && <span className="text-muted-foreground"> ▍</span>}
    {data.status === 'interrupted' && <small className="block text-muted-foreground">回复已中断</small>}
  </div>
}
