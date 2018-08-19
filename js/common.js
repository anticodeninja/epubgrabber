"use strict";

const chromep = new ChromePromise();

const IGNORE_TAGS = ["title", "meta", "style", "link", "script", "iframe", "svg", "video", "form"];
const IGNORE_ATTR = ["id", "style", "class", "contenteditable"];
const IGNORE_WILD_ATTR = ["on", "data-"];
const CONTENT_OBLIGATORY = ["a", "i", "b", "ul", "ol"];
const BLOCKS = ["div", "p", "br", "pre", "ul", "ol", "li"];

const blankGif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function prepareElement(value, callback) {
    let temp = document.createElement("div");
    temp.innerHTML = value;
    setTimeout(x => callback(temp), 1);
}

function skipTag(nodeName) {
    return IGNORE_TAGS.includes(nodeName)
}

function skipAttr(attrName) {
    if (IGNORE_ATTR.includes(attrName)) return true;
    for (let i = 0, len = IGNORE_WILD_ATTR.length; i < len; ++i) {
        if (attrName.startsWith(IGNORE_WILD_ATTR[i])) return true;
    }
    return false;
}

function padLeft(value, length, char) {
    value = "" + value;
    while (value.length < length) {
        value = char + value;
    }
    return value;
}

function splitFilter(filter) {
    return filter.split(/,\s*/).filter(function(x) { return !!x });
}

function getPageSettings(url) {
    return chromep.storage.sync.get('settings').then((data) => {
        let simplifier = (data.settings || {}).simplifiers || [];

        for (let i = 0; i < simplifier.length; ++i) {
            if (url.match(simplifier[i].url)) {
                return simplifier[i];
            }
        }

        return {
            id: 0,
            url: url,
            take: ["body"],
            remove: []
        };
    });
}

function setPageSettings(simplifier) {
    return chromep.storage.sync.get('settings').then((data) => {
        if (!data.settings) { data.settings = {}; };
        if (!data.settings.simplifiers) { data.settings.simplifiers = []; };

        let simplifiers = data.settings.simplifiers;

        if (simplifier.id !== 0) {
            for (let i = 0; i < simplifiers.length; ++i) {
                if (simplifiers[i].id == simplifier.id) {
                    simplifiers[i] = simplifier;
                    break;
                }
            }
        } else {
            simplifier.id = 1;
            for (let i = 0; i < simplifiers.length; ++i) {
                if (simplifiers[i].id >= simplifier.id) {
                    simplifier.id = simplifiers[i].id + 1;
                }
            }
            simplifiers.push(simplifier);
        }

        return chromep.storage.sync.set(data);
    });
}
