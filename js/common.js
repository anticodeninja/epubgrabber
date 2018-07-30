"use strict";

const chromep = new ChromePromise();

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
