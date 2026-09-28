// Build-side chrome strings for the page header, index rows, end matter and
// colophon. Any zh language reads the zh-Hans table and everything else reads
// en; a key missing from zh-Hans falls back to en. A value is a string, or a
// function of vars for strings that carry a number.

export const EN = "en"
export const ZH = "zh-Hans"

const STRINGS = {
  [EN]: {
    writing: "Writing",
    works: "Works",
    revised: "Revised",
    minRead: ({ n }) => `${n} min read`,
    liveFigures: ({ n }) => (n === 1 ? "1 live figure" : `${n} live figures`),
    language: "Language",
    more: "More",
    relatedWork: "Related work",
    essaysAboutWork: "Essays about this work",
    moreWriting: "More writing",
    allWriting: ({ n }) => `All writing (${n})`,
    liveSite: "Live site",
    source: "Source",
    zhVersion: "中文版",
    designEssay: "Design essay",
    // "Built with <a>Quartz</a>": the text before and after the link.
    builtWithBefore: "Built with ",
    builtWithAfter: "",
    // Homepage plates, title blocks, the index ledger and linked end matter.
    latest: "Latest",
    latestNote: ({ n }) =>
      `The newest essay${n > 0 ? ` and the ${["one", "two", "three"][n - 1] ?? n} before it` : ""}. Every essay is in the index below.`,
    index: "Index",
    readEssay: "Read the essay",
    read: "Read",
    openWork: "Open the work",
    essaysCount: ({ n }) => (n === 1 ? "1 essay" : `${n} essays`),
    worksCount: ({ n }) => (n === 1 ? "1 work" : `${n} works`),
    updated: ({ date }) => `Updated ${date}`,
    minShort: ({ n }) => `${n} min`,
    figuresShort: ({ n }) => (n === 1 ? "1 live figure" : `${n} live figures`),
    no: ({ n }) => `No. ${String(n).padStart(3, "0")}`,
    fieldEssays: "Essays",
    fieldWorks: "Works",
    fieldSince: "Since",
    fieldUpdated: "Updated",
    fieldElsewhere: "Elsewhere",
    fieldFirst: "First",
    fieldLatest: "Latest",
    fieldTranslated: "In 中文",
    fieldPublished: "Published",
    fieldReading: "Reading",
    fieldFigures: "Live figures",
    fieldLanguage: "Language",
    fieldRevised: "Revised",
    fieldLinks: "Links",
    colNo: "No.",
    colDate: "Date",
    colEntry: "Entry",
    colReading: "Reading",
    indexNote: ({ n }) =>
      `${n} ${n === 1 ? "essay" : "essays"}, newest first. Numbers run in order of publication.`,
    worksNote: "Things built, with the essays about them.",
    series: "Series",
    partOf: ({ n, total }) => `Part ${n} of ${total}`,
    previous: "Previous",
    next: "Next",
    linkedFrom: "Linked from",
  },
  [ZH]: {
    writing: "文章",
    works: "作品",
    revised: "修订于",
    minRead: ({ n }) => `约 ${n} 分钟`,
    liveFigures: ({ n }) => `${n} 个交互图`,
    language: "语言",
    more: "更多",
    relatedWork: "相关作品",
    essaysAboutWork: "相关文章",
    moreWriting: "更多文章",
    allWriting: ({ n }) => `全部文章（${n}）`,
    liveSite: "在线版",
    source: "源码",
    zhVersion: "中文版",
    designEssay: "设计文章",
    builtWithBefore: "用 ",
    builtWithAfter: " 构建",
    latest: "最新",
    latestNote: ({ n }) =>
      `最新的一篇${n > 0 ? `，和它之前的${["一", "两", "三"][n - 1] ?? n}篇` : ""}。全部文章都在下面的索引里。`,
    index: "索引",
    readEssay: "阅读全文",
    read: "阅读",
    openWork: "查看作品",
    essaysCount: ({ n }) => `${n} 篇文章`,
    worksCount: ({ n }) => `${n} 件作品`,
    updated: ({ date }) => `更新于 ${date}`,
    minShort: ({ n }) => `${n} 分钟`,
    figuresShort: ({ n }) => `${n} 个交互图`,
    fieldEssays: "文章",
    fieldWorks: "作品",
    fieldSince: "始于",
    fieldUpdated: "更新",
    fieldElsewhere: "其他",
    fieldFirst: "最早",
    fieldLatest: "最新",
    fieldTranslated: "有中文",
    fieldPublished: "发布",
    fieldReading: "阅读",
    fieldFigures: "交互图",
    fieldLanguage: "语言",
    fieldRevised: "修订",
    fieldLinks: "链接",
    colNo: "编号",
    colDate: "日期",
    colEntry: "条目",
    colReading: "阅读",
    indexNote: ({ n }) => `${n} 篇，新的在前。编号按发布顺序。`,
    worksNote: "做过的东西，和写它们的文章。",
    series: "系列",
    partOf: ({ n, total }) => `第 ${n} 篇，共 ${total} 篇`,
    previous: "上一篇",
    next: "下一篇",
    linkedFrom: "引用本文的页面",
  },
}

/** True for zh, zh-Hans, zh-CN and the like. */
export function isZh(lang) {
  return typeof lang === "string" && /^zh\b/i.test(lang)
}

/** A page's language, read the way renderPage reads it for body lang. */
export function langOf(fileData) {
  return fileData?.i18n?.lang ?? fileData?.frontmatter?.lang ?? EN
}

export function t(lang, key, vars = {}) {
  const value = (isZh(lang) ? STRINGS[ZH][key] : undefined) ?? STRINGS[EN][key]
  if (value === undefined) throw new Error(`presence-shared: no chrome string "${key}"`)
  return typeof value === "function" ? value(vars) : value
}
