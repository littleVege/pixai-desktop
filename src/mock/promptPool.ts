import type { CuratedPrompt } from '@/lib/recommend'

/** Draft curated pool for users with no history. Placeholder copy until the content team supplies the real set. */
export const curatedPrompts: CuratedPrompt[] = [
  { style: 'natural', locale: 'en', text: 'A girl with silver hair reading on a rooftop at dusk, city lights coming on below, warm rim light, soft breeze in her scarf' },
  { style: 'natural', locale: 'en', text: 'A shrine maiden sweeping fallen maple leaves on stone steps, early autumn morning, mist between the torii gates' },
  { style: 'natural', locale: 'en', text: 'Two friends sharing an umbrella at a rainy bus stop, neon reflections on the wet street, one of them laughing' },
  { style: 'natural', locale: 'en', text: 'A young witch tending glowing plants in a cluttered greenhouse, sunlight through dusty glass, a black cat on the shelf' },
  { style: 'natural', locale: 'en', text: 'A knight in white armor resting by a campfire in a snowy forest, sword planted beside her, stars overhead' },
  { style: 'natural', locale: 'zh', text: '黃昏的天台上，一位銀髮少女坐著看書，腳下的城市燈光逐漸亮起，晚風吹動她的圍巾' },
  { style: 'natural', locale: 'zh', text: '秋天清晨，巫女在神社石階上掃著紅葉，鳥居之間飄著薄霧' },
  { style: 'natural', locale: 'zh', text: '雨夜的公車站，兩個好友共撐一把傘，濕漉漉的街道映著霓虹燈，其中一人正在大笑' },
  { style: 'natural', locale: 'zh', text: '年輕的魔女在雜亂的溫室裡照顧發光的植物，陽光穿過布滿灰塵的玻璃，架上趴著一隻黑貓' },
  { style: 'natural', locale: 'zh', text: '雪夜森林裡，身穿白色鎧甲的女騎士靠著篝火休息，長劍插在身旁，頭頂滿天星斗' },
  { style: 'tags', text: '1girl, solo, silver hair, long hair, reading, book, rooftop, dusk, city lights, scarf, wind, upper body' },
  { style: 'tags', text: '1girl, miko, shrine, stone stairs, torii, autumn leaves, maple, broom, morning, fog, full body' },
  { style: 'tags', text: '2girls, umbrella, rain, bus stop, night, neon lights, reflection, wet street, laughing, school uniform' },
  { style: 'tags', text: '1girl, witch hat, greenhouse, glowing plants, sunlight, black cat, potted plant, smile, indoors' },
]
