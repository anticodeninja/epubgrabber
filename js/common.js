"use strict";

const chromep = new ChromePromise();

function getPageSettings(url) {
    return chromep.storage.sync.get('settings').then((data) => {
        let simplifySettings = (data.settings || {}).simplify || [];

        for (let i = 0; i < simplifySettings.length; ++i) {
            if (url.match(simplifySettings[i].url)) {
                return simplifySettings[i];
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

function setPageSettings(config) {
    return chromep.storage.sync.get('settings').then((data) => {
        if (!data.settings) { data.settings = {}; };
        if (!data.settings.simplify) { data.settings.simplify = []; };

        let simplifySettings = data.settings.simplify;

        if (config.id !== 0) {
            for (let i = 0; i < simplifySettings.length; ++i) {
                if (simplifySettings[i].id == config.id) {
                    simplifySettings[i] = config;
                    break;
                }
            }
        } else {
            config.id = 1;
            for (let i = 0; i < simplifySettings.length; ++i) {
                if (simplifySettings[i].id >= config.id) {
                    config.id = simplifySettings[i].id + 1;
                }
            }
            simplifySettings.push(config);
        }

        return chromep.storage.sync.set(data);
    });
}
