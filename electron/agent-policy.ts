import type { Entity } from './store'

export function runJobs(jobs: Entity[], runId: string) {
  const own = jobs.filter(job => job.data.runId === runId)
  return {
    own,
    unknown: own.some(job => job.data.status === 'unknown'),
    pending: own.some(job => !['failed', 'unknown'].includes(String(job.data.status)) && job.data.saveStatus !== 'saved'),
  }
}

/** Enforced outside the language model, before a new paid round is created. */
export function assertGenerationRound(run: Entity, jobs: Entity[], count: number) {
  const state = runJobs(jobs, run.id)
  if (state.unknown) throw new Error('存在提交结果不明的任务，请核实后再继续')
  if (state.pending) throw new Error('上一轮仍在生成或保存，请等待结果')
  if (Number(run.data.rounds) >= 3) throw new Error('已达到两轮自动修正上限')
  if (Number(run.data.imagesSpent ?? 0) + count > Number(run.data.maxImages)) throw new Error('本轮张数超过剩余额度')
  const latest = state.own.filter(job => job.data.revisionId === run.data.lastRevisionId)
  if (latest.some(job => job.data.saveStatus === 'saved') && run.data.inspectedRevisionId !== run.data.lastRevisionId) {
    throw new Error('请先检查上一轮图片，再决定是否修正')
  }
}
