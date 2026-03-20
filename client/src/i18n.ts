import axios from "axios";
import dictData from "./dict.json";

export function initI18n() {
    let lang = (localStorage.getItem("statlab_lang") as "en" | "de" | "zh") || "zh";

    (window as any).__setLang = (l: string) => {
        localStorage.setItem("statlab_lang", l);
        window.location.reload();
    };

    (window as any).__getLang = () => lang;

    if (lang !== "zh") {
        const dict = (dictData as any)[lang] || {};

        // 1. Core translation function with sub-string replacement
        const translateFull = (str: string): string => {
            if (!str || typeof str !== 'string' || !/[\u4e00-\u9fa5]/.test(str)) return str;

            // Exact match check first
            if (dict[str]) return dict[str];

            // Partial replacement for composite strings
            let res = str;
            // Sort keys by length descending to prevent partial match issues (e.g. '数据' vs '我的数据')
            const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

            for (const k of sortedKeys) {
                if (k.length > 1 && res.includes(k)) {
                    res = res.split(k).join(dict[k]);
                }
            }
            return res;
        };

        // 2. Patch DOM Text Nodes (Catches almost all static and dynamic React text)
        const originalCreateTextNode = document.createTextNode;
        document.createTextNode = function (data: string) {
            if (typeof data === 'string') {
                data = translateFull(data);
            }
            return originalCreateTextNode.call(this, data);
        };

        // 3. Patch Element attributes (placeholder, title, etc.)
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name: string, value: any) {
            if (typeof value === 'string' && ['placeholder', 'title', 'label', 'aria-label', 'alt'].includes(name.toLowerCase())) {
                value = translateFull(value);
            }
            return originalSetAttribute.apply(this, [name, value]);
        };

        // 4. Object translation for JSON data (API responses)
        const translateObj = (val: any, depth = 0): any => {
            if (depth > 15) return val; // limit depth
            if (typeof val === 'string') return translateFull(val);
            if (Array.isArray(val)) return val.map(v => translateObj(v, depth + 1));
            if (val && typeof val === 'object' && !(val instanceof Element)) {
                let copy: any = {};
                for (let key in val) {
                    // Translate keys if needed? No, keys are usually IDs. Preserve keys, translate values.
                    copy[key] = translateObj(val[key], depth + 1);
                }
                return copy;
            }
            return val;
        }

        // 5. Intercept Axios
        axios.interceptors.response.use((response) => {
            if (response.data) {
                response.data = translateObj(response.data);
            }
            return response;
        }, (error) => {
            if (error.response && error.response.data) {
                error.response.data = translateObj(error.response.data);
            }
            return Promise.reject(error);
        });

        // 6. Intercept Fetch for generic requests
        const originalFetch = window.fetch;
        window.fetch = async function () {
            const res = await originalFetch.apply(this, arguments as any);
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const cloned = res.clone();
                return new Response(
                    new ReadableStream({
                        async start(controller) {
                            try {
                                let text = await cloned.text();
                                let obj = JSON.parse(text);
                                const translated = translateObj(obj);
                                controller.enqueue(new TextEncoder().encode(JSON.stringify(translated)));
                            } catch (e) {
                                controller.enqueue(new TextEncoder().encode(await cloned.text()));
                            }
                            controller.close();
                        }
                    }),
                    { status: res.status, statusText: res.statusText, headers: res.headers }
                );
            }
            return res;
        };

        // 7. Intercept standard dialogs
        const originalAlert = window.alert;
        window.alert = (msg) => originalAlert(translateFull(String(msg)));
        const originalConfirm = window.confirm;
        window.confirm = (msg) => originalConfirm(translateFull(String(msg)));
    }
}
