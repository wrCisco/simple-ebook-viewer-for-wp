export const startSREEngine = async (baseLocalesUrl) => {
    globalThis.SREfeature = {
        json: baseLocalesUrl + "dist/speech-rule-engine/lib/mathmaps",
        markup: "ssml",
        domain: "clearspeak",
    }
    const SRE = await import("speech-rule-engine")
    const updateLocale = async (lang) => {
        if (!lang) return
        const l = SRE.engineSetup().lang
        if (l !== lang.slice(0, 2)) {
            await SRE.setupEngine({"locale": lang.slice(0, 2)})
        }
    }
    return { engine: SRE, updateLocale }
}
