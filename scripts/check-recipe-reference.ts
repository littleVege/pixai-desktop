import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { searchRecipes } from '../electron/recipe-directory'
import { promptToDoc } from '../src/lib/promptSerialize'

const [, , directory, imagePath] = process.argv
if (!directory || !imagePath) throw new Error('Pass a new test directory and the generated wisteria WebP')
mkdirSync(directory)
const store = new StudioStore(directory)
const pixaiKey = process.env.PIXAI_API_KEY!
const service = new StudioService(store, () => ({ pixaiKey }), () => {})
try {
  const { items } = await searchRecipes({ modelId: '2024383378759147749' }, pixaiKey)
  const recipe = items.find(r => r.id === '2075734143269194720' && r.usability === 'usable')
  if (!recipe) throw new Error('Test recipe is no longer available')
  const work = service.createWork('紫藤 · 参考图与赛璐璐配方', {})
  const reference = await service.importReference({ bytes: Array.from(readFileSync(imagePath)), contentType: 'image/webp', name: '紫藤原图', workId: work.id })
  const prompt = '参照 image1 的白墙与紫藤构图，绘制二次元赛璐璐插画，保留垂落的紫色花穗。'
  const snapshot = { doc: promptToDoc(prompt, [reference]), references: [reference], loras: [], recipeIds: [recipe.id], recipeMetadata: [recipe], modelVersionId: '2024383379556065549' }
  const job = await service.generate(work.id, { prompt, recipeIds: snapshot.recipeIds, modelVersionId: snapshot.modelVersionId, modelType: 'MMDIT26B_MODEL', contextImages: [], loras: [], aspectRatio: '1:1', size: '1k', batchSize: 1 }, snapshot)
  assert.ok(job?.data.remoteId, 'Submission uncertain; check existing work instead of resubmitting')
  const params = job.data.parameters as { recipeIds: string[]; contextImages: string[] }
  assert.deepEqual(params.recipeIds, [recipe.id])
  assert.equal(params.contextImages.length, 1)
  assert.match(params.contextImages[0], /^\d+$/)
  console.log(JSON.stringify({ workId: work.id, jobId: job.id, remoteId: job.data.remoteId, recipe: recipe.title, referenceMediaId: params.contextImages[0] }))
  while (store.get(job.id)?.data.saveStatus !== 'saved') {
    await service.poll()
    if (store.get(job.id)?.data.status === 'failed') throw new Error('Remote task failed')
    await delay(3000)
  }
  const assets = store.list('asset', work.id).filter(asset => asset.data.source === 'generation')
  assert.equal(assets.length, 1)
  console.log(JSON.stringify({ saved: assets[0].data.filename, width: assets[0].data.width, height: assets[0].data.height }))
} finally { store.close() }
